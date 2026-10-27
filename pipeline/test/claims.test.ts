import { describe, expect, it } from 'vitest'
import type { AppData } from '../../shared/app-types.ts'
import type { Dataset, FilmMetadata, MetadataFile } from '../../shared/types.ts'
import { baseline } from '../analyze/affinity.ts'
import { buildConstellation } from '../analyze/constellation.ts'
import { buildRecords } from '../analyze/features.ts'
import { analyze } from '../analyze/index.ts'
import { analyzeLanguage } from '../analyze/language.ts'
import { predict, trainModel } from '../analyze/model.ts'
import { exposureOf, scoreCandidate } from '../analyze/recommend.ts'
import { renderReportHtml, renderReportMarkdown, renderTasteAnalysisMarkdown } from '../analyze/report.ts'
import { emptyMetadata } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

function library(ratings: (number | null)[]): Dataset {
  const ds = normalize(fixtureArchive())
  const template = ds.films[0]
  return {
    ...ds,
    films: ratings.map((rating, i) => ({
      ...template, id: `lb:C${i}`, title: `Claim film ${i}`, year: 2020,
      rating, watched: true, inWatchlist: false, isProfileFavorite: false,
      viewingIds: [], reviewIds: [], listMemberships: [],
    })),
    viewings: [], reviews: [], lists: [], detached: [],
    audit: { ...ds.audit, conflicts: [] },
  }
}

function metadata(ds: Dataset, fields: (i: number) => Partial<FilmMetadata>): MetadataFile {
  return {
    generatedAt: ds.generatedAt, sources: ['wikidata'], unmatched: [],
    films: Object.fromEntries(ds.films.map((film, i) => [film.id, {
      ...emptyMetadata(film, { method: 'letterboxd-id', confidence: 'high', notes: [] }), ...fields(i),
    }])),
  }
}

function rewatches(first: number[], last: number[]): Dataset {
  const ds = library(last)
  ds.viewings = ds.films.flatMap((film, i) => [first[i], last[i]].map((rating, j) => ({
    id: `view:${i}:${j}`, filmId: film.id, rating, rewatch: j === 1,
    watchedDate: `2024-0${j + 1}-01`, loggedDate: `2024-0${j + 1}-01`,
    dateQuality: 'live' as const, tags: [], reviewId: null, provenance: [],
  })))
  return ds
}

const run = (ds: Dataset, meta: MetadataFile | null = null) => analyze(ds, meta, { offline: true, discover: false })
const allProse = (data: AppData) => [
  JSON.stringify(data.insights), ...data.identity.intro,
  renderReportHtml(data), renderReportMarkdown(data), renderTasteAnalysisMarkdown(data),
].join('\n')
const modelSection = (data: AppData) => renderTasteAnalysisMarkdown(data).split('## Taste model')[1].split('## Top recommendations')[0]

