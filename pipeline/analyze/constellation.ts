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

export function filmVectors(records: FilmRecord[]): { keys: string[]; vectors: number[][] } {
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
  const keys = [...dims.keys()]
  const vectors = sparse.map((f) => {
    const v = new Array<number>(keys.length).fill(0)
    for (const [k, w] of f) v[dims.get(k)!] = w
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1
    return v.map((x) => x / norm)
  })
  return { keys, vectors }
}

export const cosineDistance = (a: number[], b: number[]) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return 1 - s
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
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(14, usable.length - 1),
    minDist: 0.35,
    spread: 1.2,
    distanceFn: cosineDistance,
    random: rng(seed),
  })
  const raw = umap.fit(vectors)
  // Normalise to [0, 1].
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const pts = raw.map(([x, y]) => [(x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1)])

  // k-means on the high-dimensional vectors; k chosen by silhouette (cosine).
  let best: { k: number; labels: number[]; score: number } = { k: 0, labels: [], score: -Infinity }
  for (let k = 5; k <= Math.min(8, Math.floor(usable.length / 4)); k++) {
    const labels = kmeans(vectors, k, seed)
    const score = silhouette(vectors, labels)
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

export function kmeans(vectors: number[][], k: number, seed: number, iters = 60): number[] {
  const rand = rng(seed + k)
  // k-means++ initialisation
  const centroids: number[][] = [vectors[Math.floor(rand() * vectors.length)]]
  while (centroids.length < k) {
    const d = vectors.map((v) => Math.min(...centroids.map((c) => cosineDistance(v, c))) ** 2)
    const total = d.reduce((a, b) => a + b, 0)
    let t = rand() * total
    let idx = 0
    while (idx < d.length - 1 && (t -= d[idx]) > 0) idx++
    centroids.push(vectors[idx])
  }
  let labels = new Array<number>(vectors.length).fill(0)
  for (let it = 0; it < iters; it++) {
    const next = vectors.map((v) => {
      let bi = 0, bd = Infinity
      centroids.forEach((c, i) => {
        const d = cosineDistance(v, c)
        if (d < bd) [bd, bi] = [d, i]
      })
      return bi
    })
    const changed = next.some((l, i) => l !== labels[i])
    labels = next
    for (let c = 0; c < k; c++) {
      const members = vectors.filter((_, i) => labels[i] === c)
      if (!members.length) continue
      const m = members[0].map((_, j) => mean(members.map((v) => v[j])))
      const norm = Math.sqrt(m.reduce((a, x) => a + x * x, 0)) || 1
      centroids[c] = m.map((x) => x / norm)
    }
    if (!changed) break
  }
  return labels
}

export function silhouette(vectors: number[][], labels: number[]): number {
  const scores = vectors.map((v, i) => {
    const byCluster = new Map<number, number[]>()
    vectors.forEach((w, j) => {
      if (i !== j) byCluster.set(labels[j], [...(byCluster.get(labels[j]) ?? []), cosineDistance(v, w)])
    })
    const a = mean(byCluster.get(labels[i]) ?? [0])
    const b = Math.min(...[...byCluster].filter(([c]) => c !== labels[i]).map(([, ds]) => mean(ds)))
    return Number.isFinite(b) ? (b - a) / Math.max(a, b) : 0
  })
  return mean(scores)
}
