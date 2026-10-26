import type { ModelReport } from '../../shared/app-types.ts'
import type { Baseline } from './affinity.ts'
import type { FilmRecord } from './features.ts'
import { dot, mean, pearson, ridge, rng, round, shrink } from './stats.ts'

/**
 * Explainable taste model: ridge regression of your star rating on film attributes, plus
 * "people affinity" features (how you rated *other* films by the same director, writer, cast…).
 * People affinities are computed leave-one-out for training rows so a film never explains itself.
 */

type PersonRole = 'directors' | 'writers' | 'cast' | 'cinematographers' | 'composers'
const ROLES: PersonRole[] = ['directors', 'writers', 'cast', 'cinematographers', 'composers']
export const ROLE_LABEL: Record<PersonRole, string> = {
  directors: 'director',
  writers: 'writer',
  cast: 'cast',
  cinematographers: 'cinematographer',
  composers: 'composer',
}

export interface PersonIndex {
  /** role → person → [filmId, rating][] */
  byRole: Record<PersonRole, Map<string, [string, number][]>>
}

export function personIndex(rated: FilmRecord[]): PersonIndex {
  const byRole = Object.fromEntries(ROLES.map((r) => [r, new Map<string, [string, number][]>()])) as PersonIndex['byRole']
  for (const r of rated) {
    for (const role of ROLES) {
      for (const p of r[role]) {
        const m = byRole[role]
        m.set(p, [...(m.get(p) ?? []), [r.film.id, r.rating!]])
      }
    }
  }
  return { byRole }
}

export interface PersonSignal {
  role: PersonRole
  person: string
  delta: number
  films: string[]
}

/** Affinity signals for a film's people, excluding `excludeId` (leave-one-out). */
export function personSignals(r: FilmRecord, idx: PersonIndex, base: Baseline, excludeId?: string): PersonSignal[] {
  const out: PersonSignal[] = []
  for (const role of ROLES) {
    for (const p of r[role]) {
      const others = (idx.byRole[role].get(p) ?? []).filter(([id]) => id !== excludeId)
      if (!others.length) continue
      const k = role === 'cast' ? 3 : 2
      const delta = shrink(others.map(([, v]) => v), base.mean, k) - base.mean
      out.push({ role, person: p, delta, films: others.map(([id]) => id) })
    }
  }
  return out
}

export interface FeatureSpace {
  names: string[]
  labels: string[]
  vector: (r: FilmRecord, signals: PersonSignal[]) => number[]
}

const roleFeature = (role: PersonRole) => `people:${role}`

