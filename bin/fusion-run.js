#!/usr/bin/env node
/**
 * Clone-and-run entrypoint (no DSH required).
 *
 *   node bin/fusion-run.js
 *   node bin/fusion-run.js --mode baseline --budget 5
 *   node bin/fusion-run.js --task ./tasks/demo --run ./run
 */

import { mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStandaloneEvolve } from '../src/standalone/harness.js'
import { run as fusionLoop } from '../src/providers/fuse-loop.js'
import { run as baselineLoop } from '../src/baseline/loop.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function parseArgs(argv) {
  const out = {
    mode: 'fusion',
    budget: 5,
    task: join(root, 'tasks', 'demo'),
    run: join(root, 'run'),
    clean: false,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--mode') out.mode = argv[++i]
    else if (a === '--budget') out.budget = Number(argv[++i])
    else if (a === '--task') out.task = resolve(argv[++i])
    else if (a === '--run') out.run = resolve(argv[++i])
    else if (a === '--clean') out.clean = true
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    console.log(`Fusion standalone runner

Usage:
  npm start
  node bin/fusion-run.js [--mode fusion|baseline] [--budget N] [--task DIR] [--run DIR] [--clean]

Defaults:
  --mode fusion
  --task tasks/demo
  --run  ./run
`)
    return
  }

  if (args.clean) {
    await rm(args.run, { recursive: true, force: true })
  }
  await mkdir(args.run, { recursive: true })

  const { evolve, init } = createStandaloneEvolve({
    taskDir: args.task,
    runRoot: args.run,
    maxBudget: args.budget,
    mode: args.mode === 'baseline' ? 'baseline' : 'fusion',
  })
  await init()

  const loop = args.mode === 'baseline' ? baselineLoop : fusionLoop
  console.log(`[fusion-run] mode=${args.mode} budget=${args.budget}`)
  console.log(`[fusion-run] task=${args.task}`)
  console.log(`[fusion-run] run=${args.run}`)

  const result = await loop({}, evolve)
  console.log('[fusion-run] result', result)
  console.log(`[fusion-run] ledgers under ${join(args.run, 'fuse')} (fusion mode)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
