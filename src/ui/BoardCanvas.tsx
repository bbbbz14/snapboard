import { useCallback, useEffect, useRef, useState } from 'react'
import { renderScene } from '@/board/render/renderScene'
import { TileCache } from '@/board/render/tileCache'
import { toRenderInput } from '@/board/store/boardStore'
import type { Board } from '@/board/model/types'
import { boardToScreen, fitCamera, panBy, zoomAt, type Camera } from '@/board/view/camera'
import { ZoomControls } from '@/ui/ZoomControls'

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
  const pageRef = useRef<HTMLDivElement>(null)
  const tilesRef = useRef(new TileCache())
  const cameraRef = useRef<Camera>(fitCamera(board.size, viewport, VIEW_MARGIN))
  // True until the user zooms or pans by hand; while true, the camera keeps
  // re-fitting on every board/viewport change, matching the old always-fit
  // behaviour. A manual zoom/pan turns this off until "fit" is pressed again.
  const autoFitRef = useRef(true)
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const spaceHeldRef = useRef(false)
  const [percent, setPercent] = useState(() => Math.round(cameraRef.current.zoom * 100))

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

  useEffect(() => {
    if (autoFitRef.current) {
      cameraRef.current = fitCamera(board.size, viewport, VIEW_MARGIN)
      setPercent(Math.round(cameraRef.current.zoom * 100))
    }
    draw()
  }, [board, viewport, draw])

  /** Commits a zoom change: updates the ref, the % indicator, and redraws. */
  const applyZoom = useCallback(
    (next: Camera) => {
      autoFitRef.current = false
      cameraRef.current = next
      setPercent(Math.round(next.zoom * 100))
      draw()
    },
    [draw],
  )

  /** Commits a pan: updates the ref and redraws only - the zoom % is unchanged. */
  const applyPan = useCallback(
    (next: Camera) => {
      autoFitRef.current = false
      cameraRef.current = next
      draw()
    },
    [draw],
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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomByFactor, fitToView, resetTo100])

  return (
    <div className="board-stage">
      <div ref={pageRef} className="board-page" />
      <canvas
        ref={canvasRef}
        className="board-canvas"
        role="img"
        aria-label={`Board with ${board.nodes.length} image${board.nodes.length === 1 ? '' : 's'}`}
      />
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
