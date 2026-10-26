import { UMAP } from 'umap-js'
import type { Cluster } from '../../shared/app-types.ts'
import type { FilmRecord } from './features.ts'
import { mean, rng, round } from './stats.ts'

/**
 * Film similarity map. Each watched film becomes a weighted attribute vector; distances are
 * cosine distances between those vectors; UMAP projects them to 2-D. Nearness therefore means
 * "shares verified attributes", not an objective judgement of similarity.
 */
export const WEIGHTS: { feature: string; weight: number; note: string }[] = [
  { feature: 'Director', weight: 1.4, note: 'each shared director' },
  { feature: 'Franchise / series', weight: 1.2, note: 'same series or franchise' },
  { feature: 'Genre', weight: 1.0, note: 'each canonical genre' },
  { feature: 'Writer', weight: 0.8, note: 'each shared screenwriter' },
  { feature: 'Animation / documentary', weight: 0.9, note: 'form of the film' },
  { feature: 'Decade', weight: 0.8, note: 'release decade (+0.3 to neighbouring decades)' },
  { feature: 'Sub-genre', weight: 0.6, note: 'finer genre labels' },
  { feature: 'Production region', weight: 0.6, note: 'primary non-US region, else US' },
  { feature: 'Cinematographer / composer', weight: 0.5, note: 'recurring below-the-line talent' },
  { feature: 'Non-English', weight: 0.4, note: 'original language other than English' },
  { feature: 'Cast', weight: 0.25, note: 'each actor appearing in 2+ of your films' },
  { feature: 'Runtime band', weight: 0.3, note: 'length bucket' },
]

export function filmVectors(records: FilmRecord[]): { keys: string[]; vectors: SparseVec[] } {
  const castCount = new Map<string, number>()
  const crewCount = new Map<string, number>()
  for (const r of records) {
    for (const c of r.cast) castCount.set(c, (castCount.get(c) ?? 0) + 1)
    for (const c of [...r.cinematographers, ...r.composers]) crewCount.set(c, (crewCount.get(c) ?? 0) + 1)
  }
  const dims = new Map<string, number>()
  const sparse = records.map((r) => {
    const f = new Map<string, number>()
    const add = (k: string, w: number) => f.set(k, Math.max(f.get(k) ?? 0, w))
    r.directors.forEach((d) => add(`dir:${d}`, 1.4))
    if (r.franchise) add(`series:${r.franchise}`, 1.2)
    r.genres.forEach((g) => add(`genre:${g}`, 1))
    r.writers.forEach((w) => add(`writer:${w}`, 0.8))
    if (r.animated) add('form:animated', 0.9)
    if (r.documentary) add('form:documentary', 0.9)
    if (r.decade) {
      add(`decade:${r.decade}`, 0.8)
      add(`decade:${r.decade - 10}`, 0.3)
      add(`decade:${r.decade + 10}`, 0.3)
    }
    r.subgenres.forEach((s) => add(`sub:${s}`, 0.6))
    if (r.region) add(`region:${r.region}`, 0.6)
    ;[...r.cinematographers, ...r.composers].filter((c) => (crewCount.get(c) ?? 0) >= 2).forEach((c) => add(`crew:${c}`, 0.5))
    if (r.englishLanguage === false) add('lang:non-english', 0.4)
    r.cast.filter((c) => (castCount.get(c) ?? 0) >= 2).forEach((c) => add(`cast:${c}`, 0.25))
    if (r.runtimeBucket) add(`runtime:${r.runtimeBucket}`, 0.3)
    for (const k of f.keys()) if (!dims.has(k)) dims.set(k, dims.size)
    return f
  })
  // An attribute only one film has adds no similarity to anything; dropping it keeps vectors small.
  const df = new Map<string, number>()
  for (const f of sparse) for (const k of f.keys()) df.set(k, (df.get(k) ?? 0) + 1)
  const keys = [...dims.keys()].filter((k) => (df.get(k) ?? 0) >= 2)
  const index = new Map(keys.map((k, i) => [k, i]))
  const vectors = sparse.map((f) => {
    const entries = [...f].filter(([k]) => index.has(k)).map(([k, w]) => [index.get(k)!, w] as const).sort((x, y) => x[0] - y[0])
    const norm = Math.sqrt(entries.reduce((acc, [, w]) => acc + w * w, 0)) || 1
    return { idx: Int32Array.from(entries.map(([i]) => i)), val: Float64Array.from(entries.map(([, w]) => w / norm)) }
  })
  return { keys, vectors }
}

