import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { renderScene } from '@/board/render/renderScene'
import { TileCache } from '@/board/render/tileCache'
import { assetStore, toRenderInput, useBoardStore } from '@/board/store/boardStore'
import { hitTest, marqueeSelect } from '@/board/interact/hitTest'
import { CORNERS, cornerPoint, HANDLE_SIZE, hitTestHandle, hitTestRectHandle } from '@/board/interact/handles'
import { resizeKeepingAspect, type Corner } from '@/board/interact/resize'
import { FULL_CROP, fullImageRect, resizeCropWindow, windowToCrop } from '@/board/interact/crop'
import { snapMove, type SnapGuide } from '@/board/interact/snap'
import { strokeArrow } from '@/board/render/arrow'
import { strokeBox } from '@/board/render/box'
import { fillRedact } from '@/board/render/redact'
import { TEXT_DEFAULT_WIDTH, TEXT_PADDING, ensureAnnotationFont, textFont, textHeight, textLineHeight, wrapText } from '@/board/render/text'
import type { Board, NodeId } from '@/board/model/types'
import { boardToScreen, fitCamera, panBy, screenToBoard, zoomAt, type Camera } from '@/board/view/camera'
import type { Point, Rect } from '@/lib/geometry'
import { boundsOf, rectFromPoints, translate } from '@/lib/geometry'
import { ZoomControls } from '@/ui/ZoomControls'
import { SelectionToolbar, type StyleTarget } from '@/ui/SelectionToolbar'
import { CropToolbar } from '@/ui/CropToolbar'
import { AnnotationToolbar } from '@/ui/AnnotationToolbar'
import { ANNOTATION_SIZE_RANGE, clampAnnotationSize, type SizableAnnotationTool } from '@/board/model/annotationDefaults'
import { t } from '@/i18n/t'

/** Screen-px drag distance below which an arrow-tool drag is treated as a
 * stray click, not a deliberate zero-length arrow. */
const ARROW_MIN_DRAG = 4
/** Same threshold, for the box tool. */
const BOX_MIN_DRAG = 4
/** Same threshold, for the redact tool. */
const REDACT_MIN_DRAG = 4

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

/** What `SelectionToolbar`'s settings button/popover edits for a single
 * selected annotation node - `undefined` for no selection, a multi-
 * selection, or an image (crop/duplicate/etc. cover images; they have no
 * color/size to edit). A marker has no `size` field of its own (see
 * `MarkerNode`'s note); its diameter is read straight off `frame.w`. */
