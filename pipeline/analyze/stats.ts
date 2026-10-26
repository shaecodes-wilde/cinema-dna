import type { Confidence } from '../../shared/app-types.ts'

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN)

export function sd(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1))
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo)
}

export const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d

/**
 * Empirical-Bayes (normal–normal) shrinkage: a group's mean is pulled toward the global mean
 * by `k` pseudo-observations. One 5★ film in a genre moves its score only 1/(1+k) of the way.
 */
export function shrink(values: number[], globalMean: number, k: number): number {
  return (sum(values) + k * globalMean) / (values.length + k)
}

/** ~90% interval for the shrunk mean, using the global SD as the noise scale. */
export function shrunkInterval(values: number[], globalMean: number, globalSd: number, k: number): [number, number] {
  const m = shrink(values, globalMean, k)
  const se = globalSd / Math.sqrt(values.length + k)
  return [m - 1.645 * se, m + 1.645 * se]
}

/**
 * Confidence label for a group's deviation from baseline: considers both sample size and how
 * many standard errors the deviation is from zero.
 */
export function confidenceFor(n: number, delta: number, globalSd: number, k: number): Confidence {
  const se = globalSd / Math.sqrt(n + k)
  const z = Math.abs(delta) / se
  if (n >= 8 && z >= 2) return 'high'
  if (n >= 4 && z >= 1.2) return 'medium'
  return 'low'
}

/** Confidence for a proportion-type claim. */
export function proportionConfidence(n: number): Confidence {
  return n >= 60 ? 'high' : n >= 20 ? 'medium' : 'low'
}

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return NaN
  const mx = mean(xs), my = mean(ys)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : NaN
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0])
  const r = new Array<number>(xs.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r
}

export const spearman = (xs: number[], ys: number[]) => pearson(ranks(xs), ranks(ys))

/** Normalised Shannon entropy (0 = all in one bucket, 1 = perfectly even). */
export function evenness(counts: number[]): number {
  const total = sum(counts)
  const nz = counts.filter((c) => c > 0)
  if (nz.length < 2 || !total) return 0
  const h = -sum(nz.map((c) => (c / total) * Math.log(c / total)))
  return h / Math.log(counts.length)
}

/**
 * Smoothed log-odds ratio with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008),
 * returning a z-score. Used for "what words/features separate your 5★ from your 3★ films".
 */
export function logOddsZ(countA: number, totalA: number, countB: number, totalB: number, prior: number, priorTotal: number): number {
  const a = countA + prior, b = countB + prior
  const la = Math.log(a / (totalA + priorTotal - a))
  const lb = Math.log(b / (totalB + priorTotal - b))
  const variance = 1 / a + 1 / b
  return (la - lb) / Math.sqrt(variance)
}

/** Deterministic PRNG (mulberry32) so layouts and CV folds are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Ridge regression (closed form via Cholesky) ─────────────────────────

/** Solves (XᵀX + λI)w = Xᵀy for centred y; intercept handled by the caller. */
export function ridge(X: number[][], y: number[], lambda: number): number[] {
  const p = X[0]?.length ?? 0
  const A = Array.from({ length: p }, () => new Float64Array(p))
  const b = new Float64Array(p)
  for (let r = 0; r < X.length; r++) {
    const row = X[r]
    for (let i = 0; i < p; i++) {
      if (row[i] === 0) continue
      b[i] += row[i] * y[r]
      for (let j = 0; j < p; j++) if (row[j] !== 0) A[i][j] += row[i] * row[j]
    }
  }
  for (let i = 0; i < p; i++) A[i][i] += lambda
  // Cholesky decomposition A = LLᵀ
  const L = Array.from({ length: p }, () => new Float64Array(p))
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j]
    }
  }
  const z = new Float64Array(p)
  for (let i = 0; i < p; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= L[i][k] * z[k]
    z[i] = s / L[i][i]
  }
  const w = new Array<number>(p).fill(0)
  for (let i = p - 1; i >= 0; i--) {
    let s = z[i]
    for (let k = i + 1; k < p; k++) s -= L[k][i] * w[k]
    w[i] = s / L[i][i]
  }
  return w
}

export const dot = (a: number[], b: number[]) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