/** Unit-normalised sparse attribute vector. */
export interface SparseVec {
  idx: Int32Array
  val: Float64Array
}

/** Cosine distance between two unit-normalised sparse vectors (merge over sorted indices). */
export function sparseCosineDistance(a: SparseVec, b: SparseVec): number {
  let i = 0, j = 0, dot = 0
  while (i < a.idx.length && j < b.idx.length) {
    if (a.idx[i] === b.idx[j]) dot += a.val[i++] * b.val[j++]
    else if (a.idx[i] < b.idx[j]) i++
    else j++
  }
  return a.idx.length && b.idx.length ? 1 - dot : 1
}


export interface ConstellationResult {
  positions: Map<string, { x: number; y: number; cluster: number }>
  clusters: Cluster[]
}

export function buildConstellation(records: FilmRecord[], seed = 42): ConstellationResult {
  const usable = records.filter((r) => r.meta && r.genres.length)
  // UMAP and k-means need a reasonable sample; without metadata the map is simply omitted.
  if (usable.length < 15) return { positions: new Map(), clusters: [] }
  const { vectors } = filmVectors(usable)
  // UMAP only needs pairwise distances: hand it row indices and resolve them against the sparse vectors.
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(14, usable.length - 1),
    minDist: 0.35,
    spread: 1.2,
    distanceFn: (a, b) => sparseCosineDistance(vectors[a[0]], vectors[b[0]]),
    random: rng(seed),
  })
  const raw = umap.fit(vectors.map((_, i) => [i]))
  // Normalise to [0, 1].
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const pts = raw.map(([x, y]) => [(x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1)])

  // k-means on the high-dimensional vectors; k chosen by silhouette (cosine).
  let best: { k: number; labels: number[]; score: number } = { k: 0, labels: [], score: -Infinity }
  const kMax = Math.min(8, Math.max(2, Math.floor(usable.length / 4)))
  for (let k = Math.min(5, kMax); k <= kMax; k++) {
    const labels = kmeans(vectors, keysCount(vectors), k, seed)
    const score = silhouette(vectors, labels, seed)
    if (score > best.score) best = { k, labels, score }
  }

  const positions = new Map(usable.map((r, i) => [r.film.id, { x: round(pts[i][0], 4), y: round(pts[i][1], 4), cluster: best.labels[i] }]))
  const clusters: Cluster[] = []
  for (let c = 0; c < best.k; c++) {
    const members = usable.filter((_, i) => best.labels[i] === c)
    if (!members.length) continue
    // Traits come from each film's actual attributes (not the smoothed vectors), ranked by lift.
    const prevalence = (rs: FilmRecord[], t: string) => rs.filter((r) => traitSet(r).has(t)).length / rs.length
    const candidates = [...new Set(members.flatMap((r) => [...traitSet(r)]))]
    const seenNames = new Set<string>()
    const traits = candidates
      .map((t) => ({ t, inC: prevalence(members, t), all: prevalence(usable, t) }))
      .filter((x) => x.inC >= 0.3)
      .map((x) => ({ ...x, lift: x.inC * Math.log((x.inC + 0.01) / (x.all + 0.01)) }))
      .sort((a, b) => b.lift - a.lift)
      .filter((x) => {
        const name = x.t.split(':')[1]
        return seenNames.has(name) ? false : (seenNames.add(name), true)
      })
      .slice(0, 4)
      .map((x) => `${prettyKey(x.t)} (${Math.round(x.inC * 100)}%)`)
    const ratings = members.map((m) => m.rating).filter((x): x is number => x !== null)
    clusters.push({
      id: c,
      label: traits.slice(0, 2).map((t) => t.replace(/ \(\d+%\)$/, '')).join(' · '),
      traits,
      n: members.length,
      meanRating: ratings.length ? round(mean(ratings)) : null,
      filmIds: members.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).map((m) => m.film.id),
    })
  }
  return { positions, clusters: clusters.sort((a, b) => b.n - a.n) }
}

