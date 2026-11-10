/**
 * Post-evaluate commit: Working + optional Chain + (Fusion2) Trace/Provenance.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fusePaths } from './paths.js'
import { outcomeOf, saveWorking } from './working.js'
import { maybeAppendChain } from './chain.js'
import { candidateDir, readSolution } from './evidence.js'
import { unifiedDiff } from './diff.js'
import { saveTrace } from './trace.js'
import { patchFingerprint, runProvenance } from './breakthrough.js'
import { traceRequested } from '../install.js'

/**
 * @param {object} evolve
 * @param {object} args
 * @returns {Promise<{ working: object, chain: object|null, provenance: object|null }>}
 */
export async function commit(evolve, args) {
  const {
    parent,
    child,
    fitness,
    parentFitness,
    kt,
    note,
  } = args

  const delta = (typeof fitness === 'number' && typeof parentFitness === 'number')
    ? fitness - parentFitness
    : null
  const outcome = outcomeOf(parentFitness, fitness)

  // True diff for provenance even when fitness did not improve.
  let patch = ''
  try {
    const parentSol = await readSolution(candidateDir(evolve, parent))
    const childSol = await readSolution(candidateDir(evolve, child))
    if (parentSol && childSol) {
      patch = unifiedDiff(
        parentSol.text,
        childSol.text,
        `candidates/${parent}`,
        `candidates/${child}`,
      ) || ''
    }
  } catch {
    patch = ''
  }

  const working = await saveWorking(evolve, {
    parent,
    child,
    fitness,
    parent_fitness: parentFitness ?? null,
    delta,
    outcome,
    evidence_ids: kt?.evidence_ids ?? [],
    note: note ?? null,
    patch_fp: patch ? patchFingerprint(patch) : null,
  })

  if (kt) {
    const { ktDir, root } = fusePaths(evolve)
    await mkdir(root, { recursive: true })
    await mkdir(ktDir, { recursive: true })
    await writeFile(
      join(ktDir, `${child}.json`),
      `${JSON.stringify({ ...kt, child, parent, fitness }, null, 2)}\n`,
      'utf8',
    )
  }

  let chain = null
  try {
    chain = await maybeAppendChain(evolve, {
      parent,
      child,
      fitness,
      parentFitness,
      kt,
    })
  } catch (err) {
    working.commit_chain_error = String(err?.message ?? err)
    await saveWorking(evolve, working)
  }

  let provenance = null
  if (traceRequested()) {
    try {
      await saveTrace(evolve, {
        parent,
        child,
        parent_fitness: parentFitness ?? null,
        fitness,
        delta,
        outcome,
        patch,
        patch_fp: patch ? patchFingerprint(patch) : null,
        evidence_ids: kt?.evidence_ids ?? [],
      })

      provenance = await runProvenance(evolve, {
        parent,
        child,
        delta,
        outcome,
        patch,
        fitness,
        parentFitness,
      })

      // Surface provenance pointers on Working for next fuse.
      working.breakthrough = provenance.breakthrough
      working.repeat_failure = provenance.repeat_failure
      working.failure_signal = provenance.failure_signal
      await saveWorking(evolve, working)
    } catch (err) {
      working.commit_trace_error = String(err?.message ?? err)
      await saveWorking(evolve, working)
    }
  }

  return { working, chain, provenance }
}
