import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deriveFromStep,
  detectRepeatFailure,
  patchFingerprint,
} from '../src/fuse/breakthrough.js'
import { commit } from '../src/fuse/commit.js'
import { fuseGate, rankEvidence } from '../src/fuse/gate.js'
import { collectEvidence } from '../src/fuse/evidence.js'
import { traceRequested } from '../src/install.js'

describe('breakthrough rules', () => {
  it('derives breakthrough on up + patch', () => {
    const { breakthrough, failure_signal } = deriveFromStep({
      parent: 'c0',
      child: 'c1',
      delta: 2,
      outcome: 'up',
      patch: '--- a\n+++ b\n@@\n-x\n+y\n',
      fitness: 12,
      parentFitness: 10,
    })
    expect(breakthrough).not.toBeNull()
    expect(breakthrough.claim).toMatch(/raised/)
    expect(failure_signal).toBeNull()
  })

  it('detects repeat failure streak', () => {
    const fp = patchFingerprint('+a\n-b\n')
    const repeat = detectRepeatFailure([
      { outcome: 'down', patch_fp: fp },
      { outcome: 'flat', patch_fp: fp },
    ], 2)
    expect(repeat).not.toBeNull()
    expect(repeat.same_patch_fp).toBe(true)
  })

  it('ranks breakthrough before deficit', () => {
    const ranked = rankEvidence([
      { id: 'd', type: 'deficit', trust: 'inferred', payload: {} },
      { id: 'b', type: 'breakthrough', trust: 'exact', payload: {} },
    ])
    expect(ranked[0].id).toBe('b')
  })

  it('renders breakthrough in K_t', () => {
    const kt = fuseGate([
      {
        id: 'b1',
        type: 'breakthrough',
        trust: 'exact',
        payload: {
          claim: 'accepted patch raised official fitness',
          delta: 1,
          parent: 'c0',
          child: 'c1',
          patch_excerpt: '+int x=2;\n',
        },
      },
    ])
    expect(kt.text).toContain('[breakthrough]')
    expect(kt.evidence_ids).toContain('b1')
  })
})

describe('commit provenance', () => {
  /** @type {string} */
  let root
  /** @type {object} */
  let evolve

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fusion2-'))
    await mkdir(join(root, 'candidates', 'c0'), { recursive: true })
    await mkdir(join(root, 'candidates', 'c1'), { recursive: true })
    await writeFile(join(root, 'candidates', 'c0', 'solution.cpp'), 'int x=1;\n', 'utf8')
    await writeFile(join(root, 'candidates', 'c1', 'solution.cpp'), 'int x=2;\n', 'utf8')
    evolve = { runRoot: root }
    delete process.env.DSH_EVOLVE_FUSION2_TRACE
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    delete process.env.DSH_EVOLVE_FUSION2_TRACE
  })

  it('traceRequested defaults on', () => {
    expect(traceRequested({})).toBe(true)
    expect(traceRequested({ DSH_EVOLVE_FUSION2_TRACE: '0' })).toBe(false)
  })

  it('commit writes trace and breakthrough on up', async () => {
    const result = await commit(evolve, {
      parent: 'c0',
      child: 'c1',
      fitness: 20,
      parentFitness: 10,
      kt: { evidence_ids: ['x'] },
    })
    expect(result.provenance?.breakthrough).not.toBeNull()
    const trace = JSON.parse(await readFile(join(root, 'fuse', 'trace', 'c1.json'), 'utf8'))
    expect(trace.outcome).toBe('up')
    expect(trace.patch).toContain('+')
    const state = JSON.parse(await readFile(join(root, 'fuse', 'breakthrough.json'), 'utf8'))
    expect(state.breakthrough.child).toBe('c1')

    const evidence = await collectEvidence({ parentId: 'c1', evolve, rows: [
      { id: 'c0', fitness: 10, survival: 'yes' },
      { id: 'c1', fitness: 20, survival: 'yes' },
    ] })
    expect(evidence.some(e => e.type === 'breakthrough')).toBe(true)
  })
})
