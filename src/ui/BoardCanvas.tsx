import { useCallback, useEffect, useRef, useState } from 'react'
import { renderScene } from '@/board/render/renderScene'
import { TileCache } from '@/board/render/tileCache'
import { toRenderInput, useBoardStore } from '@/board/store/boardStore'
import { hitTest, marqueeSelect } from '@/board/interact/hitTest'
import type { Board } from '@/board/model/types'
import { boardToScreen, fitCamera, panBy, screenToBoard, zoomAt, type Camera } from '@/board/view/camera'
import type { Point } from '@/lib/geometry'
import { rectFromPoints } from '@/lib/geometry'
import { ZoomControls } from '@/ui/ZoomControls'
import { t } from '@/i18n/t'

/** Screen-px movement below this counts as a click, not a marquee drag. */
const MARQUEE_THRESHOLD = 3
/** Selection outline and corner-handle color. */
const SELECTION_COLOR = '#2563eb'

/** 3x displays cost 2.25x the fill rate of 2x for no visible gain here. */
const MAX_DPR = 2
/** Breathing room around the board when it is fit to the viewport, in CSS px. */
const VIEW_MARGIN = 28
/** Multiplicative step for the zoom buttons and the +/- keys. */
const ZOOM_STEP = 1.2

interface Props {
  board: Board
  /** Space the canvas may occupy on screen, in CSS pixels. */
  viewport: { w: number; h: number }
}

/**
 * The canvas backing store is sized to the *viewport*, not the board - unlike
 * Phase 1. That keeps memory bounded at any zoom level (a tall board zoomed
 * to 400% would otherwise blow past the canvas area limit in ADR-005) and
 * means panning never has to resize anything. `renderScene`'s `offset` is
 * what places the board correctly inside that fixed-size canvas; export never
 * sets it, so this is purely a preview concern - see invariant 1.
 */
