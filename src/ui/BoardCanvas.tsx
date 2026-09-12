import { useCallback, useEffect, useRef, useState } from 'react'
import { renderScene } from '@/board/render/renderScene'
import { TileCache } from '@/board/render/tileCache'
import { toRenderInput, useBoardStore } from '@/board/store/boardStore'
import { hitTest, marqueeSelect } from '@/board/interact/hitTest'
import { CORNERS, cornerPoint, HANDLE_SIZE, hitTestHandle } from '@/board/interact/handles'
import { resizeKeepingAspect } from '@/board/interact/resize'
import { snapMove, type SnapGuide } from '@/board/interact/snap'
import type { Board, NodeId } from '@/board/model/types'
import { boardToScreen, fitCamera, panBy, screenToBoard, zoomAt, type Camera } from '@/board/view/camera'
import type { Point, Rect } from '@/lib/geometry'
import { boundsOf, rectFromPoints, translate } from '@/lib/geometry'
import { ZoomControls } from '@/ui/ZoomControls'
import { SelectionToolbar } from '@/ui/SelectionToolbar'
import { t } from '@/i18n/t'

/** Screen-px movement below this counts as a click, not a marquee drag. */
const MARQUEE_THRESHOLD = 3
/** Selection outline and corner-handle color. */
const SELECTION_COLOR = '#2563eb'
/** Alignment-guide line color - distinct from the selection color. */
const GUIDE_COLOR = '#f43f5e'
/** Screen-px distance within which a drag snaps to an edge/center. */
const SNAP_THRESHOLD_PX = 8

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
  /** Shared with TopBar's Copy button (see `useCopyAction`) so Ctrl/Cmd+Shift+C
   * triggers the exact same clipboard call and "copied" feedback. */
  onCopy: () => void
}

/**
 * The canvas backing store is sized to the *viewport*, not the board - unlike
 * Phase 1. That keeps memory bounded at any zoom level (a tall board zoomed
 * to 400% would otherwise blow past the canvas area limit in ADR-005) and
 * means panning never has to resize anything. `renderScene`'s `offset` is
 * what places the board correctly inside that fixed-size canvas; export never
 * sets it, so this is purely a preview concern - see invariant 1.
 */
