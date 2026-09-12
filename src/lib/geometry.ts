export interface Size {
  w: number
  h: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export const aspect = (s: Size): number => (s.h === 0 ? 1 : s.w / s.h)

/** Largest size with `natural`'s aspect ratio that fits inside `box`. Never upscales. */
export function fitContain(natural: Size, box: Size, allowUpscale = false): Size {
  const scale = Math.min(box.w / natural.w, box.h / natural.h)
  const s = allowUpscale ? scale : Math.min(1, scale)
  return { w: Math.round(natural.w * s), h: Math.round(natural.h * s) }
}

/** Scale a size to an exact width, preserving aspect ratio. Never upscales unless asked. */
export function scaleToWidth(natural: Size, width: number, allowUpscale = false): Size {
  const target = allowUpscale ? width : Math.min(width, natural.w)
  return { w: Math.round(target), h: Math.round((target / natural.w) * natural.h) }
}

export function boundsOf(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export const translate = (r: Rect, dx: number, dy: number): Rect => ({ ...r, x: r.x + dx, y: r.y + dy })

export const translatePoint = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy })

/** Normalizes two corners (dragged in any direction) into a positive-size rect. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