describe('evidence-backed claims', () => {
  it.each([
    { first: 1, last: 5, direction: 'raise', forbidden: /lower|cool|deepen/ },
    { first: 5, last: 1, direction: 'lower', forbidden: /raise|deepen|warm/ },
  ])('matches rewatch title, explanation and intro to $first→$last', async ({ first, last, direction, forbidden }) => {
    const ds = rewatches(Array(4).fill(first), Array(4).fill(last))
    ds.films.push(...library([last, last]).films.map((film, i) => ({ ...film, id: `lb:NoRewatch${i}` })))
    const data = await run(ds)
    const drift = data.insights.find((i) => i.id === 'rewatch-drift')!
    expect(drift.title).toMatch(direction === 'raise' ? /warm/ : /cool/)
    expect(drift.explanation).toContain(direction)
    expect(drift.title + drift.explanation).not.toMatch(forbidden)
    expect(data.identity.intro.join(' ')).toContain(`rewatches tend to ${direction} your stars`)
    expect(data.identity.intro.join(' ')).not.toContain(`rewatches tend to ${direction === 'raise' ? 'lower' : 'raise'}`)
    expect(allProse(data).match(/NaN|Infinity|real signal/g)).toBeNull()
  })

  it('makes no directional claim for tied rewatch counts', async () => {
    const data = await run(rewatches([1, 1, 5, 5, 3, 3], [5, 5, 1, 1, 3, 3]))
    const drift = data.insights.find((i) => i.id === 'rewatch-drift')!
    expect(drift.title).toBe('How your ratings move on a second look')
    expect(drift.explanation).toContain('both ways about equally')
    expect(data.identity.intro.join(' ')).not.toMatch(/rewatches tend to (raise|lower)/)
  })

  it.each([0, 1, 2, 3])('requires at least two revisions and a downward majority (down = %i)', async (down) => {
    const ds = rewatches(Array(6).fill(1), Array(6).fill(5))
    const count = down === 1 ? 1 : 3
    ds.audit.conflicts = Array.from({ length: count }, (_, i) => ({
      kind: 'rating-mismatch', filmId: ds.films[i].id, refs: [],
      detail: `latest diary rating ${i < down ? 5 : 1}★, current rating ${i < down ? 1 : 5}★`,
    }))
    const drift = (await run(ds)).insights.find((i) => i.id === 'rewatch-drift')!
    expect(drift.title.includes('hindsight cools')).toBe(down >= 2)
    expect(drift.explanation.includes('without a rewatch tends to lower')).toBe(down >= 2)
  })

  it.each([1, 3, 5])('gates top-tier rewatch prose on the mean (rewatch rating = %i)', async (rating) => {
    const ds = rewatches(Array(6).fill(rating), Array(6).fill(rating))
    const other = library(Array(6).fill(3)).films.map((f, i) => ({ ...f, id: `lb:Other${i}` }))
    ds.films.push(...other)
    const comfort = (await run(ds)).insights.find((i) => i.id === 'rewatch-comfort')!
    expect(comfort.explanation.includes('top-tier')).toBe(rating === 5)
    expect(comfort.explanation.includes('same as, or below')).toBe(rating !== 5)
  })

  it('skips the whole runtime card without a comparison band, even with a positive long-film lift', async () => {
    const ds = library([...Array(5).fill(5), ...Array(5).fill(1)])
    const meta = metadata(ds, () => ({ runtime: 160 }))
    for (const f of ds.films.slice(5)) delete meta.films[f.id]
    const data = await run(ds, meta)
    expect(data.affinities.runtime).toHaveLength(1)
    expect(data.affinities.runtime[0].delta).toBeGreaterThan(0.15)
    expect(data.insights.some((i) => i.id === 'runtime')).toBe(false)
  })

  it.each([0, 4, 5])('requires five comparison films for the five-star insight (midSet = %i)', async (n) => {
    const data = await run(library([...Array(5).fill(5), ...Array(n).fill(3)]))
    expect(data.insights.some((i) => i.id === 'five-star-formula')).toBe(n >= 5)
  })

  it.each([1.5, 2.5, 3, 3.25])('gates narrative grading claims on the actual mean (%f)', async (rating) => {
    const data = await run(library(Array(10).fill(rating)))
    const prose = renderReportMarkdown(data)
    expect(prose.includes('below-average grade')).toBe(rating > 3)
    expect(prose.includes('grade them warmly')).toBe(rating >= 3.25)
    expect(prose).not.toContain('a minority')
    expect(prose).toContain(`${rating <= 3 ? 100 : 0}% of your films sit at 3★ or lower`)
  })

  it('counts rated films for most-rated director, ignoring more numerous unrated watches', async () => {
    const ds = library([4, 4, 4, 5, 5, 5, 5, ...Array(8).fill(null)])
    const data = await run(ds, metadata(ds, (i) => ({
      directors: [{ id: i < 3 || i >= 7 ? 'Q1' : 'Q2', name: i < 3 || i >= 7 ? 'More watched' : 'More rated' }],
    })))
    const loyalty = data.insights.find((i) => i.id === 'director-loyalty')!
    expect(loyalty.title).toContain('More rated: most-rated')
    expect(loyalty.finding).toContain('More rated is your most-rated director (4 rated films')
    expect(loyalty.title + loyalty.finding).not.toContain('most-watched')
  })
})

