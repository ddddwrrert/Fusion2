/**
 * Fusion mutate.
 *
 * FORK OF: Organon `dsh-evolve-loop/src/providers/mutate.js` (`candidate-builder`).
 * @see docs/UPSTREAM.md §2.3
 *
 * SAME AS UPSTREAM:
 *   defaultPersona; resolve parentFitness; allocate + spawnWorker; abort rethrow;
 *   EVOLVE markers; do not run official evaluator.
 *
 * DIFF FROM UPSTREAM (only):
 *   buildInstruction(..., kt) appends fused K_t.text;
 *   options.fuseKt / options.kt;
 *   candidate.fusion metadata.
 *
 * Runtime DSH deps: evolve.allocate / evolve.spawnWorker / evolve.population
 * (from `dsh-evolve-loop` + DSH subagents).
 */

export const name = 'fusion2-mutate'

/**
 * Same text as upstream `defaultPersona()` in mutate.js.
 * @returns {string}
 */
export function defaultPersona() {
  return 'You are a solution worker in an evolutionary search. Design and implement one complete candidate in your assigned directory. IMPLEMENT A SINGLE SOLUTION. DO NOT ATTEMPT MULTIPLE SOLUTIONS.'
}

/**
 * Upstream `defaultInstruction(parentFitness)` plus optional fused K_t block.
 * @param {number} [parentFitness]
 * @param {object} [kt]
 * @returns {string}
 */
export function buildInstruction(parentFitness, kt) {
  // --- same lines as upstream defaultInstruction ---
  const lines = [
    'Read the task statement and the parent solution in this directory.',
  ]

  if (typeof parentFitness === 'number' && Number.isFinite(parentFitness)) {
    lines.push(`The parent candidate's official fitness was ${parentFitness}.`)
  }

  lines.push(
    'Understand how the current solution works, consider how it could better satisfy the task, and implement your chosen improvement as one complete candidate.',
    'Edit only the solution code between the #EVOLVE_START and #EVOLVE_END markers; leave all other task files and code unchanged.',
    'This directory is one allocated candidate and one complete solution attempt. You may reason about alternatives, but do not write, run, or compare several complete implementations here. A different complete attempt requires another candidate and uses another budget unit.',
    'Do not run the task\'s official evaluator or performance benchmarks; the search loop evaluates your candidate after you finish.',
  )

  // --- DIFF: append fused context ---
  if (kt?.text) {
    lines.push('', String(kt.text).trim())
  }

  return lines.join('\n')
}

/** Alias kept for readers comparing to upstream `defaultInstruction`. */
export function defaultInstruction(parentFitness) {
  return buildInstruction(parentFitness, null)
}

/**
 * @param {object} options
 * @param {object} evolve - live evolve service from dsh-evolve-loop
 * @returns {Promise<{ id: string, dir: string, fusion?: object }>}
 */
export async function mutate(options, evolve) {
  const {
    parent,
    parentFitness: providedFitness,
    instruction: providedInstruction,
    fuseKt,
    kt,
    name: workerName,
    description,
    persona = defaultPersona(),
    model,
    allowShell = true,
    allowedTools,
    maxDepth,
    ...extra
  } = options ?? {}

  if (!parent) throw new Error('mutate needs a parent candidate id')

  let parentFitness = providedFitness
  if (parentFitness === undefined && evolve?.population) {
    const rows = await evolve.population().rows()
    const parentRow = rows.find(r => r.id === parent)
    if (parentRow && typeof parentRow.fitness === 'number') {
      parentFitness = parentRow.fitness
    }
  }

  const fused = fuseKt ?? kt ?? null
  const instruction = providedInstruction ?? buildInstruction(parentFitness, fused)
  const candidate = await evolve.allocate(parent)
  const workerLabel = workerName ?? description ?? 'fusion-mutator'

  try {
    await evolve.spawnWorker(candidate.dir, instruction, {
      label: workerLabel,
      persona,
      model,
      allowShell,
      allowedTools,
      maxDepth,
      ...extra,
    })
  } catch (error) {
    // Same as upstream: abort rethrows; other worker failures still evaluate.
    const currentRun = evolve.currentRun?.()
    if (currentRun?.signal?.aborted) throw error
  }

  // DIFF: audit stamp for fusion
  candidate.fusion = {
    parentFitness,
    evidence_ids: fused?.evidence_ids ?? [],
    truncated: Boolean(fused?.truncated),
  }

  return candidate
}

export default { name, mutate, buildInstruction, defaultInstruction, defaultPersona }
