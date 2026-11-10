/**
 * Minimal evolve-service harness so Fusion runs without DSH / dsh-evolve-loop.
 * Implements the subset of the Organon evolve API that fusion-loop needs:
 *   context, population, currentRun, copyTask, select, mutate, evaluate,
 *   survive, allocate, spawnWorker, register, runRoot
 */

import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { select as baselineSelect } from '../baseline/select.js'
import { survive as baselineSurvive } from '../baseline/survive.js'
import { mutate as baselineMutate } from '../baseline/mutate.js'
import { mutate as fusionMutate } from '../providers/fuse-mutate.js'
import { merit } from '../population.js'

/**
 * @param {object} options
 * @param {string} options.taskDir
 * @param {string} options.runRoot
 * @param {number} [options.maxBudget=5]
 * @param {number} [options.maxPopulation=8]
 * @param {number} [options.k=5]
 * @param {number} [options.candidates]
 * @param {'fusion'|'baseline'} [options.mode='fusion']
 * @param {(candidate: {id:string,dir:string}, evolve: object) => Promise<number>} [options.evaluateFn]
 * @param {(dir: string, instruction: string, opts: object) => Promise<void>} [options.spawnWorkerFn]
 */
export function createStandaloneEvolve(options) {
  const {
    taskDir,
    runRoot,
    maxBudget = 5,
    maxPopulation = 8,
    k = 5,
    candidates,
    mode = 'fusion',
    evaluateFn,
    spawnWorkerFn,
  } = options

  /** @type {Array<object>} */
  let rows = []
  let remaining = maxBudget
  let seq = 0
  const providers = {
    select: baselineSelect,
    survive: baselineSurvive,
    mutate: mode === 'baseline' ? baselineMutate : fusionMutate,
  }

  const abort = {
    aborted: false,
    throwIfAborted() {
      if (this.aborted) throw new Error('aborted')
    },
  }

  const populationPath = join(runRoot, 'population.jsonl')

  async function persist() {
    await mkdir(runRoot, { recursive: true })
    const body = rows.map(r => JSON.stringify(r)).join('\n')
    await writeFile(populationPath, body ? `${body}\n` : '', 'utf8')
  }

  async function loadPopulation() {
    try {
      const raw = await readFile(populationPath, 'utf8')
      rows = raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    } catch {
      rows = []
    }
  }

  const evolve = {
    runRoot,
    cwd: taskDir,
    files: { root: runRoot },

    population() {
      return {
        rows: async () => [...rows],
        append: async (row) => {
          rows.push(row)
          await persist()
        },
        markDead: async (id) => {
          const row = rows.find(r => r.id === id)
          if (row) row.survival = 'no'
          await persist()
        },
        persist,
      }
    },

    currentRun() {
      return { signal: abort }
    },

    async context() {
      return {
        maxPopulation,
        k,
        candidates: candidates ?? maxBudget,
        budget: { remaining, max: maxBudget },
      }
    },

    register(slot, provider) {
      providers[slot] = provider
      return () => {
        delete providers[slot]
      }
    },

    async copyTask() {
      await mkdir(join(runRoot, 'candidates'), { recursive: true })
      const id = 'c000000'
      const dir = join(runRoot, 'candidates', id)
      await cp(taskDir, dir, { recursive: true })
      return { id, dir }
    },

    async allocate(parentId) {
      remaining -= 1
      seq += 1
      const id = `c${String(seq).padStart(6, '0')}`
      const dir = join(runRoot, 'candidates', id)
      const parentDir = join(runRoot, 'candidates', parentId)
      await cp(parentDir, dir, { recursive: true })
      return { id, dir }
    },

    async spawnWorker(dir, instruction, opts = {}) {
      if (spawnWorkerFn) {
        await spawnWorkerFn(dir, instruction, opts)
        return
      }
      // Default offline worker: bump a counter inside #EVOLVE block (deterministic demo).
      const solPath = join(dir, 'solution.cpp')
      let text = ''
      try {
        text = await readFile(solPath, 'utf8')
      } catch {
        text = '// demo\n#EVOLVE_START\nint score_hint = 0;\n#EVOLVE_END\n'
      }
      const next = (text.match(/score_hint\s*=\s*(\d+)/)?.[1]
        ? Number(text.match(/score_hint\s*=\s*(\d+)/)[1]) + 1
        : 1)
      const evolved = text.includes('#EVOLVE_START')
        ? text.replace(
          /#EVOLVE_START[\s\S]*?#EVOLVE_END/,
          `#EVOLVE_START\nint score_hint = ${next};\n#EVOLVE_END`,
        )
        : `${text}\n#EVOLVE_START\nint score_hint = ${next};\n#EVOLVE_END\n`
      await writeFile(solPath, evolved, 'utf8')
      await writeFile(join(dir, 'worker_instruction.txt'), String(instruction ?? ''), 'utf8')
    },

    async select(population) {
      const fn = providers.select?.select ?? providers.select
      return fn(population, evolve)
    },

    async mutate(options) {
      const fn = providers.mutate?.mutate ?? providers.mutate
      return fn(options, evolve)
    },

    async evaluate(candidate) {
      if (evaluateFn) return evaluateFn(candidate, evolve)
      // Default offline evaluator: parse score_hint from solution.cpp
      try {
        const text = await readFile(join(candidate.dir, 'solution.cpp'), 'utf8')
        const m = text.match(/score_hint\s*=\s*(\d+)/)
        return m ? Number(m[1]) : 0
      } catch {
        return 0
      }
    },

    async survive(population) {
      const fn = providers.survive?.survive ?? providers.survive
      return fn(population, evolve)
    },
  }

  return {
    evolve,
    async init() {
      await mkdir(runRoot, { recursive: true })
      await access(taskDir)
      await loadPopulation()
      return evolve
    },
    merit,
  }
}
