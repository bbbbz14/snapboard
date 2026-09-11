import { describe, it, expect } from 'vitest'
import { moveToFront } from '@/board/model/zorder'

function items(ids: string[]): { id: string }[] {
  return ids.map((id) => ({ id }))
}

describe('moveToFront', () => {
  it('moves a single id to the end', () => {
    const result = moveToFront(items(['a', 'b', 'c', 'd']), new Set(['b']))
    expect(result.map((n) => n.id)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('moves multiple ids to the end, preserving their relative order', () => {
    const result = moveToFront(items(['a', 'b', 'c', 'd']), new Set(['a', 'c']))
    expect(result.map((n) => n.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('is a no-op when the selection is already at the end', () => {
    const result = moveToFront(items(['a', 'b', 'c', 'd']), new Set(['d']))
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('leaves order unchanged when nothing is selected', () => {
    const result = moveToFront(items(['a', 'b', 'c']), new Set())
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })
})
