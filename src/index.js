/**
 * dsh-evolve-fusion2 — Fusion + rule-based provenance (trace / breakthrough).
 * Opt-in via DSH_EVOLVE_FUSION2=1. Does not edit upstream evolve-loop or the Fusion repo.
 *
 * @module dsh-evolve-fusion2
 */

import { installFusionProviders, requested } from './install.js'

export const name = 'dsh-evolve-fusion2'
export const inject = ['evolve']

/**
 * @param {object} ctx
 */
export function apply(ctx) {
  if (!requested()) return
  const evolve = ctx.evolve
  ctx.effect(() => installFusionProviders(evolve).dispose)
}

export { requested, ENV_FLAG, TRACE_ENV_FLAG, traceRequested, installFusionProviders } from './install.js'