describe('honest model report', () => {
  it('keeps the review-word average finite without rated reviews', () => {
    expect(analyzeLanguage([], () => '').meanWords).toBe(0)
  })

  it('omits model numbers for ten varied ratings, below the training threshold', async () => {
    const data = await run(library(Array.from({ length: 10 }, (_, i) => i % 2 ? 2 : 4)))
    expect(data.model.available).toBe(false)
    expect(modelSection(data)).not.toContain('RMSE')
    expect(allProse(data).match(/NaN|Infinity|real signal/g)).toBeNull()
  })
  it.each([10, 30])('omits unavailable model numbers for %i constant ratings', async (n) => {
    const data = await run(library(Array(n).fill(3)))
    expect(data.model.available).toBe(false)
    expect(modelSection(data)).toContain('does not beat guessing your average')
    expect(modelSection(data)).not.toMatch(/RMSE|Strongest|λ =/)
    expect(allProse(data)).not.toMatch(/NaN|Infinity|real signal/)
    expect(renderTasteAnalysisMarkdown(data)).not.toContain('mostly documentaries')
  })

  it('labels the entire successful model section as a development estimate with same-fold tuning', async () => {
    const data = await run(library(Array(10).fill(3)))
    data.model = { ...data.model, available: true, cvRmse: 0.4, baselineRmse: 0.8, correlation: 0.5 }
    const text = modelSection(data)
    expect(text).toMatch(/development cross-validation estimate; λ tuned on the same folds/i)
    expect(text).toContain('selection optimism, magnitude unknown')
    expect(text).toContain('feature vocabulary is built before the folds; effect unmeasured')
    expect(text).toContain('RMSE **0.4★** vs **0.8★**')
    expect(text).not.toMatch(/NaN|Infinity|real signal/)
  })

  it.each([
    [false, 0.4, 0.8], [true, 0.9, 0.8], [true, 0.8, 0.8],
    [true, 0, 0], [true, 0.4, -1], [true, 0.4, Infinity],
    [true, 0.4, NaN], [true, Infinity, 0.8], [true, NaN, 0.8],
  ])('omits unsupported model numbers (available=%s, RMSE=%s, baseline=%s)', async (available, cvRmse, baselineRmse) => {
    const data = await run(library(Array(10).fill(3)))
    data.model = { ...data.model, available, cvRmse, baselineRmse }
    expect(modelSection(data)).toContain('does not beat guessing your average')
    expect(modelSection(data)).not.toMatch(/RMSE|NaN|Infinity|real signal/)
  })
})

