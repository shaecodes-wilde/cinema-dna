import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppData, Insight } from '../../shared/app-types.ts'
import type { Dataset, MetadataFile } from '../../shared/types.ts'
import { affinity, baseline, genrePairs, PRIOR_K } from '../analyze/affinity.ts'
import { buildRecords } from '../analyze/features.ts'
import { analyze } from '../analyze/index.ts'
import * as insightModule from '../analyze/insights.ts'
import { renderReportHtml, renderReportMarkdown, renderTasteAnalysisMarkdown } from '../analyze/report.ts'
import { confidenceFor, mean, round, shrink } from '../analyze/stats.ts'
import { emptyMetadata } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

const group = (ratings: number[], genres: string[]) => ratings.map((rating) => ({ rating, genres }))
function library(rows: { rating: number; genres: string[] }[]) {
  const template = normalize(fixtureArchive())
  const dataset: Dataset = {
    ...template,
    films: rows.map(({ rating }, i) => ({
      ...template.films[0], id: `lb:P${i}`, title: `Pair film ${i}`, year: 2020,
      rating, watched: true, inWatchlist: false, liked: false, isProfileFavorite: false,
      viewingIds: [], reviewIds: [], listMemberships: [],
    })),
    viewings: [], reviews: [], lists: [], detached: [],
    audit: { ...template.audit, conflicts: [] },
  }
  const metadata: MetadataFile = {
    generatedAt: dataset.generatedAt, sources: ['wikidata'], unmatched: [],
    films: Object.fromEntries(dataset.films.map((film, i) => [film.id, {
      ...emptyMetadata(film, { method: 'letterboxd-id', confidence: 'high', notes: [] }),
      genres: rows[i].genres,
    }])),
  }
  const records = buildRecords(dataset, metadata)
  const base = baseline(records)
  const genres = affinity('genre', records, (r) => r.genres, base)
  const pairs = genrePairs(records, genres, base)
  return { dataset, metadata, records, base, genres, pairs }
}
const run = (x: ReturnType<typeof library>) => analyze(x.dataset, x.metadata, { discover: false, offline: true })
const pairText = (i: Insight) => [i.title, i.finding, i.explanation, ...i.stats.flatMap((s) => [s.label, s.value])].join(' ')
const banned = /synergy|better together|on its own|lifts both|matter more than the components|great multiplier|better parent|combination is doing work/i
const globalBanned = /synergy|better together|lifts both|matter more than the components|great multiplier/i
function checkPhrases(data: AppData) {
  const intersections = data.insights.filter((i) => i.category === 'intersection')
  const paragraphs = data.report.sections.find((s) => s.kicker === 'II.')?.paragraphs ?? []
  const rendered = [renderReportMarkdown(data), renderReportHtml(data), renderTasteAnalysisMarkdown(data)]
  for (const text of [intersections.map(pairText).join(' '), ...data.identity.intro, ...paragraphs, ...rendered]) {
    expect(text).not.toMatch(banned)
  }
  // RB-C1: the unrelated genre-agnostic finding may say "Runtime bands alone".
  // Check "alone" only in pair-derived prose, including its rendered report paragraphs.
  for (const text of [intersections.map(pairText).join(' '), ...data.identity.intro, ...paragraphs.filter((p) => p.startsWith('Some genre overlaps'))]) {
    expect(text).not.toMatch(/\balone\b/i)
    if (paragraphs.includes(text)) {
      for (const report of rendered.slice(0, 2)) expect(report).toContain(text)
    }
  }
  const strings: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value)
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(data)
  expect([...strings, ...rendered].join(' ')).not.toMatch(globalBanned)
}

afterEach(() => vi.restoreAllMocks())

