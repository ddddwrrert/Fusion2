import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unifiedDiff } from '../src/fuse/diff.js'
import { outcomeOf, saveWorking, loadWorking } from '../src/fuse/working.js'
import { maybeAppendChain, loadRecentChain } from '../src/fuse/chain.js'
import { commit } from '../src/fuse/commit.js'

describe('diff', () => {
  it('returns empty for identical texts', () => {
    expect(unifiedDiff('a\nb\n', 'a\nb\n')).toBe('')
  })

  it('emits unified hunk for changes', () => {
    const patch = unifiedDiff('a\n', 'a\nb\n', 'old', 'new')
    expect(patch).toContain('--- old')
    expect(patch).toContain('+++ new')
    expect(patch).toContain('+b')
  })
})

describe('working + chain + commit', () => {
  /** @type {string} */
  let root
  /** @type {object} */
  let evolve

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fusion-'))
    await mkdir(join(root, 'candidates', 'c0'), { recursive: true })
    await mkdir(join(root, 'candidates', 'c1'), { recursive: true })
    await writeFile(join(root, 'candidates', 'c0', 'solution.cpp'), '// parent\nint x=1;\n', 'utf8')
    await writeFile(join(root, 'candidates', 'c1', 'solution.cpp'), '// child\nint x=2;\n', 'utf8')
    evolve = { runRoot: root }
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('outcomeOf classifies deltas', () => {
    expect(outcomeOf(10, 12)).toBe('up')
    expect(outcomeOf(10, 10)).toBe('flat')
    expect(outcomeOf(10, 8)).toBe('down')
    expect(outcomeOf(10, NaN)).toBe('error')
  })

  it('overwrites working each save', async () => {
    await saveWorking(evolve, { parent: 'c0', child: 'c1', outcome: 'down', delta: -1 })
    await saveWorking(evolve, { parent: 'c0', child: 'c1', outcome: 'up', delta: 2 })
    const w = await loadWorking(evolve)
    expect(w.outcome).toBe('up')
    expect(w.delta).toBe(2)
  })

  it('appends chain only on strict improvement', async () => {
    const skip = await maybeAppendChain(evolve, {
      parent: 'c0',
      child: 'c1',
      fitness: 5,
      parentFitness: 10,
    })
    expect(skip).toBeNull()

    const node = await maybeAppendChain(evolve, {
      parent: 'c0',
      child: 'c1',
      fitness: 12,
      parentFitness: 10,
    })
    expect(node).not.toBeNull()
    expect(node.patch).toContain('+')
    const recent = await loadRecentChain(evolve, 5)
    expect(recent).toHaveLength(1)
  })

  it('commit writes working and chain on up', async () => {
    const result = await commit(evolve, {
      parent: 'c0',
      child: 'c1',
      fitness: 20,
      parentFitness: 10,
      kt: { evidence_ids: ['abc'], text: 'hi' },
    })
    expect(result.working.outcome).toBe('up')
    expect(result.chain).not.toBeNull()
    const w = await loadWorking(evolve)
    expect(w.evidence_ids).toEqual(['abc'])
  })
})
