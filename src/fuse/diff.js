/**
 * Zero-LLM unified diff between two text blobs.
 */

/**
 * @param {string} aText
 * @param {string} bText
 * @param {string} [aLabel='a']
 * @param {string} [bLabel='b']
 * @returns {string}
 */
export function unifiedDiff(aText, bText, aLabel = 'a', bLabel = 'b') {
  const a = String(aText ?? '').replace(/\r\n/g, '\n').split('\n')
  const b = String(bText ?? '').replace(/\r\n/g, '\n').split('\n')

  // Myers-lite: LCS DP for small files (AHC solutions are typically small).
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: ' ', line: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: '-', line: a[i] })
      i += 1
    } else {
      ops.push({ t: '+', line: b[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ t: '-', line: a[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ t: '+', line: b[j] })
    j += 1
  }

  const changed = ops.some(op => op.t !== ' ')
  if (!changed) return ''

  const lines = [
    `--- ${aLabel}`,
    `+++ ${bLabel}`,
    `@@ -1,${n} +1,${m} @@`,
  ]
  for (const op of ops) {
    lines.push(`${op.t}${op.line}`)
  }
  return `${lines.join('\n')}\n`
}