describe('joint-tag lift', () => {
  it('matches both parent deltas when the cohorts are identical', () => {
    const x = library([
      ...group(Array(5).fill(5), ['Comedy', 'Horror']),
      ...group(Array(45).fill(0.5), ['Drama']),
    ])
    expect(x.pairs).toHaveLength(1)
    for (const genre of x.genres.filter((g) => g.key !== 'Drama')) expect(x.pairs[0].synergy).toBe(genre.delta)
    expect(x.pairs[0].synergy).toBeGreaterThan(0)
  })

  it('does not call below-baseline pairs positive when shrinkage beats their parents', async () => {
    const parentOnly = [...Array(44).fill(2), 2.5]
    const x = library([
      ...group([1.5, 2, 2, 2, 2], ['Comedy', 'Horror']),
      ...group(parentOnly, ['Comedy']), ...group(parentOnly, ['Horror']),
      ...group([...Array(24).fill(5), ...Array(31).fill(4.5)], ['Drama']),
    ])
    expect(x.base.mean).toBe(3)
    const parent = x.genres.find((g) => g.key === 'Horror')!
    expect(parent).toMatchObject({ n: 50, mean: 2 })
    expect(x.pairs[0]).toMatchObject({ n: 5, mean: 1.9, shrunk: 2.5, synergy: -0.5 })
    expect(round(2.5 - (100 + 18) / 56)).toBe(0.39)
    const data = await run(x)
    expect(data.insights.filter((i) => i.category === 'intersection')).toHaveLength(0)
    checkPhrases(data)
  })

  it('persists the rounded formula without reversing any nonzero sign', () => {
    for (let seed = 0; seed < 30; seed++) {
      const x = library([
        ...group(Array.from({ length: 3 + seed }, (_, i) => 0.5 + ((seed * 3 + i) % 10) / 2), ['Comedy', 'Horror']),
        ...group(Array.from({ length: 40 }, (_, i) => 0.5 + ((seed + i * 3) % 10) / 2), ['Drama']),
      ])
      const vals = x.records.filter((r) => r.genres.includes('Comedy') && r.genres.includes('Horror')).map((r) => r.rating!)
      const lift = x.pairs[0].synergy
      expect(lift).toBe(round(shrink(vals, x.base.mean, PRIOR_K.genre) - x.base.mean))
      expect(lift === 0 || Math.sign(lift) === Math.sign(mean(vals) - x.base.mean)).toBe(true)
    }
  })

  it('allows a small positive lift to round to zero', () => {
    const x = library([
      ...group(Array(5).fill(3), ['Comedy', 'Horror']),
      ...group([...Array(93).fill(3), 2.5, 2.5], ['Drama']),
    ])
    expect(x.base.mean).toBe(2.99)
    expect(shrink(Array(5).fill(3), x.base.mean, PRIOR_K.genre) - x.base.mean).toBeCloseTo(0.00454545)
    expect(x.pairs[0].synergy).toBe(0)
  })

  it('uses descriptive insight stats and baseline confidence even below a parent mean', async () => {
    const x = library([
      ...group(Array(5).fill(4), ['Comedy', 'Horror']),
      ...group(Array(10).fill(5), ['Comedy']), ...group(Array(35).fill(1), ['Drama']),
    ])
    const data = await run(x)
    const pair = data.genrePairs[0]
    const insight = data.insights.find((i) => i.id === `pair-${pair.a}-${pair.b}`)!
    expect(pair.mean).toBeLessThan(x.genres.find((g) => g.key === 'Comedy')!.mean)
    expect(pair.synergy).toBeGreaterThan(0)
    expect(insight.title).toBe('Comedy + Horror: a high-rated overlap')
    expect(insight.stats.map((s) => s.label)).toEqual(['All Comedy (incl. these)', 'All Horror (incl. these)', 'Both', 'Vs your average'])
    expect(insight.stats[0].value).toBe('4.67★')
    expect(insight.finding).toContain('+0.86★ vs your average')
    expect(insight.finding).not.toContain('★★')
    expect(insight.explanation).toContain('Descriptive only')
    expect(insight.confidence).toBe(confidenceFor(pair.n, pair.synergy, x.base.sd, PRIOR_K.genre))
    checkPhrases(data)

    const original = insightModule.buildInsights
    vi.spyOn(insightModule, 'buildInsights').mockImplementation((ctx) => {
      const result = original(ctx)
      for (const i of result.insights.filter((i) => i.category === 'intersection')) {
        i.title = 'Opaque heading'
        i.stats = []
      }
      return result
    })
    const structured = await run(x)
    const section = structured.report.sections.find((s) => s.kicker === 'II.')!.paragraphs.join(' ')
    expect(structured.identity.intro.join(' ')).toMatch(/films tagged both comedy and horror rate above your average/i)
    expect(section).toContain('comedy with horror (5 films, +0.86★ vs your average)')
    for (const text of [structured.identity.intro.join(' '), section]) {
      expect(text).not.toMatch(/Opaque heading| × |reaches\s*(?:[.;]|$)/i)
    }
    checkPhrases(structured)
  })
})
