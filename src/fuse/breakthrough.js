/**
 * Rule-based provenance (no LLM): breakthrough from improving diffs;
 * repeat_failure from consecutive non-up outcomes / similar patch fingerprints.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fusePaths } from './paths.js'
import { loadRecentTraces } from './trace.js'

/**
 * @param {string} patch
 * @returns {string}
 */
export function patchFingerprint(patch) {
  const body = String(patch ?? '')
    .split('\n')
    .filter(line => line.startsWith('+') || line.startsWith('-'))
    .filter(line => !line.startsWith('+++') && !line.startsWith('---'))
    .map(line => line.slice(0, 120))
    .join('\n')
  return createHash('sha1').update(body).digest('hex').slice(0, 16)
}

/**
 * @param {string} patch
 * @param {number} [maxChars=2500]
 * @returns {string}
 */
export function patchExcerpt(patch, maxChars = 2500) {
  const text = String(patch ?? '')
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…(truncated)\n`
}

/**
 * @param {object} args
 * @param {string} args.parent
 * @param {string} args.child
 * @param {number|null} args.delta
 * @param {string} args.outcome
 * @param {string} [args.patch]
 * @param {number} [args.fitness]
 * @param {number} [args.parentFitness]
 * @returns {{ breakthrough: object|null, failure_signal: object|null }}
 */
export function deriveFromStep(args) {
  const {
    parent,
    child,
    delta,
    outcome,
    patch = '',
    fitness,
    parentFitness,
  } = args

  let breakthrough = null
  let failure_signal = null

  if (outcome === 'up' && typeof delta === 'number' && delta > 0 && patch) {
    breakthrough = {
      type: 'breakthrough',
      trust: 'exact',
      locus: child,
      claim: 'accepted patch raised official fitness',
      parent,
      child,
      delta,
      fitness,
      parent_fitness: parentFitness ?? null,
      patch_excerpt: patchExcerpt(patch),
      patch_fp: patchFingerprint(patch),
    }
  } else if (outcome === 'down' || outcome === 'flat' || outcome === 'error') {
    failure_signal = {
      type: 'failure_signal',
      outcome,
      parent,
      child,
      delta,
      patch_fp: patch ? patchFingerprint(patch) : null,
      patch_excerpt: patch ? patchExcerpt(patch, 800) : null,
      note: `Last attempt was ${outcome}; do not repeat the same failed edit.`,
    }
  }

  return { breakthrough, failure_signal }
}

/**
 * @param {object[]} traces newest-last
 * @param {number} [streak=2]
 * @returns {object|null}
 */
export function detectRepeatFailure(traces, streak = 2) {
  const recent = (traces ?? []).slice(-Math.max(streak, 2))
  if (recent.length < streak) return null

  const bad = recent.filter(t => t.outcome && t.outcome !== 'up')
  if (bad.length < streak) return null

  const fps = bad.map(t => t.patch_fp).filter(Boolean)
  const sameFp = fps.length >= streak && fps.every(fp => fp === fps[0])

  return {
    type: 'repeat_failure',
    trust: 'inferred',
    streak: bad.length,
    outcomes: bad.map(t => t.outcome),
    same_patch_fp: sameFp,
    patch_fp: sameFp ? fps[0] : null,
    note: sameFp
      ? `Repeated ${bad.length} non-improving attempts with the same patch fingerprint; change approach.`
      : `Repeated ${bad.length} non-improving attempts; avoid repeating recent failed directions.`,
  }
}

/**
 * Persist latest breakthrough bundle for next fuse.
 * @param {object} evolve
 * @param {object} bundle
 * @returns {Promise<object>}
 */
export async function saveBreakthroughState(evolve, bundle) {
  const { breakthrough, root } = fusePaths(evolve)
  await mkdir(root, { recursive: true })
  const payload = {
    ...bundle,
    ts: new Date().toISOString(),
  }
  await writeFile(breakthrough, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

/**
 * @param {object} evolve
 * @returns {Promise<object|null>}
 */
export async function loadBreakthroughState(evolve) {
  const { breakthrough } = fusePaths(evolve)
  try {
    const raw = await readFile(breakthrough, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Full provenance step after a scored child exists.
 * @param {object} evolve
 * @param {object} step
 * @returns {Promise<object>}
 */
export async function runProvenance(evolve, step) {
  const derived = deriveFromStep(step)
  const traces = await loadRecentTraces(evolve, 8)
  // Include current step logically for streak (trace may already be saved).
  const withCurrent = [...traces]
  const last = withCurrent[withCurrent.length - 1]
  if (!last || last.child !== step.child) {
    withCurrent.push({
      child: step.child,
      outcome: step.outcome,
      patch_fp: step.patch ? patchFingerprint(step.patch) : null,
    })
  }

  const repeat = detectRepeatFailure(withCurrent, 2)
  const state = await saveBreakthroughState(evolve, {
    breakthrough: derived.breakthrough,
    failure_signal: derived.failure_signal,
    repeat_failure: repeat,
    child: step.child,
    parent: step.parent,
  })

  return {
    ...derived,
    repeat_failure: repeat,
    state,
  }
}