function styleTargetFor(node: Board['nodes'][number] | undefined): StyleTarget | undefined {
  if (!node || node.kind === 'image') return undefined
  if (node.kind === 'redact') return { color: node.color, size: null, sizeRange: null }
  if (node.kind === 'marker') return { color: node.color, size: node.frame.w, sizeRange: ANNOTATION_SIZE_RANGE.marker }
  return { color: node.color, size: node.size, sizeRange: ANNOTATION_SIZE_RANGE[node.kind] }
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
  // Arrow-tool drag in progress: board-space start/current end point, drawn
  // as a live preview on the interaction canvas until pointer-up commits it.
  const arrowDraftRef = useRef<{ start: Point; current: Point; screenStart: { x: number; y: number } } | null>(null)
  // Box-tool drag in progress - same shape as `arrowDraftRef`, just for the
  // other one-shot annotation tool.
  const boxDraftRef = useRef<{ start: Point; current: Point; screenStart: { x: number; y: number } } | null>(null)
  // Redact-tool drag in progress - same shape as `boxDraftRef`. The preview
  // drawn from this ref is already the fully-opaque final fill (see
  // `fillRedact`), so there's nothing further to reveal once it commits.
  const redactDraftRef = useRef<{ start: Point; current: Point; screenStart: { x: number; y: number } } | null>(null)
  // The text tool's editing session - a brand-new placement (`id: null`) or
  // a re-edit of an existing node (dblclick), live only in this component's
  // state until committed on blur/Cmd+Enter or discarded on Escape. Unlike
  // arrow/box, text has no interaction-canvas preview: the textarea overlay
  // below *is* the preview, so the node it's editing is filtered out of
  // `draw()`'s render input instead (see the `editingText` reads there).
  const [editingText, setEditingText] = useState<{ id: NodeId | null; point: Point; width: number; text: string; fontSize: number } | null>(
    null,
  )
  const textEditRef = useRef<HTMLTextAreaElement>(null)
  // Flips once after the self-hosted annotation font finishes loading -
  // canvas `fillText` has no `font-display` equivalent, so a board restored
  // from autosave that already has text nodes needs one extra forced
  // redraw once the real face is ready (see render/text.ts's `ensureAnnotationFont`).
  const [fontReady, setFontReady] = useState(false)
  // Drag-to-reorder in progress (any layout mode except 'free'): the dragged
  // node floats to follow the pointer without reflowing the rest of the
  // board (computeLayout is too slow to call every pointermove - see
  // performance.spec.ts's ~50ms relayout at a dozen images), and the id of
  // whichever other node it's currently hovering, for the drop-target outline.
  const reorderRef = useRef<{ id: NodeId; startFrame: Rect; startPoint: Point } | null>(null)
  const reorderHoverRef = useRef<NodeId | null>(null)
  // A crop session (opened from SelectionToolbar's Crop button) - `bounds`
  // (the full, uncropped image's board-space rect) is fixed for the whole
  // session; `cropWindowRef` holds the live, board-space crop window and is
  // mutated directly during a handle drag (ref-first, same 60fps pattern as
  // `dragFramesRef`), read by `drawInteraction` and by `confirmCrop`. Nothing
  // commits to the store until the session's own confirm/cancel, unlike
  // every other drag in this file which commits on plain pointer-up.
  const [cropSession, setCropSession] = useState<{ id: NodeId; bounds: Rect } | null>(null)
  const cropWindowRef = useRef<Rect | null>(null)
  const cropDragRef = useRef<{ corner: Corner } | null>(null)
  const cropOverlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropToolbarRef = useRef<HTMLDivElement>(null)
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
  const setNodeColor = useBoardStore((s) => s.setNodeColor)
  const setNodeSize = useBoardStore((s) => s.setNodeSize)
  const undo = useBoardStore((s) => s.undo)
  const redo = useBoardStore((s) => s.redo)
  const tool = useBoardStore((s) => s.tool)
  const setTool = useBoardStore((s) => s.setTool)
  const addArrow = useBoardStore((s) => s.addArrow)
  const addBox = useBoardStore((s) => s.addBox)
  const commitText = useBoardStore((s) => s.commitText)
  const addMarker = useBoardStore((s) => s.addMarker)
  const addRedact = useBoardStore((s) => s.addRedact)
  const commitCrop = useBoardStore((s) => s.commitCrop)
  const toolSettings = useBoardStore((s) => s.toolSettings)
  const setToolColor = useBoardStore((s) => s.setToolColor)
  const setToolSize = useBoardStore((s) => s.setToolSize)
  const adjustToolSize = useBoardStore((s) => s.adjustToolSize)

  // Scrolling the wheel to adjust a tool's size (below) has no other on-screen
  // feedback - the change is otherwise invisible until the user actually
  // draws with it. A user testing the live site hit exactly this and asked
  // for the size to be shown while scrolling, not just after drawing. This
  // flashes a small badge near the annotation toolbar for a moment on every
  // wheel tick; `useBoardStore.getState()` (not the subscribed `toolSettings`
  // above) reads the just-updated value directly, since this effect's own
  // closure only re-registers when `tool` changes, not on every size tick.
  const [sizeHint, setSizeHint] = useState<{ tool: SizableAnnotationTool; size: number } | null>(null)
  const sizeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashSizeHint = useCallback((sizableTool: SizableAnnotationTool) => {
    setSizeHint({ tool: sizableTool, size: useBoardStore.getState().toolSettings[sizableTool].size })
    if (sizeHintTimerRef.current) clearTimeout(sizeHintTimerRef.current)
    sizeHintTimerRef.current = setTimeout(() => setSizeHint(null), 1200)
  }, [])
  useEffect(() => () => {
    if (sizeHintTimerRef.current) clearTimeout(sizeHintTimerRef.current)
  }, [])

  useEffect(() => {
    void ensureAnnotationFont().then(() => setFontReady(true))
  }, [])

  /** Opens a crop session for the single selected image node - `bounds` is
   * computed once here from the node's *current* frame/crop (see
   * `fullImageRect`) and never recomputed mid-session, so dragging a handle
   * back out always means "reveal more of this same image", not a moving
   * target. */
  const beginCrop = useCallback(() => {
    if (selectedIds.length !== 1) return
    const node = board.nodes.find((n) => n.id === selectedIds[0])
    if (!node || node.kind !== 'image') return
    const bounds = fullImageRect(node.frame, node.crop ?? FULL_CROP)
    cropWindowRef.current = node.frame
    setCropSession({ id: node.id, bounds })
  }, [selectedIds, board.nodes])

  const cancelCrop = useCallback(() => {
    setCropSession(null)
    cropWindowRef.current = null
  }, [])

  /** Commits the live crop window as the node's new `frame` plus a matching
   * normalized `crop` (see `windowToCrop`) - the two are set together so
   * they can never disagree (see `ImageNode.crop`'s own note). */
  const confirmCrop = useCallback(() => {
    if (!cropSession) return
    const cropWindow = cropWindowRef.current
    if (cropWindow) commitCrop(cropSession.id, cropWindow, windowToCrop(cropWindow, cropSession.bounds))
    setCropSession(null)
    cropWindowRef.current = null
  }, [cropSession, commitCrop])

  /** Wraps `editingText.text` with the same measurement `drawText` uses, and
   * commits it - a fresh node if it's a new placement, or the existing
   * node's frame/text if it's a re-edit. Trimmed-empty text is handled by
   * the store (`commitText`): creates nothing, or deletes the node being
   * re-edited. */
  const finishEditingText = useCallback(() => {
    if (!editingText) return
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.font = textFont(editingText.fontSize)
      const maxWidth = Math.max(1, editingText.width - TEXT_PADDING * 2)
      const lines = wrapText((s) => ctx.measureText(s).width, editingText.text, maxWidth)
      const frame = {
        x: editingText.point.x,
        y: editingText.point.y,
        w: editingText.width,
        h: textHeight(lines.length, editingText.fontSize),
      }
      commitText(editingText.id, frame, editingText.text)
    }
    setEditingText(null)
  }, [editingText, commitText])

  const cancelEditingText = useCallback(() => setEditingText(null), [])

  // Autofocus (and select any existing text, for a re-edit) exactly once
  // when a new editing session opens - `point`/`id` are fixed for the whole
  // session (only `text` changes per keystroke), so they're safe dependencies
  // that don't refire on every character typed.
  useEffect(() => {
    if (!editingText) return
    const el = textEditRef.current
    if (!el) return
    el.focus()
    el.select()
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editingText?.id, editingText?.point.x, editingText?.point.y])

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
    // The node currently open in the textarea overlay is drawn there, not
    // here - showing it on both at once would double it up (and the two
    // could visibly disagree the moment the user types past what's already
    // committed). A brand-new draft (`id: null`) was never in `input.texts`
    // to begin with; this only matters for a re-edit.
    const editingId = editingText?.id
    if (editingId != null && input.texts) {
      input.texts = input.texts.filter((t) => t.id !== editingId)
    }
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
  }, [board, viewport, editingText?.id, fontReady])

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
      // Arrows have no resize handle (see handles.ts - dragging one moves
      // the whole arrow instead), so drawing corner squares on it would
      // advertise an interaction that doesn't exist.
      if (n.kind !== 'image') continue
      ctx.fillStyle = SELECTION_COLOR
      for (const corner of CORNERS) {
        const p = boardToScreen(camera, viewport, cornerPoint(frame, corner))
        ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
      }
    }

    const arrowDraft = arrowDraftRef.current
    if (arrowDraft) {
      const a = boardToScreen(camera, viewport, arrowDraft.start)
      const b = boardToScreen(camera, viewport, arrowDraft.current)
      strokeArrow(ctx, a, b, toolSettings.arrow.color, toolSettings.arrow.size * camera.zoom)
    }

    const boxDraft = boxDraftRef.current
    if (boxDraft) {
      const a = boardToScreen(camera, viewport, boxDraft.start)
      const b = boardToScreen(camera, viewport, boxDraft.current)
      strokeBox(ctx, rectFromPoints(a, b), toolSettings.box.color, toolSettings.box.size * camera.zoom)
    }

    const redactDraft = redactDraftRef.current
    if (redactDraft) {
      const a = boardToScreen(camera, viewport, redactDraft.start)
      const b = boardToScreen(camera, viewport, redactDraft.current)
      fillRedact(ctx, rectFromPoints(a, b), toolSettings.redact.color)
    }

    // The text tool's own "preview" is the textarea overlay itself (see the
    // .text-edit element below), not anything drawn on this canvas - only
    // its screen position/size needs to track pan/zoom while it's open,
    // same ref-first reasoning as .board-page and the selection toolbar.
    const editBox = textEditRef.current
    if (editBox && editingText) {
      const topLeft = boardToScreen(camera, viewport, editingText.point)
      editBox.style.left = `${topLeft.x}px`
      editBox.style.top = `${topLeft.y}px`
      editBox.style.width = `${editingText.width * camera.zoom}px`
      editBox.style.fontSize = `${editingText.fontSize * camera.zoom}px`
      editBox.style.lineHeight = `${textLineHeight(editingText.fontSize) * camera.zoom}px`
      editBox.style.padding = `${TEXT_PADDING * camera.zoom}px`
    }

    // Positions the floating selection toolbar imperatively, same ref-first
    // reasoning as `pageRef` above - it must track the selection at 60fps
    // during a drag without going through React state. Hidden mid-gesture so
    // it doesn't float over a move/resize/marquee in progress.
    const toolbar = toolbarRef.current
    if (toolbar) {
      const dragging = !!(moveRef.current || resizeRef.current || reorderRef.current || marqueeRef.current)
      if (selectedIds.length === 0 || dragging || cropSession) {
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

    // The crop-session overlay: the full uncropped image, dimmed outside the
    // live crop window, plus the window's own resize handles - drawn on a
    // third canvas (not this one) so image content never mixes into the
    // plain selection-UI canvas above. Only non-empty while a session is
    // open (see `beginCrop`/`confirmCrop`/`cancelCrop`).
    const cropCanvas = cropOverlayCanvasRef.current
    if (cropCanvas) {
      cropCanvas.width = Math.max(1, Math.round(viewport.w * dpr))
      cropCanvas.height = Math.max(1, Math.round(viewport.h * dpr))
      cropCanvas.style.width = `${viewport.w}px`
      cropCanvas.style.height = `${viewport.h}px`
      const cropCtx = cropCanvas.getContext('2d')
      const cropWindow = cropWindowRef.current
      if (cropCtx) {
        cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height)
        if (cropSession && cropWindow) {
          const node = board.nodes.find((n) => n.id === cropSession.id)
          const asset = node && node.kind === 'image' ? assetStore.get(node.assetId) : null
          if (asset) {
            cropCtx.save()
            cropCtx.scale(dpr, dpr)
            const boundsTopLeft = boardToScreen(camera, viewport, { x: cropSession.bounds.x, y: cropSession.bounds.y })
            const bw = cropSession.bounds.w * camera.zoom
            const bh = cropSession.bounds.h * camera.zoom
            cropCtx.drawImage(asset.display, boundsTopLeft.x, boundsTopLeft.y, bw, bh)

            const winTopLeft = boardToScreen(camera, viewport, { x: cropWindow.x, y: cropWindow.y })
            const ww = cropWindow.w * camera.zoom
            const wh = cropWindow.h * camera.zoom
            cropCtx.fillStyle = 'rgba(15, 23, 42, 0.55)'
            cropCtx.fillRect(boundsTopLeft.x, boundsTopLeft.y, bw, winTopLeft.y - boundsTopLeft.y)
            cropCtx.fillRect(boundsTopLeft.x, winTopLeft.y + wh, bw, boundsTopLeft.y + bh - (winTopLeft.y + wh))
            cropCtx.fillRect(boundsTopLeft.x, winTopLeft.y, winTopLeft.x - boundsTopLeft.x, wh)
            cropCtx.fillRect(winTopLeft.x + ww, winTopLeft.y, boundsTopLeft.x + bw - (winTopLeft.x + ww), wh)

            cropCtx.strokeStyle = SELECTION_COLOR
            cropCtx.lineWidth = 2
            cropCtx.strokeRect(winTopLeft.x, winTopLeft.y, ww, wh)
            cropCtx.fillStyle = SELECTION_COLOR
            for (const corner of CORNERS) {
              const p = boardToScreen(camera, viewport, cornerPoint(cropWindow, corner))
              cropCtx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
            }
            cropCtx.restore()
          }
        }
      }
    }

    const cropToolbar = cropToolbarRef.current
    if (cropToolbar) {
      const cropWindow = cropWindowRef.current
      if (cropSession && cropWindow) {
        const topLeft = boardToScreen(camera, viewport, { x: cropWindow.x, y: cropWindow.y })
        const topRight = boardToScreen(camera, viewport, { x: cropWindow.x + cropWindow.w, y: cropWindow.y })
        cropToolbar.style.display = 'flex'
        cropToolbar.style.left = `${(topLeft.x + topRight.x) / 2}px`
        cropToolbar.style.top = `${topLeft.y}px`
      } else {
        cropToolbar.style.display = 'none'
      }
    }
  }, [board.nodes, selectedIds, viewport, editingText, cropSession, toolSettings])

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
  // While a sizable tool (arrow/box/text/marker - not redact, which has no
  // size dimension) is armed, a plain wheel adjusts that tool's size instead
  // of panning - the Lightshot-style interaction this revision adds. Ctrl/Cmd
  // still zooms even then, so the user can zoom in for precision without
  // first backing out of the armed tool.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect()
        const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        zoomByFactor(Math.exp(-e.deltaY * 0.01), anchor)
      } else if (tool !== 'select' && tool !== 'redact') {
        adjustToolSize(tool, e.deltaY > 0 ? -1 : 1)
        flashSizeHint(tool)
      } else {
        // Scrolling down should reveal content further down the board -
        // the opposite sign from a hand-drag, which moves content with the pointer.
        applyPan(panBy(cameraRef.current, -e.deltaX, -e.deltaY))
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [applyPan, zoomByFactor, tool, adjustToolSize, flashSizeHint])

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

      // A crop session is modal for this canvas: nothing else (select, move,
      // marquee, tool switching) can happen until it's confirmed or
      // cancelled, so only a handle hit on the live crop window does
      // anything at all - a click anywhere else inside the session is a
      // deliberate no-op, not a fallthrough to normal selection.
      if (cropSession) {
        const cropWindow = cropWindowRef.current
        if (cropWindow) {
          const corner = hitTestRectHandle(cropWindow, cameraRef.current, viewport, toScreenPoint(e))
          if (corner) {
            cropDragRef.current = { corner }
            canvas.setPointerCapture(e.pointerId)
          }
        }
        return
      }

      if (tool === 'arrow') {
        const point = toBoardPoint(e)
        arrowDraftRef.current = { start: point, current: point, screenStart: { x: e.clientX, y: e.clientY } }
        canvas.setPointerCapture(e.pointerId)
        return
      }

      if (tool === 'box') {
        const point = toBoardPoint(e)
        boxDraftRef.current = { start: point, current: point, screenStart: { x: e.clientX, y: e.clientY } }
        canvas.setPointerCapture(e.pointerId)
        return
      }

      if (tool === 'redact') {
        const point = toBoardPoint(e)
        redactDraftRef.current = { start: point, current: point, screenStart: { x: e.clientX, y: e.clientY } }
        canvas.setPointerCapture(e.pointerId)
        return
      }

      if (tool === 'text') {
        // No drag to track - a single click is enough to place a fixed-width
        // box (see TEXT_DEFAULT_WIDTH); the tool reverts to 'select'
        // immediately, same one-shot pattern as arrow/box, but the actual
        // store commit waits until editing finishes (see finishEditingText).
        // `preventDefault` matters here in a way it doesn't for arrow/box:
        // a plain mousedown's own default action is to shift focus to
        // document.body (canvas isn't focusable) once this event finishes
        // dispatching. Left alone, that default action fires *after* the
        // textarea below has already been created and focused (React flushes
        // the state update before the click's own trailing pointerup/mouseup
        // land), so the browser immediately blurs it again - the textarea
        // would exist for a single frame and then vanish, having "committed"
        // itself with whatever (empty) text it had at that instant.
        e.preventDefault()
        setEditingText({ id: null, point: toBoardPoint(e), width: TEXT_DEFAULT_WIDTH, text: '', fontSize: toolSettings.text.size })
        setTool('select')
        return
      }

      if (tool === 'marker') {
        // No drag to track and nothing to type - a marker's whole
        // interaction is a single click, so it commits directly on
        // pointerdown, same one-shot-then-select pattern as arrow/box/text.
        addMarker(toBoardPoint(e))
        return
      }

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
        const hitNode = board.nodes.find((n) => n.id === hitId)!
        if (hitNode.kind === 'image' && board.layout !== 'free') {
          // Still auto-arranged: dragging an *image* reorders instead of
          // moving freely (see `reorder` in the store) - only a resize
          // handle (checked above) or `setFrames` switches this board to
          // 'free'. Annotations were never part of the layout (relayout()
          // skips non-image nodes, see boardStore.ts) so they always get a
          // direct move below, on an 'auto' board or a 'free' one alike -
          // there's no "reorder position" for an arrow/box/text/marker/
          // redact to drop onto in the first place.
          setSelection([hitId])
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
      if (cropSession) {
        const drag = cropDragRef.current
        const current = cropWindowRef.current
        if (drag && current) {
          cropWindowRef.current = resizeCropWindow(current, drag.corner, toBoardPoint(e), cropSession.bounds)
          drawInteraction()
        }
        return
      }

      const arrowDraft = arrowDraftRef.current
      if (arrowDraft) {
        arrowDraftRef.current = { ...arrowDraft, current: toBoardPoint(e) }
        drawInteraction()
        return
      }

      const boxDraft = boxDraftRef.current
      if (boxDraft) {
        boxDraftRef.current = { ...boxDraft, current: toBoardPoint(e) }
        drawInteraction()
        return
      }

      const redactDraft = redactDraftRef.current
      if (redactDraft) {
        redactDraftRef.current = { ...redactDraft, current: toBoardPoint(e) }
        drawInteraction()
        return
      }

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

      if (cropSession) {
        cropDragRef.current = null
        return
      }

      const arrowDraft = arrowDraftRef.current
      if (arrowDraft) {
        arrowDraftRef.current = null
        const dragged = Math.hypot(e.clientX - arrowDraft.screenStart.x, e.clientY - arrowDraft.screenStart.y) > ARROW_MIN_DRAG
        if (dragged) addArrow(arrowDraft.start, arrowDraft.current)
        else setTool('select')
        drawInteraction()
        return
      }

      const boxDraft = boxDraftRef.current
      if (boxDraft) {
        boxDraftRef.current = null
        const dragged = Math.hypot(e.clientX - boxDraft.screenStart.x, e.clientY - boxDraft.screenStart.y) > BOX_MIN_DRAG
        if (dragged) addBox(boxDraft.start, boxDraft.current)
        else setTool('select')
        drawInteraction()
        return
      }

      const redactDraft = redactDraftRef.current
      if (redactDraft) {
        redactDraftRef.current = null
        const dragged = Math.hypot(e.clientX - redactDraft.screenStart.x, e.clientY - redactDraft.screenStart.y) > REDACT_MIN_DRAG
        if (dragged) addRedact(redactDraft.start, redactDraft.current)
        else setTool('select')
        drawInteraction()
        return
      }

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
  }, [
    board,
    viewport,
    selectedIds,
    setSelection,
    toggleSelection,
    setFrames,
    reorder,
    draw,
    drawInteraction,
    tool,
    addArrow,
    addBox,
    addMarker,
    addRedact,
    setTool,
    setEditingText,
    cropSession,
    toolSettings,
  ])

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
      // A crop session is modal (see the pointer-effect's own note) - only
      // its own confirm/cancel keys do anything while one is open, so a
      // stray Delete/D/F/tool-switch keystroke mid-session can't touch the
      // node being cropped or arm an unrelated tool underneath it.
      if (cropSession) {
        if (e.key === 'Escape') {
          e.preventDefault()
          cancelCrop()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          confirmCrop()
        }
        return
      }

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
        if (tool !== 'select') setTool('select')
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
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setTool(tool === 'arrow' ? 'select' : 'arrow')
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setTool(tool === 'box' ? 'select' : 'box')
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTool(tool === 'text' ? 'select' : 'text')
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setTool(tool === 'marker' ? 'select' : 'marker')
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setTool(tool === 'redact' ? 'select' : 'redact')
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
    tool,
    setTool,
    cropSession,
    cancelCrop,
    confirmCrop,
  ])

  // Double-click re-opens an existing text node for editing - the only way
  // to fix a typo without deleting and redrawing it (arrow/box deliberately
  // have no equivalent - see their own scope-cut notes - but text's whole
  // point is its content, so being unable to correct it is a much bigger
  // everyday loss). Only in 'select' mode, so a double-click while another
  // tool is armed can't accidentally hijack it.
  const onCanvasDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (tool !== 'select') return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const point = screenToBoard(cameraRef.current, viewport, { x: e.clientX - rect.left, y: e.clientY - rect.top })
      const hitId = hitTest(board.nodes, point)
      const node = hitId ? board.nodes.find((n) => n.id === hitId) : null
      if (!node || node.kind !== 'text') return
      setSelection([node.id])
      setEditingText({ id: node.id, point: { x: node.frame.x, y: node.frame.y }, width: node.frame.w, text: node.text, fontSize: node.size })
    },
    [tool, board.nodes, viewport, setSelection],
  )

  const onTextEditKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditingText()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        finishEditingText()
      }
    },
    [cancelEditingText, finishEditingText],
  )

  const onTextEditChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditingText((current) => (current ? { ...current, text: e.target.value } : current))
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }, [])

  // Arrows now share `board.nodes` with images (see model/types.ts), so this
  // count - used only for the a11y label below - must not count them too.
  const imageCount = board.nodes.filter((n) => n.kind === 'image').length

  // Crop only makes sense for a single selected image node - see
  // SelectionToolbar's own note on why the button itself is conditional.
  const selectedNode = selectedIds.length === 1 ? board.nodes.find((n) => n.id === selectedIds[0]) : undefined
  const canCrop = selectedNode?.kind === 'image'
  const styleTarget = styleTargetFor(selectedNode)

  const onStyleColorChange = useCallback(
    (color: string) => {
      if (selectedNode && selectedNode.kind !== 'image') setNodeColor(selectedNode.id, color)
    },
    [selectedNode, setNodeColor],
  )

  // Text is the one kind resized here rather than through `setNodeSize` -
  // a font-size change also changes the wrapped line count, which needs a
  // real `measureText` only this component has (same reasoning `commitText`'s
  // own note gives for why the store stays free of canvas/DOM dependencies).
  const onStyleSizeChange = useCallback(
    (size: number) => {
      if (!selectedNode || selectedNode.kind === 'image' || selectedNode.kind === 'redact') return
      if (selectedNode.kind === 'text') {
        const ctx = canvasRef.current?.getContext('2d')
        if (!ctx) return
        const clamped = clampAnnotationSize('text', size)
        ctx.font = textFont(clamped)
        const maxWidth = Math.max(1, selectedNode.frame.w - TEXT_PADDING * 2)
        const lines = wrapText((s) => ctx.measureText(s).width, selectedNode.text, maxWidth)
        commitText(selectedNode.id, { ...selectedNode.frame, h: textHeight(lines.length, clamped) }, selectedNode.text, clamped)
        return
      }
      setNodeSize(selectedNode.id, size)
    },
    [selectedNode, commitText, setNodeSize],
  )

  return (
    <div className="board-stage">
      <div ref={pageRef} className="board-page" />
      <canvas
        ref={canvasRef}
        className={`board-canvas${tool !== 'select' ? ' board-canvas--annotate' : ''}`}
        role="img"
        aria-label={`Board with ${imageCount} image${imageCount === 1 ? '' : 's'}`}
        onDoubleClick={onCanvasDoubleClick}
      />
      <canvas ref={interactionCanvasRef} className="board-interaction" aria-hidden="true" />
      <canvas ref={cropOverlayCanvasRef} className="board-crop-overlay" aria-hidden="true" />
      {editingText && (
        <textarea
          ref={textEditRef}
          className="text-edit"
          value={editingText.text}
          onChange={onTextEditChange}
          onKeyDown={onTextEditKeyDown}
          onBlur={finishEditingText}
          aria-label={t('annotate.text')}
        />
      )}
      <div className="selection-status visually-hidden" role="status" aria-live="polite">
        {selectedIds.length > 0 ? t('selection.count', { count: selectedIds.length }) : ''}
      </div>
      <SelectionToolbar
        ref={toolbarRef}
        onCrop={canCrop ? beginCrop : undefined}
        onDuplicate={duplicateSelected}
        onBringToFront={bringToFront}
        onDelete={deleteSelected}
        style={styleTarget}
        onStyleColorChange={onStyleColorChange}
        onStyleSizeChange={onStyleSizeChange}
      />
      <CropToolbar ref={cropToolbarRef} onConfirm={confirmCrop} onCancel={cancelCrop} />
      <ZoomControls
        percent={percent}
        onZoomOut={() => zoomByFactor(1 / ZOOM_STEP)}
        onZoomIn={() => zoomByFactor(ZOOM_STEP)}
        onReset={resetTo100}
        onFit={fitToView}
      />
      <AnnotationToolbar
        tool={tool}
        onToggleArrow={() => setTool(tool === 'arrow' ? 'select' : 'arrow')}
        onToggleBox={() => setTool(tool === 'box' ? 'select' : 'box')}
        onToggleText={() => setTool(tool === 'text' ? 'select' : 'text')}
        onToggleMarker={() => setTool(tool === 'marker' ? 'select' : 'marker')}
        onToggleRedact={() => setTool(tool === 'redact' ? 'select' : 'redact')}
        toolSettings={toolSettings}
        onColorChange={setToolColor}
        onSizeChange={setToolSize}
      />
      {sizeHint && (
        <div className="annotation-size-hint" aria-hidden="true">
          {sizeHint.size}px
        </div>
      )}
    </div>
  )
}
