/**
 * Public fuse step: collect evidence → gate → K_t.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { collectEvidence } from './evidence.js'
import { fuseGate } from './gate.js'
import { fusePaths } from './paths.js'

/**
 * @param {object} evolve
 * @param {object} args
 * @param {string} args.parentId
 * @param {Array<object>} [args.rows]
 * @param {number} [args.maxChars]
 * @returns {Promise<object>} K_t
 */
export async function fuse(evolve, args) {
  const { parentId, rows, maxChars } = args
  const evidence = await collectEvidence({ parentId, evolve, rows })
  const kt = fuseGate(evidence, { parentId, maxChars })

  const { evidenceDir, root } = fusePaths(evolve)
  await mkdir(root, { recursive: true })
  await mkdir(evidenceDir, { recursive: true })
  const stamp = `${Date.now()}-${parentId}`
  await writeFile(
    join(evidenceDir, `${stamp}.json`),
    `${JSON.stringify({ parentId, evidence, kt }, null, 2)}\n`,
    'utf8',
  )

  return kt
}