describe('recommendation explanations', () => {
  const ds = library(Array(6).fill(3))
  const records = buildRecords(ds, metadata(ds, () => ({ genres: ['Drama'] })))
  const candidate = records[0]
  const trained = trainModel(records, baseline(records))
  const model = {
    ...trained, intercept: 3, weights: [0.4, -1, 1, 0.6], colMeans: [0.5, 0.5, 0.5, 0.5],
    space: {
      names: ['genre:Drama', 'genre:Horror', 'genre:Comedy', 'decade:2020s'],
      labels: ['Drama', 'Horror', 'Comedy', 'Released in the 2020s'],
      vector: (r: typeof candidate) => [Number(r.genres.includes('Drama')), Number(r.genres.includes('Horror')), Number(r.genres.includes('Comedy')), Number(r.decade === 2020)],
    },
  }
  const score = (c = candidate, m = model) => scoreCandidate(c, {
    model: m, rated: [], exposure: exposureOf(records), genreRows: [],
  }, 'watchlist', [], (id) => id, () => null)

  it('keeps absent-feature contributions in predictions but out of reasons and caveats', () => {
    const prediction = predict(model, candidate)
    expect(prediction.contributions.map((c) => [c.name, c.present])).toEqual([
      ['genre:Drama', true], ['genre:Horror', false], ['genre:Comedy', false], ['decade:2020s', true],
    ])
    // 3 + .4*(1-.5) - 1*(0-.5) + 1*(0-.5) + .6*(1-.5)
    expect(prediction.value).toBe(3.5)
    const rec = score()
    expect(rec.predicted).toBe(3.5)
    expect(rec.reasons.join(' ')).not.toMatch(/Horror|Comedy/)
    expect(rec.reasons.some((r) => r.includes('Selected supporting factor — Drama'))).toBe(true)
  })

  it('retains caveats about features actually present', () => {
    const rec = score(candidate, { ...model, weights: [-0.4, -1, 1, 0.6] })
    expect(rec.reasons.some((r) => /Caveat.*drama/.test(r))).toBe(true)
    expect(rec.reasons.join(' ')).not.toMatch(/Horror|Comedy/)
  })

  it('describes metadata-less predictions accurately without changing their value', () => {
    const [bare] = buildRecords({ ...ds, films: [ds.films[0]] }, null)
    const rec = score(bare)
    // Export decade and centered absent features still contribute: 3 - .2 + .5 - .5 + .3.
    expect(rec.predicted).toBe(3.1)
    expect(rec.uncertainty.join(' ')).toContain('missing details can still shift the score')
    expect(rec.uncertainty.join(' ')).not.toContain('your average only')
  })
})

describe('genre evidence pools and constellation traits', () => {
  it('uses only known genres for Range evidence and every Dark proportion', async () => {
    const ds = library(Array(70).fill(3))
    const fields = (i: number) => ({ genres: i < 60 ? [] : i < 65 ? ['Horror'] : ['Drama'] })
    const data = await run(ds, metadata(ds, fields))
    const range = data.dna.find((d) => d.id === 'range')!
    const dark = data.dna.find((d) => d.id === 'dark')!
    for (const dim of [range, dark]) {
      expect(dim.n).toBe(10)
      expect(dim.confidence).not.toBe('high')
    }
    expect(range.stats).toEqual([{ label: 'Horror', value: '50%' }, { label: 'Drama', value: '50%' }])
    expect(dark.score).toBe(50)
    expect(dark.headline).toMatch(/^50%/)
    expect(dark.value).toBe('5 of 10 films')
    expect(dark.stats.find((s) => s.label === 'Horror')?.value).toBe('50%')
    expect(dark.filmIds.every((id) => ds.films.slice(60, 65).some((f) => f.id === id))).toBe(true)
    const known = library(Array(10).fill(3))
    const reference = await run(known, metadata(known, (i) => fields(i + 60)))
    expect(range.score).toBe(reference.dna.find((d) => d.id === 'range')!.score)
    for (const id of ['franchise', 'prestige', 'world']) {
      expect(data.dna.find((d) => d.id === id)!.n).toBe(id === 'world' ? 0 : 70)
    }
    expect(allProse(data)).not.toMatch(/NaN|Infinity|real signal/)
  })

  it('deduplicates Drama/drama cluster traits case-insensitively', () => {
    const ds = library(Array(16).fill(3))
    const records = buildRecords(ds, metadata(ds, () => ({ genres: ['Drama'], subgenres: ['drama'] })))
    const { clusters } = buildConstellation(records)
    expect(clusters.length).toBeGreaterThan(0)
    for (const cluster of clusters) {
      const traits = cluster.traits.map((t) => t.replace(/ \(\d+%\)$/, '').toLowerCase())
      expect(traits.filter((t) => t === 'drama')).toHaveLength(1)
      expect(new Set(traits).size).toBe(traits.length)
    }
  })
})
