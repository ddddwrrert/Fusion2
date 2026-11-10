import { describe, expect, it } from 'vitest'
import { fuseGate, rankEvidence } from '../src/fuse/gate.js'

describe('gate', () => {
  it('ranks deficit before working', () => {
    const ranked = rankEvidence([
      { id: 'w', type: 'working', trust: 'exact', payload: {} },
      { id: 'd', type: 'deficit', trust: 'inferred', payload: {} },
    ])
    expect(ranked[0].id).toBe('d')
  })

  it('builds bounded K_t with evidence ids', () => {
    const kt = fuseGate([
      { id: 's1', type: 'score', trust: 'exact', payload: { fitness: 10 } },
      {
        id: 'd1',
        type: 'deficit',
        trust: 'inferred',
        payload: {
          parent_fitness: 10,
          best_id: 'c2',
          best_fitness: 20,
          gap: 10,
          note: 'close the gap',
        },
      },
    ], { parentId: 'c1', maxChars: 4000 })

    expect(kt.evidence_ids).toContain('d1')
    expect(kt.evidence_ids).toContain('s1')
    expect(kt.text).toContain('FUSED CONTEXT')
    expect(kt.text).toContain('close the gap')
    expect(kt.truncated).toBe(false)
  })

  it('truncates when over budget', () => {
    const bigPatch = 'x'.repeat(2000)
    const kt = fuseGate([
      {
        id: 'sib',
        type: 'sibling_diff',
        trust: 'exact',
        payload: { peer_id: 'c9', peer_fitness: 99, patch: bigPatch },
      },
      {
        id: 'chain',
        type: 'chain_diff',
        trust: 'exact',
        payload: { parent: 'a', child: 'b', fitness: 1, patch: bigPatch },
      },
    ], { maxChars: 800 })

    expect(kt.truncated).toBe(true)
    expect(kt.evidence_ids.length).toBeLessThan(2)
  })
})
