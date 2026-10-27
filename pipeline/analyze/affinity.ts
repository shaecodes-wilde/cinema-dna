import type { AffinityRow, GenrePair } from '../../shared/app-types.ts'
import type { FilmRecord } from './features.ts'
import { confidenceFor, mean, round, sd, shrink, shrunkInterval } from './stats.ts'

export interface Baseline {
  mean: number
  sd: number
  n: number
}

export function baseline(records: FilmRecord[]): Baseline {
  const r = records.map((x) => x.rating).filter((x): x is number => x !== null)
  return { mean: mean(r), sd: sd(r), n: r.length }
}

/** Prior strength (pseudo-films) per dimension: broad buckets get more shrinkage than people. */
export const PRIOR_K: Record<string, number> = {
  genre: 6, subgenre: 5, decade: 6, runtime: 6, region: 6, country: 5, language: 5, notability: 6,
  prestige: 5, franchise: 4, director: 3, writer: 3, cast: 3, cinematographer: 3, composer: 3,
}

/**
 * Groups rated films by `keys(record)` and returns empirical-Bayes affinity rows.
 * A film can belong to several groups (e.g. several genres).
 */
export function affinity(
  kind: string,
  records: FilmRecord[],
  keys: (r: FilmRecord) => string[],
  base: Baseline,
  minN = 1,
): AffinityRow[] {
  const k = PRIOR_K[kind] ?? 4
  const groups = new Map<string, FilmRecord[]>()
  for (const r of records) {
    if (r.rating === null) continue
    for (const key of new Set(keys(r))) groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const rows: AffinityRow[] = []
  for (const [key, rs] of groups) {
    if (rs.length < minN) continue
    const vals = rs.map((r) => r.rating!)
    const s = shrink(vals, base.mean, k)
    const delta = s - base.mean
    const [lo, hi] = shrunkInterval(vals, base.mean, base.sd, k)
    rows.push({
      kind,
      key,
      label: key,
      n: rs.length,
      mean: round(mean(vals)),
      shrunk: round(s),
      delta: round(delta),
      ci: [round(lo), round(hi)],
      sd: round(sd(vals)),
      share: round(rs.length / base.n, 4),
      topShare: round(vals.filter((v) => v >= 4.5).length / vals.length, 3),
      confidence: confidenceFor(rs.length, delta, base.sd, k),
      filmIds: rs.sort((a, b) => b.rating! - a.rating!).map((r) => r.film.id),
    })
  }
  return rows.sort((a, b) => b.delta - a.delta || b.n - a.n)
}

/** Genre pairs: shrunk joint-tag mean minus your baseline (descriptive overlap, not an interaction). */
export function genrePairs(records: FilmRecord[], _genreRows: AffinityRow[], base: Baseline, minN = 3): GenrePair[] {
  const pairs = new Map<string, FilmRecord[]>()
  for (const r of records) {
    if (r.rating === null) continue
    const gs = [...new Set(r.genres)].sort()
    for (let i = 0; i < gs.length; i++)
      for (let j = i + 1; j < gs.length; j++) {
        const key = `${gs[i]}|${gs[j]}`
        pairs.set(key, [...(pairs.get(key) ?? []), r])
      }
  }
  const out: GenrePair[] = []
  for (const [key, rs] of pairs) {
    if (rs.length < minN) continue
    const [a, b] = key.split('|')
    const vals = rs.map((r) => r.rating!)
    const s = shrink(vals, base.mean, PRIOR_K.genre)
    out.push({
      a,
      b,
      n: rs.length,
      mean: round(mean(vals)),
      shrunk: round(s),
      synergy: round(s - base.mean),
      filmIds: rs.sort((x, y) => y.rating! - x.rating!).map((r) => r.film.id),
    })
  }
  return out.sort((x, y) => y.synergy - x.synergy)
}