export function BoardCanvas({ board, viewport, onCopy }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
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
  // Group-move in progress: every moving node's frame at pointerdown, keyed
  // by id, plus which one was actually grabbed (drives snapping) and where.
  const moveRef = useRef<{
    ids: NodeId[]
    primaryId: NodeId
    startFrames: Record<NodeId, Rect>
    startPoint: Point
  } | null>(null)
  const resizeRef = useRef<{ id: NodeId; corner: (typeof CORNERS)[number]; startFrame: Rect } | null>(null)
  // Drag-to-reorder in progress (any layout mode except 'free'): the dragged
  // node floats to follow the pointer without reflowing the rest of the
  // board (computeLayout is too slow to call every pointermove - see
  // performance.spec.ts's ~50ms relayout at a dozen images), and the id of
  // whichever other node it's currently hovering, for the drop-target outline.
  const reorderRef = useRef<{ id: NodeId; startFrame: Rect; startPoint: Point } | null>(null)
  const reorderHoverRef = useRef<NodeId | null>(null)
  // Live frame overrides for nodes being moved/resized, read directly by
  // `draw`/`drawInteraction` so dragging renders at 60fps without going
  // through React state - only committed to the store on pointer-up.
  const dragFramesRef = useRef<Record<NodeId, Rect> | null>(null)
  const guidesRef = useRef<SnapGuide[]>([])
  const [percent, setPercent] = useState(() => Math.round(cameraRef.current.zoom * 100))
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelection = useBoardStore((s) => s.setSelection)
  const toggleSelection = useBoardStore((s) => s.toggleSelection)
  const setFrames = useBoardStore((s) => s.setFrames)
  const reorder = useBoardStore((s) => s.reorder)
  const deleteSelected = useBoardStore((s) => s.deleteSelected)
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected)
  const bringToFront = useBoardStore((s) => s.bringToFront)
  const undo = useBoardStore((s) => s.undo)
  const redo = useBoardStore((s) => s.redo)

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
    // Live drag overrides only ever touch this preview-side copy of the
    // frames - the store (and export) still hold the last committed layout
    // until pointer-up, matching invariant 1's "export never sees preview-
    // only state" (same reasoning as the camera's `offset`).
    const overrides = dragFramesRef.current
    if (overrides) {
      for (const item of input.items) {
        const frame = overrides[item.id]
        if (frame) item.frame = frame
      }
    }
    tiles.retain(input.items.map((i) => i.id))
    renderScene(ctx, input, { scale: renderScale, tiles, offset: { x: origin.x * dpr, y: origin.y * dpr } })
    // Forces rasterization to finish before this function returns. WebKit's
    // canvas rasterization is asynchronous (see the timing gotcha in
    // CLAUDE.md); without this, reordering two same-size tiles could leave
    // the visible canvas showing the pre-reorder pixels for an arbitrary
    // stretch, since nothing else here reads the bitmap back to force it.
    ctx.getImageData(0, 0, 1, 1)

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

    const overrides = dragFramesRef.current
    for (const n of board.nodes) {
      if (!selectedIds.includes(n.id)) continue
      const frame = overrides?.[n.id] ?? n.frame
      const topLeft = boardToScreen(camera, viewport, { x: frame.x, y: frame.y })
      const w = frame.w * camera.zoom
      const h = frame.h * camera.zoom
      ctx.strokeRect(topLeft.x, topLeft.y, w, h)
      ctx.fillStyle = SELECTION_COLOR
      for (const corner of CORNERS) {
        const p = boardToScreen(camera, viewport, cornerPoint(frame, corner))
        ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
      }
    }

    // Positions the floating selection toolbar imperatively, same ref-first
    // reasoning as `pageRef` above - it must track the selection at 60fps
    // during a drag without going through React state. Hidden mid-gesture so
    // it doesn't float over a move/resize/marquee in progress.
    const toolbar = toolbarRef.current
    if (toolbar) {
      const dragging = !!(moveRef.current || resizeRef.current || reorderRef.current || marqueeRef.current)
      if (selectedIds.length === 0 || dragging) {
        toolbar.style.display = 'none'
      } else {
        const frames = board.nodes.filter((n) => selectedIds.includes(n.id)).map((n) => overrides?.[n.id] ?? n.frame)
        const bounds = boundsOf(frames)
        const boundsTopLeft = boardToScreen(camera, viewport, { x: bounds.x, y: bounds.y })
        const boundsTopRight = boardToScreen(camera, viewport, { x: bounds.x + bounds.w, y: bounds.y })
        toolbar.style.display = 'flex'
        toolbar.style.left = `${(boundsTopLeft.x + boundsTopRight.x) / 2}px`
        toolbar.style.top = `${boundsTopLeft.y}px`
      }
    }

    const hoverId = reorderHoverRef.current
    if (hoverId) {
      const target = board.nodes.find((n) => n.id === hoverId)
      if (target) {
        const topLeft = boardToScreen(camera, viewport, { x: target.frame.x, y: target.frame.y })
        ctx.save()
        ctx.strokeStyle = GUIDE_COLOR
        ctx.lineWidth = 3
        ctx.setLineDash([6, 4])
        ctx.strokeRect(topLeft.x, topLeft.y, target.frame.w * camera.zoom, target.frame.h * camera.zoom)
        ctx.restore()
      }
    }

    ctx.strokeStyle = GUIDE_COLOR
    ctx.lineWidth = 1
    for (const guide of guidesRef.current) {
      ctx.beginPath()
      if (guide.axis === 'x') {
        const x = boardToScreen(camera, viewport, { x: guide.at, y: 0 }).x
        ctx.moveTo(x, 0)
        ctx.lineTo(x, viewport.h)
      } else {
        const y = boardToScreen(camera, viewport, { x: 0, y: guide.at }).y
        ctx.moveTo(0, y)
        ctx.lineTo(viewport.w, y)
      }
      ctx.stroke()
    }

    const marquee = marqueeRef.current
    if (marquee) {
      const a = boardToScreen(camera, viewport, marquee.start)
      const b = boardToScreen(camera, viewport, marquee.current)
      const rect = rectFromPoints(a, b)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
      ctx.strokeStyle = SELECTION_COLOR
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

  // Left-click: a resize handle drags that node's size; a node drags the
  // whole selection (selecting it first if it wasn't already); empty space
  // marquee-selects. Left-click-without-space is untouched by the pan effect
  // above, so both listeners can sit on the same canvas without conflict.
  // In-progress geometry lives in refs, not React state, and is drawn by
  // calling `draw`/`drawInteraction` directly on every pointermove - the
  // store only hears about it once, on pointer-up.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toScreenPoint = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const toBoardPoint = (e: PointerEvent): Point => screenToBoard(cameraRef.current, viewport, toScreenPoint(e))

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || spaceHeldRef.current) return

      const handle = hitTestHandle(board.nodes, selectedIds, cameraRef.current, viewport, toScreenPoint(e))
      if (handle) {
        resizeRef.current = { id: handle.id, corner: handle.corner, startFrame: handle.frame }
        canvas.setPointerCapture(e.pointerId)
        return
      }

      const point = toBoardPoint(e)
      const hitId = hitTest(board.nodes, point)
      if (hitId) {
        if (e.shiftKey) {
          toggleSelection(hitId)
          return
        }
        if (board.layout !== 'free') {
          // Still auto-arranged: dragging reorders instead of moving freely
          // (see `reorder` in the store) - only a resize handle (checked
          // above) or `setFrames` switches this board to 'free'.
          setSelection([hitId])
          const hitNode = board.nodes.find((n) => n.id === hitId)!
          reorderRef.current = { id: hitId, startFrame: hitNode.frame, startPoint: point }
          canvas.setPointerCapture(e.pointerId)
          return
        }
        const current = useBoardStore.getState().selectedIds
        const ids = current.includes(hitId) ? current : [hitId]
        if (!current.includes(hitId)) setSelection(ids)
        const startFrames: Record<NodeId, Rect> = {}
        for (const n of board.nodes) if (ids.includes(n.id)) startFrames[n.id] = n.frame
        moveRef.current = { ids, primaryId: hitId, startFrames, startPoint: point }
        canvas.setPointerCapture(e.pointerId)
        return
      }

      marqueeRef.current = { start: point, current: point, screenStart: { x: e.clientX, y: e.clientY } }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const resize = resizeRef.current
      if (resize) {
        dragFramesRef.current = { [resize.id]: resizeKeepingAspect(resize.startFrame, resize.corner, toBoardPoint(e)) }
        draw()
        drawInteraction()
        return
      }

      const reorderState = reorderRef.current
      if (reorderState) {
        const point = toBoardPoint(e)
        const frame = translate(reorderState.startFrame, point.x - reorderState.startPoint.x, point.y - reorderState.startPoint.y)
        dragFramesRef.current = { [reorderState.id]: frame }
        const center = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 }
        reorderHoverRef.current = hitTest(board.nodes.filter((n) => n.id !== reorderState.id), center)
        draw()
        drawInteraction()
        return
      }

      const move = moveRef.current
      if (move) {
        const point = toBoardPoint(e)
        const dx0 = point.x - move.startPoint.x
        const dy0 = point.y - move.startPoint.y
        const primaryStart = move.startFrames[move.primaryId]!
        const others = board.nodes.filter((n) => !move.ids.includes(n.id)).map((n) => n.frame)
        const snap = snapMove(translate(primaryStart, dx0, dy0), others, board.size, SNAP_THRESHOLD_PX / cameraRef.current.zoom)
        guidesRef.current = snap.guides
        const dx = dx0 + snap.dx
        const dy = dy0 + snap.dy
        const frames: Record<NodeId, Rect> = {}
        for (const id of move.ids) frames[id] = translate(move.startFrames[id]!, dx, dy)
        dragFramesRef.current = frames
        draw()
        drawInteraction()
        return
      }

      const marquee = marqueeRef.current
      if (marquee) {
        marqueeRef.current = { ...marquee, current: toBoardPoint(e) }
        drawInteraction()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)

      if (resizeRef.current) {
        const { id } = resizeRef.current
        const frame = dragFramesRef.current?.[id]
        resizeRef.current = null
        if (frame) setFrames([{ id, frame }])
        // Only clear the override after this draw: the store update above
        // hasn't reached `board` (a prop, updated by React) yet, so without
        // it this frame would render the pre-resize size for one paint.
        draw()
        drawInteraction()
        dragFramesRef.current = null
        return
      }

      if (moveRef.current) {
        const frames = dragFramesRef.current
        moveRef.current = null
        guidesRef.current = []
        if (frames) setFrames(Object.entries(frames).map(([id, frame]) => ({ id, frame })))
        draw()
        drawInteraction()
        dragFramesRef.current = null
        return
      }

      if (reorderRef.current) {
        const { id } = reorderRef.current
        const hoverId = reorderHoverRef.current
        const frame = dragFramesRef.current?.[id]
        reorderRef.current = null
        reorderHoverRef.current = null
        if (hoverId) {
          // Dropped onto another node: swap places, still auto-arranged.
          const targetIndex = [...board.nodes].sort((a, b) => a.order - b.order).findIndex((n) => n.id === hoverId)
          if (targetIndex !== -1) reorder(id, targetIndex)
        } else if (frame) {
          // Dropped on open space, not onto a slot: this is the manual
          // escape hatch (invariant 4/item 4), same as a drag that started
          // already-free.
          setFrames([{ id, frame }])
        }
        draw()
        drawInteraction()
        dragFramesRef.current = null
        return
      }

      const marquee = marqueeRef.current
      if (!marquee) return
      marqueeRef.current = null

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
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [board, viewport, selectedIds, setSelection, toggleSelection, setFrames, reorder, draw, drawInteraction])

  // Keyboard shortcuts (Phase 2 item 9 completes this set). Undo/redo and
  // copy are the deliberate exceptions to "no modifier keys": Ctrl/Cmd+Z is
  // universal and, unlike Ctrl/Cmd+D (see item 6's note on why duplicate
  // waits for item 9 - and ends up on a plain key instead, below), no browser
  // reserves it on a plain page. Ctrl/Cmd+Shift+C is the one shortcut the
  // product plan itself names (docs/00-product-plan.md's journey narrative);
  // Chromium/Edge also bind it to DevTools' inspect-element mode, a
  // browser-chrome-level accelerator this page can only `preventDefault`
  // against, not detect - whether that wins over the page in every real
  // desktop build is unconfirmed, same category as the existing real-browser
  // gotchas above. Duplicate and bring-to-front get plain `D`/`F` instead of
  // a modifier: Ctrl/Cmd+D is browser-reserved for bookmarking everywhere,
  // and every other single-purpose shortcut in this file (zoom, delete,
  // escape) already avoids modifiers for the same reason.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // Only bail for an actual text-editing surface, where a modifier
      // shortcut should act on the text, not the board - unlike the gap
      // slider below, there's no such surface yet (Phase 4 is what adds
      // one), but this keeps the promise invariant 7 already makes about
      // text input. The gap slider itself commonly still has focus right
      // after a drag (the exact moment a user reaches for undo or copy), so
      // it must not be caught by this check the way the plain shortcuts
      // below are.
      const isTextEntry =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLInputElement && target.type !== 'range')

      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        if (isTextEntry) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c') {
        if (isTextEntry) return
        e.preventDefault()
        void onCopy()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
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
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          deleteSelected()
        }
      } else if (e.key.toLowerCase() === 'd') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          duplicateSelected()
        }
      } else if (e.key.toLowerCase() === 'f') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          bringToFront()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    zoomByFactor,
    fitToView,
    resetTo100,
    setSelection,
    selectedIds,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    undo,
    redo,
    onCopy,
  ])

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
      <SelectionToolbar
        ref={toolbarRef}
        onDuplicate={duplicateSelected}
        onBringToFront={bringToFront}
        onDelete={deleteSelected}
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
