/**
 * Offline smoke: run fusion-loop against an in-memory mock evolve service.
 * No DSH / LLM required.
 */

import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run as fuseLoopRun } from '../src/providers/fuse-loop.js'

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'fusion-example-'))
  let remaining = 3
  let nextId = 1
  const rows = []

  const evolve = {
    runRoot: root,
    population: () => ({
      rows: async () => [...rows],
      append: async (row) => { rows.push(row) },
    }),
    currentRun: () => ({ signal: { aborted: false, throwIfAborted() {} } }),
    context: async () => ({
      maxPopulation: 8,
      candidates: 3,
      budget: { remaining },
    }),
    copyTask: async () => {
      const id = 'c000000'
      const dir = join(root, 'candidates', id)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'solution.cpp'), '#EVOLVE_START\nint a=0;\n#EVOLVE_END\n')
      return { id, dir }
    },
    select: async () => rows[rows.length - 1].id,
    mutate: async ({ parent, fuseKt }) => {
      remaining -= 1
      const id = `c${String(nextId).padStart(6, '0')}`
      nextId += 1
      const dir = join(root, 'candidates', id)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'solution.cpp'), `#EVOLVE_START\nint a=${nextId};\n#EVOLVE_END\n`)
      console.log(`[mutate] parent=${parent} evidence=${(fuseKt?.evidence_ids ?? []).join(',') || '(none)'}`)
      return { id, dir }
    },
    evaluate: async (c) => Number(String(c.id).replace(/\D/g, '')) || 0,
    survive: async () => {},
  }

  try {
    const result = await fuseLoopRun({}, evolve)
    console.log('[result]', result)
    const working = await readFile(join(root, 'fuse', 'working.json'), 'utf8')
    console.log('[working]', working.trim())
    try {
      const chain = await readFile(join(root, 'fuse', 'chain.jsonl'), 'utf8')
      console.log('[chain lines]', chain.trim().split(/\n/).length)
    } catch {
      console.log('[chain] (empty)')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
