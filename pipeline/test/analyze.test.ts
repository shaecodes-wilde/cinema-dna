import { describe, expect, it } from 'vitest'
import type { FilmMetadata, MetadataFile } from '../../shared/types.ts'
import { affinity, baseline, genrePairs } from '../analyze/affinity.ts'
import { analyze } from '../analyze/index.ts'
import { buildRecords, type FilmRecord } from '../analyze/features.ts'
import { analyzeLanguage, countTerms, sentiment, snippet } from '../analyze/language.ts'
import { featureSpace, personIndex, personSignals, trainModel } from '../analyze/model.ts'
import { becauseOf, isKnown, novelty, exposureOf } from '../analyze/recommend.ts'
import { evenness, logOddsZ, mean, ridge, shrink, spearman } from '../analyze/stats.ts'
import { emptyMetadata } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

describe('stats', () => {
  it('shrinks small groups toward the global mean', () => {
    expect(shrink([5], 3.5, 6)).toBeCloseTo((5 + 21) / 7)
    expect(shrink([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 3.5, 6)).toBeGreaterThan(shrink([5], 3.5, 6))
  })
  it('recovers known ridge coefficients', () => {
    const X = Array.from({ length: 200 }, (_, i) => [Math.sin(i), Math.cos(i * 1.7)])
    const y = X.map(([a, b]) => 2 * a - 0.5 * b)
    const w = ridge(X, y, 1e-6)
    expect(w[0]).toBeCloseTo(2, 3)
    expect(w[1]).toBeCloseTo(-0.5, 3)
  })
  it('computes evenness, rank correlation and log-odds direction', () => {
    expect(evenness([5, 5, 5, 5])).toBeCloseTo(1)
    expect(evenness([10, 0, 0, 0])).toBe(0)
    expect(spearman([1, 2, 3], [10, 20, 30])).toBeCloseTo(1)
    expect(logOddsZ(9, 10, 1, 10, 0.5, 1)).toBeGreaterThan(0)
  })
})

/** Synthetic library: 40 rated films whose rating depends on a known trait. */
function syntheticRecords(): FilmRecord[] {
  const recs: FilmRecord[] = []
  for (let i = 0; i < 40; i++) {
    const long = i % 2 === 0
    const rating = long ? 4.5 : 3
    const film = { id: `lb:F${i}`, title: `Film ${i}`, year: 2000 + (i % 20), rating, watched: true, inWatchlist: false, liked: false, isProfileFavorite: false, viewingIds: [], reviewIds: [], listMemberships: [], provenance: [] } as never
    const meta: FilmMetadata = {
      ...emptyMetadata(film, { method: 'letterboxd-id', confidence: 'high', notes: [] }),
      genres: i % 4 === 0 ? ['Drama', 'Comedy'] : ['Drama'],
      runtime: long ? 160 : 95,
      directors: [{ id: `Q${i % 5}`, name: `Director ${i % 5}` }],
      sitelinks: 20,
    }
    recs.push(...buildRecords({ films: [film], viewings: [] } as never, { films: { [`lb:F${i}`]: meta } } as unknown as MetadataFile))
  }
  return recs
}

describe('affinity & model', () => {
  const recs = syntheticRecords()
  const base = baseline(recs)
  it('one 5★ film does not make a genre a favourite', () => {
    const extra = { ...recs[1], film: { ...recs[1].film, id: 'lb:X' }, rating: 5, genres: ['Western'] }
    const rows = affinity('genre', [...recs, extra], (r) => r.genres, baseline([...recs, extra]))
    const western = rows.find((r) => r.key === 'Western')!
    expect(western.n).toBe(1)
    expect(western.confidence).toBe('low')
    expect(western.delta).toBeLessThan(5 - base.mean)
    expect(western.shrunk).toBeLessThan(4)
  })
  it('finds the planted runtime effect with high confidence', () => {
    const rows = affinity('runtime', recs, (r) => (r.runtimeBucket ? [r.runtimeBucket] : []), base)
    expect(rows[0].key).toBe('150+ min')
    expect(rows[0].confidence).toBe('high')
  })
  it('computes genre-pair synergy against the parent genres', () => {
    const rows = affinity('genre', recs, (r) => r.genres, base)
    const pairs = genrePairs(recs, rows, base)
    expect(pairs[0]).toMatchObject({ a: 'Comedy', b: 'Drama' })
  })
  it('people signals exclude the film itself (leave-one-out)', () => {
    const idx = personIndex(recs)
    const s = personSignals(recs[0], idx, base, recs[0].film.id)
    expect(s[0].films).not.toContain(recs[0].film.id)
  })
  it('the taste model beats the constant baseline on a learnable signal', () => {
    const m = trainModel(recs, base)
    expect(m.report.cvRmse).toBeLessThan(m.report.baselineRmse)
    expect(featureSpace(recs).names).toContain('runtime:150+ min')
  })
})

describe('recommendation helpers', () => {
  const recs = syntheticRecords()
  it('excludes already-known films by QID or by title within ±1 year', () => {
    const known = { qids: new Set(['Q99']), titleYears: new Set(['film3:2003']) }
    const c = { ...recs[3], meta: { ...recs[3].meta!, match: { ...recs[3].meta!.match, wikidataId: 'Q1000' } }, film: { ...recs[3].film, year: 2004 } }
    expect(isKnown(c, known)).toBe(true)
    expect(isKnown({ ...c, film: { ...c.film, title: 'Brand New' } }, known)).toBe(false)
  })
  it('explains a candidate with films the user rated ≥ 4 that share its director', () => {
    const cand = { ...recs[2], film: { ...recs[2].film, id: 'wd:Q5' }, rating: null }
    const b = becauseOf(cand, recs)
    expect(b.length).toBeGreaterThan(0)
    expect(b[0].reasons.join(' ')).toContain('same director')
    expect(recs.find((r) => r.film.id === b[0].filmId)!.rating).toBeGreaterThanOrEqual(4)
  })
  it('scores novelty higher for unfamiliar genres', () => {
    const ex = exposureOf(recs)
    const familiar = novelty(recs[0], ex)
    const odd = novelty({ ...recs[0], genres: ['Western'], decade: 1950 }, ex)
    expect(odd).toBeGreaterThan(familiar)
  })
})

describe('review language', () => {
  it('counts terms and scores sentiment', () => {
    expect(countTerms('Great stuff. Really great stuff!', ['great stuff'])).toBe(2)
    expect(sentiment('amazing, loved it')).toBeGreaterThan(0)
    expect(sentiment('boring and messy')).toBeLessThan(0)
    expect(snippet('First. Loved the score! Third.', (t) => /score/.test(t))).toBe('Loved the score!')
  })
  it('computes category lifts from reviews', () => {
    const ds = normalize(fixtureArchive())
    const res = analyzeLanguage(ds.reviews, (r) => r.text.slice(0, 20))
    const visuals = res.categories.find((c) => c.id === 'visuals')!
    expect(visuals.reviews).toBe(1)
    expect(mean([res.meanWords])).toBeGreaterThan(0)
  })
})

describe('end-to-end analysis', () => {
  it('produces a consistent bundle from the fixture export without network', async () => {
    const ds = normalize(fixtureArchive())
    const data = await analyze(ds, null, { discover: false })
    expect(data.totals.watchedFilms).toBe(5)
    expect(data.totals.ratedFilms).toBe(4)
    expect(data.totals.diaryViewings).toBe(5)
    expect(data.totals.rewatchViewings).toBe(1)
    expect(data.totals.meanRating).toBeCloseTo(3)
    // every viewing references a film in the bundle
    const ids = new Set(data.films.map((f) => f.id))
    expect(data.viewings.every((v) => ids.has(v.filmId))).toBe(true)
    // recommendations never include watched films and skip unreleased watchlist titles
    const watched = new Set(data.films.filter((f) => f.watched).map((f) => f.id))
    expect(data.recommendations.every((r) => !r.filmId || !watched.has(r.filmId))).toBe(true)
    expect(data.recommendations.map((r) => r.title)).toEqual(['Delta'])
    expect(data.recommendations[0].uncertain).toBe(true)
    expect(data.critical.revisions).toHaveLength(1)
    expect(data.dna).toHaveLength(12)
    expect(data.report.sections.length).toBeGreaterThan(0)
    expect(data.quality.notes.some((n) => n.includes('metadata'))).toBe(true)
  })
})
