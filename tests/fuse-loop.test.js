import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run as fuseLoopRun } from '../src/providers/fuse-loop.js'
import { requested, installFusionProviders } from '../src/install.js'
import { buildInstruction } from '../src/providers/fuse-mutate.js'

function createMockEvolve(root) {
  const rows = []
  let nextId = 1
  let remaining = 2
  const abort = { aborted: false, throwIfAborted() {} }

  return {
    runRoot: root,
    population() {
      return {
        async rows() {
          return [...rows]
        },
        async append(row) {
          rows.push(row)
        },
      }
    },
    currentRun() {
      return { signal: abort }
    },
    async context() {
      return {
        maxPopulation: 10,
        candidates: 2,
        budget: { remaining },
      }
    },
    async copyTask() {
      const id = 'c000000'
      const dir = join(root, 'candidates', id)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'solution.cpp'), '#EVOLVE_START\nint a=0;\n#EVOLVE_END\n', 'utf8')
      return { id, dir }
    },
    async select() {
      return rows[rows.length - 1].id
    },
    async mutate({ parent, fuseKt }) {
      remaining -= 1
      const id = `c${String(nextId).padStart(6, '0')}`
      nextId += 1
      const dir = join(root, 'candidates', id)
      await mkdir(dir, { recursive: true })
      const bump = nextId
      await writeFile(
        join(dir, 'solution.cpp'),
        `#EVOLVE_START\nint a=${bump};\n#EVOLVE_END\n`,
        'utf8',
      )
      return { id, dir, fusion: { evidence_ids: fuseKt?.evidence_ids ?? [] } }
    },
    async evaluate(candidate) {
      // Newer ids score higher so chain can append.
      const n = Number(String(candidate.id).replace(/\D/g, '')) || 0
      return n
    },
    async survive() {},
    register() {
      return () => {}
    },
  }
}

describe('install + mutate instruction', () => {
  it('requested parses env flag', () => {
    expect(requested({ DSH_EVOLVE_FUSION2: '1' })).toBe(true)
    expect(requested({ DSH_EVOLVE_FUSION2: 'off' })).toBe(false)
  })

  it('installFusionProviders registers loop and mutate', () => {
    const registered = []
    const evolve = {
      register(slot, provider) {
        registered.push(`${slot}=${provider.name}`)
        return () => {}
      },
    }
    const { installed, dispose } = installFusionProviders(evolve)
    expect(installed).toEqual(['loop=fusion2-loop', 'mutate=fusion2-mutate'])
    expect(evolve.fusion2.installed).toEqual(installed)
    dispose()
    expect(evolve.fusion2).toBeUndefined()
  })

  it('buildInstruction embeds K_t text', () => {
    const text = buildInstruction(3.5, { text: '[FUSED CONTEXT]\nweak region A' })
    expect(text).toContain('3.5')
    expect(text).toContain('weak region A')
  })
})

describe('fusion-loop', () => {
  /** @type {string} */
  let root

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fusion-loop-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('runs select→fuse→mutate→evaluate→commit', async () => {
    const evolve = createMockEvolve(root)
    const result = await fuseLoopRun({}, evolve)
    expect(result.best_id).toBeTruthy()
    expect(result.best_fitness).toBeGreaterThan(0)

    const working = JSON.parse(await readFile(join(root, 'fuse', 'working.json'), 'utf8'))
    expect(working.child).toBeTruthy()
    expect(['up', 'flat', 'down']).toContain(working.outcome)
  })
})
