import { describe, expect, it } from 'vitest'
import type { BubbleCloudDatum } from '../../data/metrics'
import { packBubbleValues } from './BubbleCloudChart'

const data: BubbleCloudDatum[] = [
  { key: 'a', label: 'A', value: 100 },
  { key: 'b', label: 'B', value: 25 },
  { key: 'c', label: 'C', value: 4 },
  { key: 'd', label: 'D', value: 1 },
]

describe('packBubbleValues', () => {
  it('makes circle area proportional to value without a minimum-radius floor', () => {
    const packed = new Map(packBubbleValues(data).map((bubble) => [bubble.key, bubble]))
    const a = packed.get('a')!
    const b = packed.get('b')!
    const c = packed.get('c')!

    expect((a.radius ** 2) / (b.radius ** 2)).toBeCloseTo(100 / 25, 8)
    expect((a.radius ** 2) / (c.radius ** 2)).toBeCloseTo(100 / 4, 8)
  })

  it('packs every circle without overlap inside the chart bounds', () => {
    const packed = packBubbleValues(data)

    for (const bubble of packed) {
      expect(bubble.x - bubble.radius).toBeGreaterThanOrEqual(0)
      expect(bubble.y - bubble.radius).toBeGreaterThanOrEqual(0)
      expect(bubble.x + bubble.radius).toBeLessThanOrEqual(640)
      expect(bubble.y + bubble.radius).toBeLessThanOrEqual(640)
    }

    for (let left = 0; left < packed.length; left++) {
      for (let right = left + 1; right < packed.length; right++) {
        const a = packed[left]!
        const b = packed[right]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          a.radius + b.radius,
        )
      }
    }
  })

  it('recomputes positions when values change', () => {
    const first = new Map(packBubbleValues(data).map((bubble) => [bubble.key, bubble]))
    const changed = data.map((item) =>
      item.key === 'd' ? { ...item, value: 80 } : item,
    )
    const second = new Map(packBubbleValues(changed).map((bubble) => [bubble.key, bubble]))

    expect(
      data.some((item) => {
        const before = first.get(item.key)!
        const after = second.get(item.key)!
        return Math.hypot(before.x - after.x, before.y - after.y) > 1
      }),
    ).toBe(true)
  })
})
