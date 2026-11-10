/**
 * Fusion loop.
 *
 * FORK OF: Organon `dsh-evolve-loop/src/providers/loop.js` (`export const name = 'evolve-loop'`).
 * @see docs/UPSTREAM.md §2.2
 *
 * SAME AS UPSTREAM:
 *   baseline copyTask+evaluate; select→mutate→evaluate→append→survive; best by merit.
 *
 * DIFF FROM UPSTREAM (only):
 *   1) after select → fuse() → K_t
 *   2) mutate({ ..., fuseKt: K_t })
 *   3) after append → commit() (Working + Chain)
 *
 * Runtime DSH deps (not reimplemented): evolve.context / population / copyTask /
 * select / mutate / evaluate / survive / currentRun — from `dsh-evolve-loop`.
 */

import { alive, merit } from '../population.js'
import { fuse } from '../fuse/fuse.js'
import { commit } from '../fuse/commit.js'

export const name = 'fusion2-loop'

/**
 * @param {object} args
 * @param {object} evolve - live evolve service from dsh-evolve-loop
 * @returns {Promise<{ best_id: string, best_fitness: number, remaining: number }>}
 */
export async function run(args, evolve) {
  // --- same skeleton as upstream loop.js ---
  const { maxPopulation, candidates } = await evolve.context()
  const population = evolve.population()
  const runState = evolve.currentRun()

  let rows = await population.rows()
  if (rows.length === 0) {
    const base = await evolve.copyTask()
    const baseFitness = await evolve.evaluate(base)
    await population.append({
      id: base.id,
      parent: null,
      fitness: baseFitness,
      survival: 'yes',
    })
    rows = await population.rows()
  }

  const limit = candidates ?? Infinity
  let created = 0

  while ((await evolve.context()).budget.remaining > 0 && created < limit) {
    runState.signal.throwIfAborted()

    const parentId = await evolve.select(population)
    rows = await population.rows()
    const parentRow = rows.find(r => r.id === parentId)
    const parentFitness = typeof parentRow?.fitness === 'number' ? parentRow.fitness : undefined

    // --- DIFF: fuse before mutate ---
    let kt = { text: '', evidence_ids: [], truncated: false, max_chars: 0 }
    try {
      kt = await fuse(evolve, { parentId, rows })
    } catch (err) {
      kt = {
        text: `[FUSED CONTEXT unavailable: ${String(err?.message ?? err)}]`,
        evidence_ids: [],
        truncated: false,
        max_chars: 0,
        error: String(err?.message ?? err),
      }
    }

    const candidate = await evolve.mutate({
      parent: parentId,
      parentFitness,
      fuseKt: kt, // DIFF: pass K_t into fusion-mutate
    })
    created += 1

    const fitness = await evolve.evaluate(candidate)

    await population.append({
      id: candidate.id,
      parent: parentId,
      fitness,
      survival: 'yes',
    })

    // --- DIFF: commit after record ---
    try {
      await commit(evolve, {
        parent: parentId,
        child: candidate.id,
        fitness,
        parentFitness,
        kt,
      })
    } catch {
      // never block the loop
    }

    rows = await population.rows()
    if (alive(rows).length >= maxPopulation) {
      await evolve.survive(population)
      rows = await population.rows()
    }
  }

  rows = await population.rows()
  let best = rows[0]
  for (const row of rows) {
    if (best === undefined || merit(row.fitness) > merit(best.fitness)) {
      best = row
    }
  }

  const budget = (await evolve.context()).budget
  return {
    best_id: best?.id ?? 'c000000',
    best_fitness: best?.fitness ?? 0,
    remaining: budget.remaining,
  }
}

export default { name, run }