export function BoardCanvas({ board, viewport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const tilesRef = useRef(new TileCache())
  const cameraRef = useRef<Camera>(fitCamera(board.size, viewport, VIEW_MARGIN))
  // True until the user zooms or pans by hand; while true, the camera keeps
  // re-fitting on every board/viewport change, matching the old always-fit
  // behaviour. A manual zoom/pan turns this off until "fit" is pressed again.
  const autoFitRef = useRef(true)
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const spaceHeldRef = useRef(false)
  // Board-space marquee rect in progress, plus the screen-space pointerdown
  const marqueeRef = useRef<{ start: Point; current: Point; screenStart: { x: number; y: number } } | null>(null)
  const [percent, setPercent] = useState(() => Math.round(cameraRef.current.zoom * 100))
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelection = useBoardStore((s) => s.setSelection)
  const toggleSelection = useBoardStore((s) => s.toggleSelection)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const camera = cameraRef.current

    canvas.width = Math.max(1, Math.round(viewport.w * dpr))
    canvas.height = Math.max(1, Math.round(viewport.h * dpr))
    canvas.style.width = `${viewport.w}px`
    canvas.style.height = `${viewport.h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // The board rarely covers the whole viewport (zoomed out, or panned) -
    // the rest of the backing store must be cleared every frame.
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const renderScale = camera.zoom * dpr
    const origin = boardToScreen(camera, viewport, { x: 0, y: 0 })

    const tiles = tilesRef.current
    tiles.setRatio(renderScale)
    const input = toRenderInput(board)
    tiles.retain(input.items.map((i) => i.id))
    renderScene(ctx, input, { scale: renderScale, tiles, offset: { x: origin.x * dpr, y: origin.y * dpr } })

    // The "page" - checkerboard/shadow/rounded corners - is a DOM layer, not
    // drawn by renderScene, so it never touches the exported pixels.
    const page = pageRef.current
    if (page) {
      page.style.left = `${origin.x}px`
      page.style.top = `${origin.y}px`
      page.style.width = `${board.size.w * camera.zoom}px`
      page.style.height = `${board.size.h * camera.zoom}px`
    }
  }, [board, viewport])

  /**
   * Selection outlines, corner handles, and the marquee rect - drawn on a
   * second, viewport-sized canvas (ADR-002) so redrawing them every pointer-
   * move never touches the tile-cached content canvas or the exported PNG.
   */
  const drawInteraction = useCallback(() => {
    const canvas = interactionCanvasRef.current
    if (!canvas) return
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const camera = cameraRef.current

    canvas.width = Math.max(1, Math.round(viewport.w * dpr))
    canvas.height = Math.max(1, Math.round(viewport.h * dpr))
    canvas.style.width = `${viewport.w}px`
    canvas.style.height = `${viewport.h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 2

    const HANDLE = 6
    for (const n of board.nodes) {
      if (!selectedIds.includes(n.id)) continue
      const topLeft = boardToScreen(camera, viewport, { x: n.frame.x, y: n.frame.y })
      const w = n.frame.w * camera.zoom
      const h = n.frame.h * camera.zoom
      ctx.strokeRect(topLeft.x, topLeft.y, w, h)
      ctx.fillStyle = SELECTION_COLOR
      const corners: Point[] = [
        { x: topLeft.x, y: topLeft.y },
        { x: topLeft.x + w, y: topLeft.y },
        { x: topLeft.x, y: topLeft.y + h },
        { x: topLeft.x + w, y: topLeft.y + h },
      ]
      for (const c of corners) {
        ctx.fillRect(c.x - HANDLE / 2, c.y - HANDLE / 2, HANDLE, HANDLE)
      }
    }

    const marquee = marqueeRef.current
    if (marquee) {
      const a = boardToScreen(camera, viewport, marquee.start)
      const b = boardToScreen(camera, viewport, marquee.current)
      const rect = rectFromPoints(a, b)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
      ctx.lineWidth = 1
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    }
    ctx.restore()
  }, [board.nodes, selectedIds, viewport])

  useEffect(() => {
    if (autoFitRef.current) {
      cameraRef.current = fitCamera(board.size, viewport, VIEW_MARGIN)
      setPercent(Math.round(cameraRef.current.zoom * 100))
    }
    draw()
    drawInteraction()
  }, [board, viewport, draw, drawInteraction])

  /** Commits a zoom change: updates the ref, the % indicator, and redraws. */
  const applyZoom = useCallback(
    (next: Camera) => {
      autoFitRef.current = false
      cameraRef.current = next
      setPercent(Math.round(next.zoom * 100))
      draw()
      drawInteraction()
    },
    [draw, drawInteraction],
  )

  /** Commits a pan: updates the ref and redraws only - the zoom % is unchanged. */
  const applyPan = useCallback(
    (next: Camera) => {
      autoFitRef.current = false
      cameraRef.current = next
      draw()
      drawInteraction()
    },
    [draw, drawInteraction],
  )

  const zoomByFactor = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      const at = anchor ?? { x: viewport.w / 2, y: viewport.h / 2 }
      applyZoom(zoomAt(cameraRef.current, viewport, at, factor))
    },
    [applyZoom, viewport],
  )

  const fitToView = useCallback(() => {
    autoFitRef.current = true
    applyZoom(fitCamera(board.size, viewport, VIEW_MARGIN))
  }, [applyZoom, board.size, viewport])

  const resetTo100 = useCallback(() => {
    zoomByFactor(1 / cameraRef.current.zoom)
  }, [zoomByFactor])

  // Plain wheel pans, like the scrollbars a fixed-size canvas used to get for
  // free from the browser. Ctrl/Cmd+wheel zooms at the pointer - this is also
  // how Chrome and Firefox report trackpad pinch, so pinch-to-zoom works too.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect()
        const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        zoomByFactor(Math.exp(-e.deltaY * 0.01), anchor)
      } else {
        // Scrolling down should reveal content further down the board -
        // the opposite sign from a hand-drag, which moves content with the pointer.
        applyPan(panBy(cameraRef.current, -e.deltaX, -e.deltaY))
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [applyPan, zoomByFactor])

  // Space+drag or middle-mouse-drag pans. The gesture updates the camera ref
  // and redraws directly on every pointermove, bypassing React state - the
  // same "ref during the gesture, commit on release" pattern Phase 2 uses for
  // moving and resizing nodes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1 && !(e.button === 0 && spaceHeldRef.current)) return
      e.preventDefault()
      panStartRef.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent) => {
      const last = panStartRef.current
      if (!last) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      panStartRef.current = { x: e.clientX, y: e.clientY }
      applyPan(panBy(cameraRef.current, dx, dy))
    }
    const endPan = (e: PointerEvent) => {
      if (!panStartRef.current) return
      panStartRef.current = null
      canvas.style.cursor = spaceHeldRef.current ? 'grab' : ''
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endPan)
    canvas.addEventListener('pointercancel', endPan)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endPan)
      canvas.removeEventListener('pointercancel', endPan)
    }
  }, [applyPan])

  // Left-click selects (shift-click toggles); dragging from empty space
  // marquee-selects. Left-click-without-space is untouched by the pan effect
  // above, so both listeners can sit on the same canvas without conflict.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toBoardPoint = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect()
      return screenToBoard(cameraRef.current, viewport, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || spaceHeldRef.current) return
      const point = toBoardPoint(e)
      const hitId = hitTest(board.nodes, point)
      if (hitId) {
        if (e.shiftKey) toggleSelection(hitId)
        else if (!useBoardStore.getState().selectedIds.includes(hitId)) setSelection([hitId])
        return
      }
      marqueeRef.current = { start: point, current: point, screenStart: { x: e.clientX, y: e.clientY } }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const marquee = marqueeRef.current
      if (!marquee) return
      marqueeRef.current = { ...marquee, current: toBoardPoint(e) }
      drawInteraction()
    }

    const endMarquee = (e: PointerEvent) => {
      const marquee = marqueeRef.current
      if (!marquee) return
      marqueeRef.current = null
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)

      const moved = Math.hypot(e.clientX - marquee.screenStart.x, e.clientY - marquee.screenStart.y) > MARQUEE_THRESHOLD
      if (!moved) {
        if (!e.shiftKey) setSelection([])
      } else {
        const hitIds = marqueeSelect(board.nodes, rectFromPoints(marquee.start, marquee.current))
        if (e.shiftKey) setSelection([...new Set([...useBoardStore.getState().selectedIds, ...hitIds])])
        else setSelection(hitIds)
      }
      drawInteraction()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endMarquee)
    canvas.addEventListener('pointercancel', endMarquee)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endMarquee)
      canvas.removeEventListener('pointercancel', endMarquee)
    }
  }, [board.nodes, viewport, setSelection, toggleSelection, drawInteraction])

  // Keyboard shortcuts. None use a modifier key, so the browser's own
  // Ctrl/Cmd +/-/0 page-zoom shortcuts are left alone - see "avoid shortcuts
  // the browser owns" in CLAUDE.md.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomByFactor(ZOOM_STEP)
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomByFactor(1 / ZOOM_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        fitToView()
      } else if (e.key === '1') {
        e.preventDefault()
        resetTo100()
      } else if (e.key === 'Escape') {
        setSelection([])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomByFactor, fitToView, resetTo100, setSelection])

  return (
    <div className="board-stage">
      <div ref={pageRef} className="board-page" />
      <canvas
        ref={canvasRef}
        className="board-canvas"
        role="img"
        aria-label={`Board with ${board.nodes.length} image${board.nodes.length === 1 ? '' : 's'}`}
      />
      <canvas ref={interactionCanvasRef} className="board-interaction" aria-hidden="true" />
      <div className="selection-status visually-hidden" role="status" aria-live="polite">
        {selectedIds.length > 0 ? t('selection.count', { count: selectedIds.length }) : ''}
      </div>
      <ZoomControls
        percent={percent}
        onZoomOut={() => zoomByFactor(1 / ZOOM_STEP)}
        onZoomIn={() => zoomByFactor(ZOOM_STEP)}
        onReset={resetTo100}
        onFit={fitToView}
      />
    </div>
  )
}