export function featureSpace(rated: FilmRecord[]): FeatureSpace {
  const count = (keys: (r: FilmRecord) => (string | null)[]) => {
    const m = new Map<string, number>()
    for (const r of rated) for (const k of new Set(keys(r))) if (k) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const keep = (m: Map<string, number>, min: number, prefix: string) =>
    [...m].filter(([, n]) => n >= min).map(([k]) => `${prefix}:${k}`).sort()
  const names = [
    ...keep(count((r) => r.genres), 3, 'genre'),
    ...keep(count((r) => r.subgenres), 5, 'sub'),
    ...keep(count((r) => [r.decade ? `${r.decade}s` : null]), 3, 'decade'),
    ...keep(count((r) => [r.runtimeBucket]), 3, 'runtime'),
    ...keep(count((r) => [r.region]), 3, 'region'),
    ...keep(count((r) => [r.notability]), 3, 'notability'),
    'flag:non-English',
    'flag:franchise',
    'flag:awards-recognised',
    ...ROLES.map(roleFeature),
  ]
  const index = new Map(names.map((n, i) => [n, i]))
  const vector = (r: FilmRecord, signals: PersonSignal[]) => {
    const v = new Array<number>(names.length).fill(0)
    const set = (k: string, x = 1) => {
      const i = index.get(k)
      if (i !== undefined) v[i] = x
    }
    r.genres.forEach((g) => set(`genre:${g}`))
    r.subgenres.forEach((g) => set(`sub:${g}`))
    if (r.decade) set(`decade:${r.decade}s`)
    if (r.runtimeBucket) set(`runtime:${r.runtimeBucket}`)
    if (r.region) set(`region:${r.region}`)
    if (r.notability) set(`notability:${r.notability}`)
    if (r.englishLanguage === false) set('flag:non-English')
    if (r.franchise) set('flag:franchise')
    if (r.prestige.length) set('flag:awards-recognised')
    for (const role of ROLES) {
      const s = signals.filter((x) => x.role === role)
      if (s.length) set(roleFeature(role), mean(s.map((x) => x.delta)))
    }
    return v
  }
  return { names, labels: names.map(featureLabel), vector }
}

export function featureLabel(name: string): string {
  const [kind, value] = name.split(/:(.*)/s)
  switch (kind) {
    case 'genre': return value
    case 'sub': return value
    case 'decade': return `Released in the ${value}`
    case 'runtime': return `Runtime ${value}`
    case 'region': return `Made in ${value}`
    case 'notability': return { canon: 'Global-canon notability', 'well-known': 'Widely known', mid: 'Mid-profile', niche: 'Niche / low-profile' }[value] ?? value
    case 'flag': return { 'non-English': 'Not in English', franchise: 'Part of a franchise/series', 'awards-recognised': 'Major-award recognised' }[value] ?? value
    case 'people': return `Track record of its ${ROLE_LABEL[value as PersonRole]}${value === 'cast' ? '' : 's'}`
    default: return name
  }
}

export interface TrainedModel {
  space: FeatureSpace
  weights: number[]
  colMeans: number[]
  intercept: number
  lambda: number
  report: ModelReport
  /** cross-validated predictions for rated films */
  cvPredictions: Map<string, number>
  index: PersonIndex
  base: Baseline
}

export function trainModel(rated: FilmRecord[], base: Baseline, seed = 7): TrainedModel {
  const space = featureSpace(rated)
  const index = personIndex(rated)
  const X = rated.map((r) => space.vector(r, personSignals(r, index, base, r.film.id)))
  const y = rated.map((r) => r.rating!)

  // 10-fold CV over a λ grid.
  const folds = rated.map((_, i) => i % 10)
  const rand = rng(seed)
  for (let i = folds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[folds[i], folds[j]] = [folds[j], folds[i]]
  }
  const fitPredict = (trainIdx: number[], testIdx: number[], lambda: number) => {
    const ty = trainIdx.map((i) => y[i])
    const my = mean(ty)
    const cm = space.names.map((_, j) => mean(trainIdx.map((i) => X[i][j])))
    const Xc = trainIdx.map((i) => X[i].map((x, j) => x - cm[j]))
    const w = ridge(Xc, ty.map((v) => v - my), lambda)
    return testIdx.map((i) => clamp(my + dot(w, X[i].map((x, j) => x - cm[j]))))
  }
  let best = { lambda: 10, rmse: Infinity, preds: [] as number[] }
  for (const lambda of [1, 2, 4, 8, 16, 32, 64]) {
    const preds = new Array<number>(y.length)
    for (let f = 0; f < 10; f++) {
      const test = y.map((_, i) => i).filter((i) => folds[i] === f)
      const train = y.map((_, i) => i).filter((i) => folds[i] !== f)
      fitPredict(train, test, lambda).forEach((p, k) => (preds[test[k]] = p))
    }
    const rmse = Math.sqrt(mean(preds.map((p, i) => (p - y[i]) ** 2)))
    if (rmse < best.rmse) best = { lambda, rmse, preds }
  }
  // Baseline: predict the training-fold mean.
  const basePreds = y.map((_, i) => mean(y.filter((__, j) => folds[j] !== folds[i])))
  const baselineRmse = Math.sqrt(mean(basePreds.map((p, i) => (p - y[i]) ** 2)))

  const colMeans = space.names.map((_, j) => mean(X.map((row) => row[j])))
  const weights = ridge(X.map((row) => row.map((x, j) => x - colMeans[j])), y.map((v) => v - mean(y)), best.lambda)
  const ranked = space.names.map((n, i) => ({ feature: featureLabel(n), weight: round(weights[i], 3) }))
  return {
    space,
    weights,
    colMeans,
    intercept: mean(y),
    lambda: best.lambda,
    index,
    base,
    cvPredictions: new Map(rated.map((r, i) => [r.film.id, round(best.preds[i], 2)])),
    report: {
      n: rated.length,
      features: space.names.length,
      lambda: best.lambda,
      cvRmse: round(best.rmse, 3),
      baselineRmse: round(baselineRmse, 3),
      cvMae: round(mean(best.preds.map((p, i) => Math.abs(p - y[i]))), 3),
      correlation: round(pearson(best.preds, y), 3),
      topPositive: [...ranked].sort((a, b) => b.weight - a.weight).slice(0, 8),
      topNegative: [...ranked].sort((a, b) => a.weight - b.weight).slice(0, 8),
    },
  }
}

const clamp = (x: number) => Math.max(0.5, Math.min(5, x))

export interface Prediction {
  value: number
  contributions: { name: string; label: string; value: number }[]
  signals: PersonSignal[]
}

export function predict(model: TrainedModel, r: FilmRecord, excludeSelf = false): Prediction {
  const signals = personSignals(r, model.index, model.base, excludeSelf ? r.film.id : undefined)
  const x = model.space.vector(r, signals)
  const contributions = model.space.names.map((name, j) => ({
    name,
    label: model.space.labels[j],
    value: model.weights[j] * (x[j] - model.colMeans[j]),
  }))
  const value = clamp(model.intercept + contributions.reduce((a, c) => a + c.value, 0))
  return { value: round(value, 2), contributions: contributions.filter((c) => Math.abs(c.value) > 0.005), signals }
}
