/**
 * Late / gated fusion: Evidence[] → fixed-budget K_t package.
 */

const TYPE_PRIORITY = {
  // Fusion2 provenance first
  breakthrough: 0,
  repeat_failure: 1,
  deficit: 2,
  score: 3,
  sibling_diff: 4,
  working: 5,
  chain_diff: 6,
}

const TRUST_RANK = {
  exact: 0,
  inferred: 1,
  weak: 2,
}

/**
 * @param {object} [options]
 * @param {number} [options.maxChars=6000]
 * @returns {number}
 */
export function defaultMaxChars(options = {}) {
  const n = Number(options.maxChars)
  return Number.isFinite(n) && n > 500 ? Math.floor(n) : 6000
}

/**
 * @param {Array<object>} evidence
 * @returns {Array<object>}
 */
export function rankEvidence(evidence) {
  return [...(evidence ?? [])].sort((a, b) => {
    const ta = TYPE_PRIORITY[a.type] ?? 99
    const tb = TYPE_PRIORITY[b.type] ?? 99
    if (ta !== tb) return ta - tb
    const ra = TRUST_RANK[a.trust] ?? 9
    const rb = TRUST_RANK[b.trust] ?? 9
    if (ra !== rb) return ra - rb
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * @param {object} item
 * @returns {string}
 */
function renderItem(item) {
  const p = item.payload ?? {}
  switch (item.type) {
    case 'score':
      return `[score] parent fitness=${p.fitness}`
    case 'deficit':
      return `[deficit] parent=${p.parent_fitness} best=${p.best_id}@${p.best_fitness} gap=${p.gap}\n${p.note ?? ''}`
    case 'sibling_diff':
      return `[sibling_diff] peer=${p.peer_id} fitness=${p.peer_fitness}\n\`\`\`diff\n${p.patch ?? ''}\n\`\`\``
    case 'working':
      return `[working] last=${p.outcome} delta=${p.delta}\n${p.note ?? ''}`
    case 'chain_diff':
      return `[chain_diff] ${p.parent}→${p.child} fitness=${p.fitness}\n\`\`\`diff\n${p.patch ?? ''}\n\`\`\``
    case 'breakthrough':
      return `[breakthrough] ${p.claim ?? ''} delta=${p.delta} ${p.parent}→${p.child}\nBuild on this accepted change:\n\`\`\`diff\n${p.patch_excerpt ?? ''}\n\`\`\``
    case 'repeat_failure':
      return `[repeat_failure] streak=${p.streak} same_fp=${p.same_patch_fp}\n${p.note ?? ''}`
    default:
      return `[${item.type}] ${JSON.stringify(p)}`
  }
}

/**
 * Fuse evidence into a bounded K_t object.
 * @param {Array<object>} evidence
 * @param {object} [options]
 * @param {number} [options.maxChars]
 * @param {string} [options.parentId]
 * @returns {{ text: string, evidence_ids: string[], truncated: boolean, max_chars: number, parent_id?: string }}
 */
export function fuseGate(evidence, options = {}) {
  const maxChars = defaultMaxChars(options)
  const ranked = rankEvidence(evidence)
  const seen = new Set()
  const picked = []
  let truncated = false

  const header = [
    '[FUSED CONTEXT — follow these constraints; do not invent official scores]',
    'Edit only code between #EVOLVE_START and #EVOLVE_END.',
    'Implement one complete candidate. Do not run the official evaluator.',
    '',
  ].join('\n')

  let budget = maxChars - header.length
  for (const item of ranked) {
    if (!item?.id || seen.has(item.id)) continue
    const block = `${renderItem(item).trim()}\n\n`
    if (block.length > budget) {
      truncated = true
      break
    }
    picked.push(item)
    seen.add(item.id)
    budget -= block.length
  }

  const body = picked.map(renderItem).join('\n\n')
  const text = `${header}${body}`.trim() + '\n'

  return {
    text,
    evidence_ids: picked.map(e => e.id),
    truncated,
    max_chars: maxChars,
    parent_id: options.parentId,
  }
}
