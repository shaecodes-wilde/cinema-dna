import { describe, expect, it } from 'vitest'
import type { AppData } from '../../shared/app-types.ts'
import { analyze } from '../analyze/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { filmKey } from '../util/slug.ts'
import { fixtureArchive } from './fixtures.ts'

/** Builds a synthetic export: `films` rows of [title, year, rating|null, watchedDate|null]. */
function exportOf(films: [string, number, number | null, string | null][]) {
  const watched = ['Date,Name,Year,Letterboxd URI', ...films.map(([t, y], i) => `2023-01-01,"${t}",${y},https://boxd.it/F${i}`)].join('\n')
  const ratingRows = films.map(([t, y, r], i) => (r === null ? null : `2023-01-01,"${t}",${y},https://boxd.it/F${i},${r}`)).filter(Boolean)
  const diary = ['Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date', ...films.map(([t, y, r, d], i) => (d ? `${d},"${t}",${y},https://boxd.it/D${i},${r ?? ''},,,${d}` : null)).filter(Boolean)].join('\n')
  return fixtureArchive({
    'watched.csv': watched + '\n',
    'ratings.csv': ['Date,Name,Year,Letterboxd URI,Rating', ...ratingRows].join('\n') + '\n',
    'diary.csv': diary + '\n',
    'reviews.csv': 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n',
    'likes/films.csv': 'Date,Name,Year,Letterboxd URI\n',
    'lists/best.csv': '',
    'watchlist.csv': 'Date,Name,Year,Letterboxd URI\n',
    'profile.csv': 'Date Joined,Username,Given Name,Family Name,Email Address,Location,Website,Bio,Pronoun,Favorite Films\n2020-01-01,edge,,,,,,,,\n',
  })
}

const finiteEverywhere = (data: AppData) => {
  // JSON turns NaN/Infinity into null; check the raw bundle never carries non-finite numbers.
  const bad: string[] = []
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path)
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`)
  }
  walk(data, '$')
  return bad
}

describe('unusual exports', () => {
  it('survives a library with no ratings at all', async () => {
    const data = await analyze(normalize(exportOf([['A', 2020, null, '2023-02-01'], ['B', 2021, null, null]])), null, { discover: false })
    expect(data.totals.ratedFilms).toBe(0)
    expect(finiteEverywhere(data)).toEqual([])
    expect(data.model.available).toBe(false)
  })

  it('survives a single rating and constant ratings', async () => {
    for (const films of [
      [['A', 2020, 4, '2023-02-01']],
      Array.from({ length: 30 }, (_, i) => [`Film ${i}`, 2000 + i, 3, `2023-0${(i % 9) + 1}-10`]),
    ] as [string, number, number | null, string | null][][]) {
      const data = await analyze(normalize(exportOf(films)), null, { discover: false })
      expect(finiteEverywhere(data)).toEqual([])
    }
  })

  it('handles multi-year diaries without any metadata (evolution insight)', async () => {
    const films: [string, number, number, string][] = []
    for (let i = 0; i < 24; i++) films.push([`Film ${i}`, 2010 + (i % 10), 2 + (i % 4), `${i < 12 ? 2023 : 2024}-0${(i % 9) + 1}-15`])
    const data = await analyze(normalize(exportOf(films)), null, { discover: false })
    expect(data.insights.find((i) => i.id === 'evolution')).toBeTruthy()
    expect(finiteEverywhere(data)).toEqual([])
  })

  it('keeps non-Latin titles from the same year apart', () => {
    expect(filmKey('東京', 2020)).not.toBe(filmKey('大阪', 2020))
    const ds = normalize(exportOf([['東京', 2020, 4, '2023-02-01'], ['大阪', 2020, 2, '2023-03-01']]))
    const tokyo = ds.films.find((f) => f.title === '東京')!
    const osaka = ds.films.find((f) => f.title === '大阪')!
    expect(tokyo.viewingIds).toHaveLength(1)
    expect(osaka.viewingIds).toHaveLength(1)
    expect(ds.audit.conflicts.filter((c) => c.kind === 'same-title-year-different-uri')).toHaveLength(0)
  })

  it('does not call a harsh grader generous', async () => {
    const films = Array.from({ length: 20 }, (_, i) => [`Film ${i}`, 2000 + i, i % 2 ? 1 : 2, `2023-03-${String(i + 1).padStart(2, '0')}`]) as [string, number, number, string][]
    const data = await analyze(normalize(exportOf(films)), null, { discover: false })
    const g = data.insights.find((i) => i.id === 'generosity')!
    expect(g.title).not.toMatch(/generous/i)
    expect(g.finding).not.toMatch(/below-average grade/)
  })
})

describe('title keys', () => {
  it('distinguishes voiced kana and ignores Latin accents/punctuation', () => {
    expect(filmKey('が', 2000)).not.toBe(filmKey('か', 2000))
    expect(filmKey('Amélie', 2001)).toBe(filmKey('Amelie', 2001))
    expect(filmKey("Guy Ritchie's The Covenant", 2023)).toBe(filmKey('Guy Ritchies The Covenant', 2023))
  })
})

describe('archive layout', () => {
  it('handles re-zipped exports with a top-level folder and __MACOSX junk', async () => {
    const { normalizeLayout } = await import('../ingest/archive.ts')
    const files = normalizeLayout(new Map([
      ['letterboxd-me-2026/watched.csv', 'Date,Name,Year,Letterboxd URI\n'],
      ['letterboxd-me-2026/lists/x.csv', 'v'],
      ['__MACOSX/letterboxd-me-2026/._watched.csv', 'junk'],
    ]))
    expect([...files.keys()].sort()).toEqual(['lists/x.csv', 'watched.csv'])
  })
  it('refuses archives that are not Letterboxd exports', async () => {
    const { normalizeLayout } = await import('../ingest/archive.ts')
    expect(() => normalizeLayout(new Map([['photos/a.csv', 'x']]), 'holiday.zip')).toThrow(/doesn't look like a Letterboxd export/)
  })
})
