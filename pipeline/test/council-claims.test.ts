import { expect, it } from 'vitest'
import type { AppData } from '../../shared/app-types.ts'
import type { Dataset, FilmMetadata, MetadataFile } from '../../shared/types.ts'
import { analyze } from '../analyze/index.ts'
import { renderReportHtml, renderReportMarkdown, renderTasteAnalysisMarkdown } from '../analyze/report.ts'
import { emptyMetadata } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

function library(ratings: (number | null)[]): Dataset {
  const ds = normalize(fixtureArchive())
  return {
    ...ds,
    films: ratings.map((rating, i) => ({
      ...ds.films[0], id: `lb:Council${i}`, title: `Council film ${i}`, rating,
      watched: true, inWatchlist: false, isProfileFavorite: false,
      viewingIds: [], reviewIds: [], listMemberships: [],
    })),
    viewings: [], reviews: [], lists: [], detached: [], audit: { ...ds.audit, conflicts: [] },
  }
}

function addViewings(ds: Dataset, i: number, ratings: (number | null)[], rewatch = true) {
  ds.viewings.push(...ratings.map((rating, j) => ({
    id: `view:${i}:${j}`, filmId: ds.films[i].id, rating, rewatch: rewatch && j > 0,
    watchedDate: `2024-0${j + 1}-01`, loggedDate: `2024-0${j + 1}-01`,
    dateQuality: 'live' as const, tags: [], reviewId: null, provenance: [],
  })))
}

function metadata(ds: Dataset, fields: (i: number) => Partial<FilmMetadata>): MetadataFile {
  return {
    generatedAt: ds.generatedAt, sources: ['wikidata'], unmatched: [],
    films: Object.fromEntries(ds.films.map((f, i) => [f.id, {
      ...emptyMetadata(f, { method: 'letterboxd-id', confidence: 'high', notes: [] }), ...fields(i),
    }])),
  }
}
const run = (ds: Dataset, meta: MetadataFile | null = null) => analyze(ds, meta, { offline: true, discover: false })
const closing = (data: AppData) => data.report.sections.find((s) => s.kicker === 'VIII.')!.paragraphs.join(' ')

it.each([false, true])('keeps unrated rewatches out of means (rated diary drift = %s)', async (withDrift) => {
  const ds = library([null, null, null, 2, 3, 4, 2, 3, 4])
  for (let i = 0; i < 3; i++) addViewings(ds, i, [null, null])
  if (withDrift) for (let i = 3; i < 9; i++) addViewings(ds, i, [1, ds.films[i].rating], false)
  const data = await run(ds)
  const drift = data.insights.find((i) => i.id === 'rewatch-drift')
  if (withDrift) {
    expect(drift).toBeDefined()
    expect(drift!.stats.some((s) => s.label === 'Avg rating of rewatched films')).toBe(false)
  }
  expect(data.insights.some((i) => i.id === 'rewatch-comfort')).toBe(false)
  for (const text of [JSON.stringify(data.insights), JSON.stringify(data.report), JSON.stringify(data.identity),
    renderReportHtml(data), renderReportMarkdown(data), renderTasteAnalysisMarkdown(data)]) {
    expect(text).not.toMatch(/NaN|Infinity/)
  }
})

it('describes a higher rewatch mean without claiming a top-tier distribution', async () => {
  const ds = library([1, 1, 1, 1, 5, 5, ...Array(6).fill(2)])
  for (let i = 0; i < 6; i++) addViewings(ds, i, [ds.films[i].rating, ds.films[i].rating])
  const comfort = (await run(ds)).insights.find((i) => i.id === 'rewatch-comfort')!
  expect(comfort).toBeDefined()
  expect(comfort.finding + comfort.explanation).not.toMatch(/almost entirely|top-tier/)
  expect(comfort.explanation).toContain('2.33★')
  expect(comfort.explanation).toMatch(/above.*average/)
})

it.each([
  { count: 1, down: 0, shrinks: false },
  { count: 1, down: 1, shrinks: false },
  { count: 2, down: 1, shrinks: false },
  { count: 3, down: 2, shrinks: true },
])('uses revision counts for the closing shrink claim ($down of $count downward)', async ({ count, down, shrinks }) => {
  const ds = library(Array(6).fill(5))
  for (let i = 0; i < 6; i++) addViewings(ds, i, [1, 5])
  ds.audit.conflicts = Array.from({ length: count }, (_, i) => ({
    kind: 'rating-mismatch', filmId: ds.films[i].id, refs: [],
    detail: `latest diary rating ${i < down ? 5 : 1}★, current rating ${i < down ? 1 : 5}★`,
  }))
  expect(closing(await run(ds)).includes('shrink')).toBe(shrinks)
})

it.each([
  { long: false, prestige: false, pair: false },
  { long: false, prestige: false, pair: true },
  { long: true, prestige: false, pair: false },
  { long: false, prestige: true, pair: false },
  { long: true, prestige: true, pair: false },
])('gates closing scale terms on long=$long, prestige=$prestige, pair=$pair', async ({ long, prestige, pair }) => {
  const ds = library([...Array(8).fill(5), ...Array(8).fill(2)])
  const data = await run(ds, metadata(ds, (i) => ({
    runtime: long && i < 8 ? 160 : 95,
    awardsWon: prestige && i < 8 ? ['Academy Award'] : [],
    genres: pair && i < 8 ? ['Comedy', 'Horror'] : ['Drama'],
  })))
  expect(data.insights.some((i) => i.category === 'intersection')).toBe(pair)
  const text = closing(data)
  expect(text.includes('big in every sense')).toBe(long || prestige)
  expect(/— [^.]*\blong\b/.test(text)).toBe(long)
  expect(/— [^.]*\bacclaimed\b/.test(text)).toBe(prestige)
  expect(text).not.toMatch(/ambitious|willing to mix registers/)
  expect(text).not.toMatch(/,\s*\.|—\s*\.|,\s*and\s*\./)
  expect(text).toMatch(/grade them [^.]+\./)
})

it.each([3.5, 4, 4.5])('gates the report’s 4★ recommendation claim at mean %s', async (rating) => {
  const data = await run(library(Array(6).fill(rating)))
  const text = data.report.sections.find((s) => s.kicker === 'I.')!.paragraphs.join(' ')
  expect(text.includes('anything at 4★ is a genuine recommendation')).toBe(rating < 4)
  expect(text).toMatch(/% of your films sit at 3★ or lower[^.]*\./)
})
