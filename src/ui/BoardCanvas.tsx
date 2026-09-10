import { useEffect, useRef } from 'react'
import { renderScene } from '@/board/render/renderScene'
import { TileCache } from '@/board/render/tileCache'
import { toRenderInput } from '@/board/store/boardStore'
import type { Board } from '@/board/model/types'

/** 3x displays cost 2.25x the fill rate of 2x for no visible gain here. */
const MAX_DPR = 2

interface Props {
  board: Board
  /** Space the canvas may occupy on screen, in CSS pixels. */
  viewport: { w: number; h: number }
}

export function BoardCanvas({ board, viewport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tilesRef = useRef(new TileCache())

  // Shrink to fit, never enlarge: a small board should not be blown up.
  const fit = Math.min(1, viewport.w / board.size.w, viewport.h / board.size.h)
  const cssW = Math.max(1, Math.round(board.size.w * fit))
  const cssH = Math.max(1, Math.round(board.size.h * fit))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const renderScale = fit * dpr

    canvas.width = Math.max(1, Math.round(board.size.w * renderScale))
    canvas.height = Math.max(1, Math.round(board.size.h * renderScale))
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tiles = tilesRef.current
    tiles.setRatio(renderScale)
    const input = toRenderInput(board)
    tiles.retain(input.items.map((i) => i.id))
    renderScene(ctx, input, { scale: renderScale, tiles })
  }, [board, fit, cssW, cssH])

  return (
    <canvas
      ref={canvasRef}
      className="board-canvas"
      role="img"
      aria-label={`Board with ${board.nodes.length} image${board.nodes.length === 1 ? '' : 's'}`}
    />
  )
}
