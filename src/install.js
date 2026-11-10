/**
 * Install Fusion2 providers onto an existing evolve service.
 * Independent package from Fusion (`dsh-evolve-fusion`).
 */

import fuseLoop from './providers/fuse-loop.js'
import fuseMutate from './providers/fuse-mutate.js'

export const ENV_FLAG = 'DSH_EVOLVE_FUSION2'
/** Set to 0/false/off to disable provenance for A/B (default: on when Fusion2 is on). */
export const TRACE_ENV_FLAG = 'DSH_EVOLVE_FUSION2_TRACE'

/**
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {boolean}
 */
export function requested(env = process.env) {
  const value = `${env[ENV_FLAG] ?? ''}`.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

/**
 * Provenance layer default-on; disable with DSH_EVOLVE_FUSION2_TRACE=0.
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {boolean}
 */
export function traceRequested(env = process.env) {
  const raw = env[TRACE_ENV_FLAG]
  if (raw === undefined || raw === null || `${raw}`.trim() === '') return true
  const value = `${raw}`.trim().toLowerCase()
  return !(value === '0' || value === 'false' || value === 'off')
}

/**
 * @param {object} evolve
 * @returns {{ installed: string[], dispose: () => void }}
 */
export function installFusionProviders(evolve) {
  const providers = {
    loop: fuseLoop,
    mutate: fuseMutate,
  }

  const disposers = []
  const installed = []
  for (const [slot, provider] of Object.entries(providers)) {
    disposers.push(evolve.register(slot, provider))
    installed.push(`${slot}=${provider.name}`)
  }

  evolve.fusion2 = {
    flag: ENV_FLAG,
    traceFlag: TRACE_ENV_FLAG,
    trace: traceRequested(),
    installed: [...installed],
  }

  return {
    installed,
    dispose: () => {
      delete evolve.fusion2
      for (const dispose of disposers.reverse()) dispose()
    },
  }
}
