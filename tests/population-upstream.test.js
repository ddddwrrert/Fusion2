import { describe, expect, it } from 'vitest'
import { alive, merit } from '../src/lib/population.js'

describe('population helpers (must match dsh-evolve-loop)', () => {
  it('alive keeps survival===yes only', () => {
    expect(alive([
      { id: 'a', survival: 'yes' },
      { id: 'b', survival: 'no' },
      { id: 'c' },
    ]).map(r => r.id)).toEqual(['a'])
  })

  it('merit matches upstream formula', () => {
    expect(merit(10)).toBe(10)
    expect(merit(0)).toBe(0)
    expect(merit(-5)).toBeCloseTo(0.2)
    expect(merit(-20)).toBeCloseTo(0.05)
    expect(merit(-5)).toBeGreaterThan(merit(-20))
  })
})
