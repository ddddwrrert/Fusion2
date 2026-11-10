/**
 * Collect multi-source Evidence objects for gate fusion.
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unifiedDiff } from './diff.js'
import { loadWorking } from './working.js'
import { loadRecentChain } from './chain.js'
import { loadBreakthroughState } from './breakthrough.js'
import { resolveRunRoot } from './paths.js'
import { alive, merit } from '../population.js'
import { traceRequested } from '../install.js'

const SOLUTION_NAMES = [
  'solution.cpp', 'Main.cpp', 'main.cpp', 'sol.cpp',
  'solution.py', 'main.py', 'solution.js',
]

/**
 * @param {string} seed
 * @returns {string}
 */
function eid(seed) {
  return createHash('sha1').update(seed).digest('hex').slice(0, 12)
}

/**
 * @param {string} dir
 * @returns {Promise<{ path: string, text: string }|null>}
 */
async function readSolution(dir) {
  for (const name of SOLUTION_NAMES) {
    const path = join(dir, name)
    try {
      const text = await readFile(path, 'utf8')
      return { path, text }
    } catch {
      // try next
    }
  }
  return null
}

/**
 * @param {object} evolve
 * @param {string} id
 * @returns {string}
 */
function candidateDir(evolve, id) {
  const root = resolveRunRoot(evolve)
  return join(root, 'candidates', id)
}

/**
 * @param {object} options
 * @param {string} options.parentId
 * @param {object} options.evolve
 * @param {Array<object>} [options.rows]
 * @returns {Promise<Array<object>>}
 */
export async function collectEvidence(options) {
  const { parentId, evolve } = options
  const rows = options.rows ?? (await evolve.population().rows())
  const parent = rows.find(r => r.id === parentId)
  const evidence = []

  if (parent && typeof parent.fitness === 'number' && Number.isFinite(parent.fitness)) {
    evidence.push({
      id: eid(`score:${parentId}:${parent.fitness}`),
      type: 'score',
      trust: 'exact',
      locus: parentId,
      payload: { fitness: parent.fitness },
    })
  }

  const best = rows.reduce((acc, row) => {
    if (!acc || merit(row.fitness) > merit(acc.fitness)) return row
    return acc
  }, null)

  if (parent && best && best.id !== parentId && merit(best.fitness) > merit(parent.fitness)) {
    evidence.push({
      id: eid(`deficit:${parentId}:${best.id}`),
      type: 'deficit',
      trust: 'inferred',
      locus: parentId,
      payload: {
        parent_fitness: parent.fitness ?? null,
        best_id: best.id,
        best_fitness: best.fitness,
        gap: merit(best.fitness) - merit(parent.fitness),
        note: 'Parent trails current best; prefer edits that close this gap without inventing scores.',
      },
    })
  }

  // Sibling true diffs: top alive peers (excluding parent) vs parent solution.
  const parentSol = await readSolution(candidateDir(evolve, parentId))
  if (parentSol) {
    const peers = alive(rows)
      .filter(r => r.id !== parentId && merit(r.fitness) > merit(parent?.fitness))
      .sort((a, b) => merit(b.fitness) - merit(a.fitness))
      .slice(0, 2)

    for (const peer of peers) {
      const peerSol = await readSolution(candidateDir(evolve, peer.id))
      if (!peerSol) continue
      const patch = unifiedDiff(
        parentSol.text,
        peerSol.text,
        `candidates/${parentId}`,
        `candidates/${peer.id}`,
      )
      if (!patch) continue
      evidence.push({
        id: eid(`sibling:${parentId}:${peer.id}`),
        type: 'sibling_diff',
        trust: 'exact',
        locus: peer.id,
        payload: {
          peer_id: peer.id,
          peer_fitness: peer.fitness,
          patch: patch.slice(0, 6000),
        },
      })
    }
  }

  // Fusion2: provenance channels preferred by gate ordering.
  if (traceRequested()) {
    const prov = await loadBreakthroughState(evolve)
    if (prov?.breakthrough) {
      const b = prov.breakthrough
      evidence.push({
        id: eid(`breakthrough:${b.child}:${b.patch_fp ?? ''}`),
        type: 'breakthrough',
        trust: b.trust ?? 'exact',
        locus: b.locus ?? b.child,
        payload: b,
      })
    }
    if (prov?.repeat_failure) {
      const r = prov.repeat_failure
      evidence.push({
        id: eid(`repeat:${r.streak}:${r.patch_fp ?? r.note ?? ''}`),
        type: 'repeat_failure',
        trust: r.trust ?? 'inferred',
        locus: prov.child ?? null,
        payload: r,
      })
    }
  }

  const working = await loadWorking(evolve)
  if (working && working.outcome && working.outcome !== 'up') {
    evidence.push({
      id: eid(`working:${working.child ?? 'na'}:${working.outcome}`),
      type: 'working',
      trust: 'exact',
      locus: working.child ?? null,
      payload: {
        outcome: working.outcome,
        parent: working.parent,
        child: working.child,
        delta: working.delta,
        note: working.note ?? `Last attempt was ${working.outcome}; avoid repeating the same failed edit.`,
      },
    })
  }

  const recent = await loadRecentChain(evolve, 2)
  for (const node of recent) {
    if (!node?.patch) continue
    evidence.push({
      id: eid(`chain:${node.child}:${node.ts ?? ''}`),
      type: 'chain_diff',
      trust: 'exact',
      locus: node.child,
      payload: {
        parent: node.parent,
        child: node.child,
        fitness: node.fitness,
        patch: String(node.patch).slice(0, 6000),
      },
    })
  }

  return evidence
}

export { readSolution, candidateDir, SOLUTION_NAMES }
