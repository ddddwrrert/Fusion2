/**
 * Fast-layer Working memory: overwritten each commit.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fusePaths } from './paths.js'

/**
 * @param {object} evolve
 * @returns {Promise<object|null>}
 */
export async function loadWorking(evolve) {
  const { working } = fusePaths(evolve)
  try {
    const raw = await readFile(working, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @param {object} evolve
 * @param {object} record
 * @returns {Promise<object>}
 */
export async function saveWorking(evolve, record) {
  const { working, root } = fusePaths(evolve)
  await mkdir(root, { recursive: true })
  await mkdir(dirname(working), { recursive: true })
  const payload = {
    ...record,
    ts: record.ts ?? new Date().toISOString(),
  }
  await writeFile(working, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

/**
 * @param {number|null|undefined} parentFitness
 * @param {number|null|undefined} fitness
 * @returns {'up'|'flat'|'down'|'error'}
 */
export function outcomeOf(parentFitness, fitness) {
  if (typeof fitness !== 'number' || !Number.isFinite(fitness)) return 'error'
  if (typeof parentFitness !== 'number' || !Number.isFinite(parentFitness)) {
    return fitness > 0 ? 'up' : 'flat'
  }
  if (fitness > parentFitness) return 'up'
  if (fitness < parentFitness) return 'down'
  return 'flat'
}
