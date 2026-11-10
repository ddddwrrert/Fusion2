import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStandaloneEvolve } from '../src/standalone/harness.js'
import { run as fusionLoop } from '../src/providers/fuse-loop.js'
import { run as baselineLoop } from '../src/providers/loop.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const taskDir = join(root, 'tasks', 'demo')

describe('standalone harness', () => {
  /** @type {string} */
  let runRoot

  beforeEach(async () => {
    runRoot = await mkdtemp(join(tmpdir(), 'fusion-standalone-'))
  })

  afterEach(async () => {
    await rm(runRoot, { recursive: true, force: true })
  })

  it('runs fusion mode end-to-end without DSH', async () => {
    const { evolve, init } = createStandaloneEvolve({
      taskDir,
      runRoot,
      maxBudget: 3,
      mode: 'fusion',
    })
    await init()
    const result = await fusionLoop({}, evolve)
    expect(result.best_fitness).toBeGreaterThanOrEqual(0)
    expect(result.best_id).toMatch(/^c/)
  })

  it('runs baseline mode end-to-end without DSH', async () => {
    const { evolve, init } = createStandaloneEvolve({
      taskDir,
      runRoot,
      maxBudget: 3,
      mode: 'baseline',
    })
    await init()
    const result = await baselineLoop({}, evolve)
    expect(result.best_id).toBeTruthy()
  })
})
