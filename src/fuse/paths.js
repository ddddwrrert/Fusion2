/**
 * Resolve Fusion2 ledger paths under the task run root.
 */

import { join } from 'node:path'

/**
 * @param {object} evolve
 * @returns {string}
 */
export function resolveRunRoot(evolve) {
  if (typeof evolve?.runRoot === 'string' && evolve.runRoot) return evolve.runRoot
  if (typeof evolve?.files?.root === 'string' && evolve.files.root) return evolve.files.root
  if (typeof evolve?.cwd === 'string' && evolve.cwd) return join(evolve.cwd, 'run')
  return join(process.cwd(), 'run')
}

/**
 * @param {object} evolve
 * @returns {{ root: string, working: string, chain: string, ktDir: string, evidenceDir: string, traceDir: string, breakthrough: string }}
 */
export function fusePaths(evolve) {
  const root = join(resolveRunRoot(evolve), 'fuse')
  return {
    root,
    working: join(root, 'working.json'),
    chain: join(root, 'chain.jsonl'),
    ktDir: join(root, 'kt'),
    evidenceDir: join(root, 'evidence'),
    traceDir: join(root, 'trace'),
    breakthrough: join(root, 'breakthrough.json'),
  }
}
