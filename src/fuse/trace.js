/**
 * Provenance traces: one JSON file per child after evaluate/commit.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fusePaths } from './paths.js'

/**
 * @param {object} evolve
 * @param {object} record
 * @returns {Promise<object>}
 */
export async function saveTrace(evolve, record) {
  const { traceDir, root } = fusePaths(evolve)
  await mkdir(root, { recursive: true })
  await mkdir(traceDir, { recursive: true })
  const payload = {
    ...record,
    ts: record.ts ?? new Date().toISOString(),
  }
  const child = record.child ?? 'unknown'
  await writeFile(join(traceDir, `${child}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

/**
 * @param {object} evolve
 * @param {string} childId
 * @returns {Promise<object|null>}
 */
export async function loadTrace(evolve, childId) {
  const { traceDir } = fusePaths(evolve)
  try {
    const raw = await readFile(join(traceDir, `${childId}.json`), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @param {object} evolve
 * @param {number} [limit=8]
 * @returns {Promise<object[]>}
 */
export async function loadRecentTraces(evolve, limit = 8) {
  const { traceDir } = fusePaths(evolve)
  let names = []
  try {
    names = await readdir(traceDir)
  } catch {
    return []
  }
  const files = names.filter(n => n.endsWith('.json')).sort()
  const slice = files.slice(-Math.max(0, limit))
  const out = []
  for (const name of slice) {
    try {
      const raw = await readFile(join(traceDir, name), 'utf8')
      out.push(JSON.parse(raw))
    } catch {
      // skip
    }
  }
  return out
}
