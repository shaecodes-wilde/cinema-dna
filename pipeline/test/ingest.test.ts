import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseCsv, parseListCsv, uriCode } from '../ingest/csv.ts'
import { classifyDate, normalize } from '../ingest/normalize.ts'
import { readExport } from '../ingest/archive.ts'
import { slugify } from '../util/slug.ts'
import { FIXTURE_FILES, fixtureArchive } from './fixtures.ts'

describe('csv parsing', () => {
  it('keeps multi-line quoted review text intact', () => {
    const rows = parseCsv(FIXTURE_FILES['reviews.csv'])
    expect(rows).toHaveLength(2)
    expect(rows[0].Review).toBe('Great stuff.\nLoved the score, gorgeous visuals!')
  })
  it('parses the two-block list format', () => {
    const { meta, entries } = parseListCsv(FIXTURE_FILES['lists/best.csv'])
    expect(meta.Name).toBe('Best Ranked')
    expect(meta.Description).toBe('Mine,\nwith a comma')
    expect(entries.map((e) => e.Name)).toEqual(['Alpha', 'Delta'])
  })
  it('extracts boxd.it codes', () => {
    expect(uriCode('https://boxd.it/AbC9')).toBe('AbC9')
    expect(uriCode('')).toBeNull()
  })
  it('slugifies like Letterboxd', () => {
    expect(slugify("Guy Ritchie's The Covenant")).toBe('guy-ritchies-the-covenant')
    expect(slugify('Amélie')).toBe('amelie')
    expect(slugify('Mission: Impossible – Dead Reckoning')).toBe('mission-impossible-dead-reckoning')
  })
})

describe('normalize', () => {
  const ds = normalize(fixtureArchive(), new Date('2026-01-02T00:00:00Z'))
  const byTitle = (t: string, y: number) => ds.films.find((f) => f.title === t && f.year === y)!

  it('builds one film per film URI and keeps same-title remakes apart', () => {
    expect(byTitle('Fantastic Four', 2015).id).toBe('lb:FF15')
    expect(byTitle('Fantastic Four', 2005).id).toBe('lb:FF05')
    expect(ds.audit.conflicts.filter((c) => c.kind === 'same-title-year-different-uri')).toHaveLength(0)
  })
  it('joins diary entries (entry URIs) to films by title + year and preserves rewatches', () => {
    const alpha = byTitle('Alpha', 2020)
    expect(alpha.viewingIds).toEqual(['d001', 'd005'])
    expect(ds.viewings.find((v) => v.id === 'd005')!.rewatch).toBe(true)
    expect(byTitle('Fantastic Four', 2005).viewingIds).toEqual(['d004'])
    expect(ds.viewings.find((v) => v.id === 'd004')!.tags).toEqual(['cinema', 'imax'])
  })
  it('distinguishes "marked watched" from dated viewings', () => {
    const gamma = byTitle('Gamma', 2023)
    expect(gamma.watched).toBe(true)
    expect(gamma.viewingIds).toHaveLength(0)
    expect(gamma.watchedAddedDate).toBe('2023-06-03')
    expect(ds.audit.counts.watchedWithoutDiary).toBe(1)
  })
  it('flags retro-logged dates', () => {
    expect(ds.viewings.find((v) => v.id === 'd001')!.dateQuality).toBe('backfilled')
    expect(ds.viewings.find((v) => v.id === 'd002')!.dateQuality).toBe('approximate')
    expect(ds.viewings.find((v) => v.id === 'd005')!.dateQuality).toBe('delayed')
    expect(classifyDate('2024-01-01', '2024-01-03', '2023-01-01')).toBe('live')
    expect(classifyDate(null, '2024-01-03', null)).toBe('missing')
  })
  it('detects rating revisions (current rating ≠ last diary rating)', () => {
    const rev = ds.audit.conflicts.filter((c) => c.kind === 'rating-mismatch')
    expect(rev).toHaveLength(1)
    expect(rev[0].detail).toContain('Beta')
    expect(byTitle('Beta', 1999).rating).toBe(3)
  })
  it('links reviews to their diary entry', () => {
    const r = ds.reviews.find((x) => x.id === 'd005')!
    expect(r.viewingId).toBe('d005')
    expect(ds.viewings.find((v) => v.id === 'd005')!.reviewId).toBe('d005')
    expect(r.wordCount).toBe(7)
  })
  it('keeps orphaned content separate from viewing history', () => {
    expect(ds.detached).toHaveLength(2)
    expect(ds.detached.every((d) => d.status === 'orphaned')).toBe(true)
    expect(ds.viewings.some((v) => v.filmId.includes('tv-special'))).toBe(false)
    expect(ds.films.some((f) => f.title === 'Some TV Special')).toBe(false)
  })
  it('captures lists, watchlist, likes, favourites and social counts', () => {
    const list = ds.lists[0]
    expect(list.isRanking).toBe(true)
    expect(list.entries.map((e) => e.filmId)).toEqual(['lb:AAA1', 'lb:DDD4'])
    expect(byTitle('Delta', 1972).inWatchlist).toBe(true)
    expect(byTitle('Delta', 1972).watched).toBe(false)
    expect(byTitle('Alpha', 2020).liked).toBe(true)
    expect(ds.profile.favoriteFilmIds).toEqual(['lb:AAA1'])
    expect(ds.audit.notes.some((n) => n.includes('ZZZZ'))).toBe(true)
    expect(ds.social.likedReviews).toBe(1)
  })
  it('creates title-keyed films only when no film-level record exists, and logs it', () => {
    const ds2 = normalize(fixtureArchive({ 'diary.csv': FIXTURE_FILES['diary.csv'] + '2023-09-01,Unknown Film,2001,https://boxd.it/d009,3,,,2023-09-01\n' }))
    const f = ds2.films.find((x) => x.title === 'Unknown Film')!
    expect(f.id).toBe('ty:unknownfilm:2001')
    expect(f.watched).toBe(true)
    expect(ds2.audit.conflicts.some((c) => c.kind === 'unresolved-title-year')).toBe(true)
  })
  it('reads zip archives without modifying them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cdna-'))
    try {
      const zip = zipSync(Object.fromEntries(Object.entries(FIXTURE_FILES).map(([k, v]) => [k, strToU8(v)])))
      const p = join(dir, 'letterboxd-tester-2026-01-02-03-04-utc.zip')
      writeFileSync(p, zip)
      const a = readExport(p)
      expect(a.files.get('watched.csv')).toBe(FIXTURE_FILES['watched.csv'])
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(normalize(a).source.exportedAt).toBe('2026-01-02T03:04:00Z')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
