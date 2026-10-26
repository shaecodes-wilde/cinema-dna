/**
 * Compact invariant oracle for the synthetic audit export, never personal data.
 * Counts, rating statistics, histogram and genre means were checked by the stdlib-only
 * reproduction/runtime/recompute.py.txt; read its README for scope and limitations.
 * Changing an expected value requires justification in the PR. Targeted defect
 * regressions belong with their repair PRs (PR1–PR5), not in this fixture.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../../shared/app-types.ts'
import type { MetadataFile } from '../../shared/types.ts'
import { analyze } from '../analyze/index.ts'
import { normalize } from '../ingest/normalize.ts'

interface IndependentMetrics {
  totals: { metric: keyof AppData['totals']; independent: number }[]
  affinities: { genre: string; n: number; rawMean: number; shrunk: number; ci: [number, number] }[]
  ratingDistribution: AppData['critical']['distribution']
}

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../../docs/audit-evidence/results/runtime/${name}`, import.meta.url), 'utf8')) as T
}

const displayRound = (value: number) => Math.round(value * 100) / 100

describe('independently checked synthetic metrics', () => {
  const now = new Date('2026-10-26T00:00:00Z')
  const sources = readFixture<Record<string, string>>('synthetic-source-files.json')
  const metadata = readFixture<MetadataFile>('synthetic-metadata.json')
  const reference = readFixture<IndependentMetrics>('independent-recomputation.json')
  const dataset = normalize({ path: 'synthetic', sha256: 'synthetic', files: new Map(Object.entries(sources)) }, now)
  let data: AppData

  beforeAll(async () => {
    // Metadata must join the freshly normalized CSVs, not a preserved generated dataset.
    const filmIds = new Set(dataset.films.map((film) => film.id))
    expect(Object.keys(metadata.films).filter((id) => !filmIds.has(id))).toEqual([])
    vi.useFakeTimers({ toFake: ['Date'], now })
    data = await analyze(dataset, metadata, { offline: true, discover: false })
  })

  afterAll(() => vi.useRealTimers())

  it('matches all 11 independently computed totals and rating summary values', () => {
    expect(reference.totals).toHaveLength(11)
    for (const { metric, independent } of reference.totals) {
      expect(data.totals[metric], metric).toBe(independent)
    }
  })

  it('matches the complete independently counted rating histogram', () => {
    expect(data.critical.distribution).toEqual(reference.ratingDistribution)
  })

  it('matches all 13 independently computed genre counts, raw means, shrunk means and intervals', () => {
    expect(reference.affinities).toHaveLength(13)
    const actual = Object.fromEntries(data.affinities.genre.map(({ key, n, mean, shrunk, ci }) => [key, { n, mean, shrunk, ci }]))
    const expected = Object.fromEntries(reference.affinities.map(({ genre, n, rawMean, shrunk, ci }) => [genre, { n, mean: rawMean, shrunk, ci }]))
    expect(actual).toEqual(expected)
  })

  // These cover the fixture's three cohort sizes: largest (57), middle (29), smallest (28).
  it.each(['Drama', 'Crime', 'Animation'])('recomputes %s shrinkage, interval and evidence IDs from raw records', (genre) => {
    const rated = dataset.films.filter((film) => film.watched && film.rating !== null)
    const ratings = rated.map((film) => film.rating!)
    const mu = ratings.reduce((total, rating) => total + rating, 0) / ratings.length
    const sampleSd = Math.sqrt(ratings.reduce((total, rating) => total + (rating - mu) ** 2, 0) / (ratings.length - 1))
    const films = rated.filter((film) => {
      const meta = metadata.films[film.id]
      return meta && meta.match.confidence !== 'low' && meta.genres.includes(genre)
    })
    const n = films.length
    // Specified independently of the app's PRIOR_K so a changed prior fails this check.
    const k = 6
    // Independent arithmetic: (Σr + k·μ)/(n + k), then ±1.645·SD/√(n + k).
    // Use unrounded baseline values; only the final displayed values get rounded.
    const shrunk = (films.reduce((total, film) => total + film.rating!, 0) + k * mu) / (n + k)
    const margin = 1.645 * sampleSd / Math.sqrt(n + k)
    const row = data.affinities.genre.find((entry) => entry.key === genre)!
    expect(row.shrunk).toBe(displayRound(shrunk))
    expect(row.ci).toEqual([displayRound(shrunk - margin), displayRound(shrunk + margin)])
    expect(row.filmIds).toHaveLength(n)
    expect(new Set(row.filmIds)).toEqual(new Set(films.map((film) => film.id)))
  })
})
