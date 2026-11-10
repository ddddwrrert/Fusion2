/**
 * Slow-layer Coding memory: append-only true diff chain (zero LLM).
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { fusePaths } from './paths.js'
import { unifiedDiff } from './diff.js'
import { candidateDir, readSolution } from './evidence.js'

/**
 * @param {object} evolve
 * @param {number} [limit=2]
 * @returns {Promise<Array<object>>}
 */
export async function loadRecentChain(evolve, limit = 2) {
  const { chain } = fusePaths(evolve)
  try {
    const raw = await readFile(chain, 'utf8')
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const nodes = []
    for (const line of lines) {
      try {
        nodes.push(JSON.parse(line))
      } catch {
        // skip corrupt
      }
    }
    return nodes.slice(-Math.max(0, limit))
  } catch {
    return []
  }
}

/**
 * Append a chain node only when fitness strictly beats parent.
 * @param {object} evolve
 * @param {object} args
 * @param {string} args.parent
 * @param {string} args.child
 * @param {number} args.fitness
 * @param {number} [args.parentFitness]
 * @param {object} [args.kt]
 * @returns {Promise<object|null>} appended node or null if skipped
 */
export async function maybeAppendChain(evolve, args) {
  const { parent, child, fitness, parentFitness, kt } = args
  if (typeof fitness !== 'number' || !Number.isFinite(fitness)) return null
  if (typeof parentFitness === 'number' && Number.isFinite(parentFitness)) {
    if (!(fitness > parentFitness)) return null
  }

  const parentSol = await readSolution(candidateDir(evolve, parent))
  const childSol = await readSolution(candidateDir(evolve, child))
  if (!parentSol || !childSol) return null

  const patch = unifiedDiff(
    parentSol.text,
    childSol.text,
    `candidates/${parent}`,
    `candidates/${child}`,
  )
  if (!patch) return null

  const node = {
    ts: new Date().toISOString(),
    parent,
    child,
    fitness,
    parent_fitness: parentFitness ?? null,
    patch,
    kt_ref: kt?.evidence_ids ?? [],
  }

  const { chain, root } = fusePaths(evolve)
  await mkdir(root, { recursive: true })
  await appendFile(chain, `${JSON.stringify(node)}\n`, 'utf8')
  return node
}