function traitSet(r: FilmRecord): Set<string> {
  return new Set([
    ...r.genres.map((g) => `genre:${g}`),
    ...r.subgenres.map((g) => `sub:${g}`),
    ...r.directors.map((d) => `dir:${d}`),
    ...(r.franchise ? [`series:${r.franchise}`] : []),
    ...(r.decade ? [`decade:${r.decade}`] : []),
    ...(r.region && r.region !== 'United States' ? [`region:${r.region}`] : []),
    ...(r.englishLanguage === false ? ['lang:non-english'] : []),
    ...(r.documentary ? ['form:documentary'] : []),
  ])
}

function prettyKey(k: string): string {
  const [kind, value] = k.split(/:(.*)/s)
  if (kind === 'decade') return `${value}s`
  if (kind === 'form') return value === 'animated' ? 'Animated' : 'Documentary'
  if (kind === 'lang') return 'Non-English'
  if (kind === 'dir') return `dir. ${value}`
  return value
}

const keysCount = (vs: SparseVec[]) => vs.reduce((m, v) => Math.max(m, v.idx.length ? v.idx[v.idx.length - 1] + 1 : 0), 0)

/** Spherical k-means (k-means++ init) over sparse unit vectors with dense centroids. */
export function kmeans(vectors: SparseVec[], dims: number, k: number, seed: number, iters = 60): number[] {
  const rand = rng(seed + k)
  const toDense = (v: SparseVec) => {
    const c = new Float64Array(dims)
    v.idx.forEach((ix, t) => (c[ix] = v.val[t]))
    return c
  }
  const dist = (v: SparseVec, c: Float64Array) => {
    let dot = 0
    for (let t = 0; t < v.idx.length; t++) dot += v.val[t] * c[v.idx[t]]
    return 1 - dot
  }
  const centroids: Float64Array[] = [toDense(vectors[Math.floor(rand() * vectors.length)])]
  while (centroids.length < k) {
    const d = vectors.map((v) => Math.min(...centroids.map((c) => dist(v, c))) ** 2)
    const total = d.reduce((acc, x) => acc + x, 0)
    let t = rand() * total
    let idx = 0
    while (idx < d.length - 1 && (t -= d[idx]) > 0) idx++
    centroids.push(toDense(vectors[idx]))
  }
  let labels = new Array<number>(vectors.length).fill(0)
  for (let it = 0; it < iters; it++) {
    const next = vectors.map((v) => {
      let bi = 0, bd = Infinity
      centroids.forEach((c, i) => {
        const d = dist(v, c)
        if (d < bd) [bd, bi] = [d, i]
      })
      return bi
    })
    const changed = next.some((l, i) => l !== labels[i])
    labels = next
    const sums = centroids.map(() => new Float64Array(dims))
    vectors.forEach((v, i) => v.idx.forEach((ix, t) => (sums[labels[i]][ix] += v.val[t])))
    sums.forEach((m, c) => {
      const norm = Math.sqrt(m.reduce((acc, x) => acc + x * x, 0))
      if (norm) centroids[c] = m.map((x) => x / norm)
    })
    if (!changed) break
  }
  return labels
}

/** Mean silhouette (cosine) on a seeded sample of at most `sample` points — O(sample²), not O(n²). */
export function silhouette(vectors: SparseVec[], labels: number[], seed = 1, sample = 400): number {
  const rand = rng(seed)
  const order = vectors.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const pick = order.slice(0, sample)
  const scores = pick.map((i) => {
    const sum = new Map<number, number>(), cnt = new Map<number, number>()
    for (const j of pick) {
      if (i === j) continue
      const c = labels[j]
      sum.set(c, (sum.get(c) ?? 0) + sparseCosineDistance(vectors[i], vectors[j]))
      cnt.set(c, (cnt.get(c) ?? 0) + 1)
    }
    const own = labels[i]
    const a = cnt.get(own) ? sum.get(own)! / cnt.get(own)! : 0
    let b = Infinity
    for (const [c, total] of sum) if (c !== own) b = Math.min(b, total / cnt.get(c)!)
    return Number.isFinite(b) && Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0
  })
  return mean(scores)
}
