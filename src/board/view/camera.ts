import type { Point, Size } from '@/lib/geometry'
import { clamp } from '@/lib/geometry'

/**
 * Pure camera math for the preview viewport. Lives outside the `Board` model
 * on purpose: undo/autosave snapshot `Board`, and the camera is not part of
 * what the user is arranging - it is just where they are currently looking.
 * See invariant 4 ("layout: 'free' is sacred") and the Board undo strategy in
 * CLAUDE.md; neither should ever have to know the zoom level.
 */
export interface Camera {
  /** Board units -> CSS px. */
  zoom: number
  /** The board-space point currently at the centre of the viewport. */
  center: Point
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export const clampZoom = (zoom: number): number => clamp(zoom, MIN_ZOOM, MAX_ZOOM)

/**
 * Zoom that fits the whole board inside the viewport, leaving `margin` CSS px
 * of breathing room on each side. Never upscales past 100% - a small board
 * stays small rather than being blown up to fill the window (same rule as
 * `ALLOW_UPSCALE = false` for images, applied to the camera instead).
 */
export function fitZoom(board: Size, viewport: Size, margin = 0): number {
  const w = Math.max(1, viewport.w - margin * 2)
  const h = Math.max(1, viewport.h - margin * 2)
  return Math.min(1, w / board.w, h / board.h)
}

export function fitCamera(board: Size, viewport: Size, margin = 0): Camera {
  return { zoom: fitZoom(board, viewport, margin), center: { x: board.w / 2, y: board.h / 2 } }
}

/** Board-space point -> CSS px within the viewport. */
export function boardToScreen(camera: Camera, viewport: Size, p: Point): Point {
  return {
    x: viewport.w / 2 + (p.x - camera.center.x) * camera.zoom,
    y: viewport.h / 2 + (p.y - camera.center.y) * camera.zoom,
  }
}

/** CSS px within the viewport -> board-space point. Inverse of `boardToScreen`. */
export function screenToBoard(camera: Camera, viewport: Size, p: Point): Point {
  return {
    x: camera.center.x + (p.x - viewport.w / 2) / camera.zoom,
    y: camera.center.y + (p.y - viewport.h / 2) / camera.zoom,
  }
}

/**
 * Zooms by `factor`, keeping the board point currently under `screenAnchor`
 * pinned to that same screen position - the standard "zoom under the cursor"
 * feel for wheel/pinch gestures.
 */
export function zoomAt(camera: Camera, viewport: Size, screenAnchor: Point, factor: number): Camera {
  const zoom = clampZoom(camera.zoom * factor)
  const anchorBoard = screenToBoard(camera, viewport, screenAnchor)
  return {
    zoom,
    center: {
      x: anchorBoard.x - (screenAnchor.x - viewport.w / 2) / zoom,
      y: anchorBoard.y - (screenAnchor.y - viewport.h / 2) / zoom,
    },
  }
}

/** Pans by a screen-space delta (e.g. drag or wheel deltaX/Y), in CSS px. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { zoom: camera.zoom, center: { x: camera.center.x - dx / camera.zoom, y: camera.center.y - dy / camera.zoom } }
}
