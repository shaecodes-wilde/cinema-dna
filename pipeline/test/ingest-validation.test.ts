import { describe, expect, it } from 'vitest'
import { analyze } from '../analyze/index.ts'
import { isoDate, parseCsv, parseCsvDetailed } from '../ingest/csv.ts'
import { normalize } from '../ingest/normalize.ts'
import { FIXTURE_FILES, fixtureArchive } from './fixtures.ts'

describe('ingest validation', () => {
  it('nulls rating 99 at ratings.csv row 3 and carries the exact note through to Quality', async () => {
    const dataset = normalize(fixtureArchive({
      'ratings.csv': FIXTURE_FILES['ratings.csv'].replace('BBB2,3', 'BBB2,99'),
    }))
    const beta = dataset.films.find((f) => f.id === 'lb:BBB2')!
    expect(beta.rating).toBeNull()
    expect(beta.year).toBe(1999)
    const note = 'ratings.csv: 1 rating outside 0.5–5 in half-star steps ignored (row 3)'
    expect(dataset.audit.notes).toContain(note)
    const data = await analyze(dataset, null, { offline: true, discover: false })
    expect(data.quality.notes).toContain(note)
  })

  it.each(['ratings.csv', 'diary.csv', 'reviews.csv', 'orphaned/diary.csv', 'deleted/reviews.csv'])('validates half-star ratings at the %s call site', (file) => {
    const values = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '', '0', '-1', '5.5', '3.7', '99', 'NaN', 'Infinity', 'bad']
    const rows = values.map((value, i) => `2024-01-01,Film ${i},1999,https://boxd.it/F${i},${value},2024-01-01,Review`)
    const dataset = normalize({ path: 'synthetic', sha256: 'synthetic', files: new Map([
      [file, 'Date,Name,Year,Letterboxd URI,Rating,Watched Date,Review\n' + rows.join('\n')],
    ]) })
    const actual = file === 'ratings.csv' ? values.map((_, i) => dataset.films.find((f) => f.id === `lb:F${i}`)!.rating)
      : file === 'diary.csv' ? dataset.viewings.map((v) => v.rating)
        : file === 'reviews.csv' ? dataset.reviews.map((r) => r.rating)
          : dataset.detached.map((d) => d.rating)
    expect(actual).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, null, null, null, null, null, null, null, null, null])
    expect(dataset.audit.notes).toContain(`${file}: 8 ratings outside 0.5–5 in half-star steps ignored (rows 13, 14, 15, 16, 17, …)`)
  })

  it('keeps numeric years and list positions outside the rating range', () => {
    const dataset = normalize(fixtureArchive({
      'lists/best.csv': FIXTURE_FILES['lists/best.csv'].replace('1,Alpha', '99,Alpha'),
    }))
    expect(dataset.lists[0].entries[0]).toMatchObject({ position: 99, year: 2020 })
  })

  it.each(['2024-02-29', '2000-02-29', '2026-02-28', '2026-12-31'])('accepts real calendar date %s', (value) => {
    expect(isoDate(value)).toBe(value)
  })

  it.each(['2026-02-30', '2025-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026-1-01', 'invalid', '', undefined])('rejects invalid date %s', (value) => {
    expect(isoDate(value)).toBeNull()
  })

  it('nulls an impossible watch date and reports its file and row in Quality', async () => {
    const dataset = normalize(fixtureArchive({
      'diary.csv': FIXTURE_FILES['diary.csv'].replace('2021-03-01', '2026-02-30'),
    }))
    expect(dataset.viewings[0].watchedDate).toBeNull()
    expect(dataset.viewings[0].dateQuality).toBe('missing')
    const note = 'diary.csv: 1 impossible date ignored (row 2)'
    expect(dataset.audit.notes).toContain(note)
    expect((await analyze(dataset, null, { offline: true, discover: false })).quality.notes).toContain(note)
  })

  it('validates dates in film, profile, review, list and detached records', () => {
    const dataset = normalize(fixtureArchive({
      'watched.csv': FIXTURE_FILES['watched.csv'].replace('2023-05-15', '2026-02-30'),
      'profile.csv': FIXTURE_FILES['profile.csv'].replace('2023-05-15', '2026-02-30'),
      'reviews.csv': FIXTURE_FILES['reviews.csv'].replaceAll('2023-08-01', '2026-02-30').replace('2023-07-01', '2026-02-30'),
      'lists/best.csv': FIXTURE_FILES['lists/best.csv'].replace('2024-01-01', '2026-02-30'),
      'orphaned/diary.csv': FIXTURE_FILES['orphaned/diary.csv'].replace('2024-12-08', '2026-02-30').replace('2024-12-07', '2026-02-30'),
    }))
    expect(dataset.films.find((f) => f.id === 'lb:AAA1')!.watchedAddedDate).toBeNull()
    expect(dataset.profile.joinedDate).toBeNull()
    expect(dataset.reviews[0]).toMatchObject({ watchedDate: null, loggedDate: '' })
    expect(dataset.lists[0].createdDate).toBeNull()
    expect(dataset.detached[0]).toMatchObject({ watchedDate: null, loggedDate: null })
    expect(dataset.audit.notes).toContain('lists/best.csv: 1 impossible date ignored (row 3)')
    expect(dataset.audit.notes).toContain('reviews.csv: 2 impossible dates ignored (row 2)')
    expect(dataset.audit.notes).toContain('orphaned/diary.csv: 2 impossible dates ignored (row 2)')
  })

  it('keeps named fields from an extra-column row without crashing and reports the extra columns', async () => {
    const text = 'Date,Name,Year,Letterboxd URI\n2024-01-01, Alpha ,1999,https://boxd.it/A,extra,another\n'
    const detailed = parseCsvDetailed(text)
    expect(detailed.extraColumnRows).toEqual([2])
    expect(parseCsv(text)).toEqual([{ Date: '2024-01-01', Name: 'Alpha', Year: '1999', 'Letterboxd URI': 'https://boxd.it/A' }])
    const dataset = normalize(fixtureArchive({ 'watched.csv': text }))
    expect(dataset.films.find((f) => f.id === 'lb:A')).toMatchObject({ watched: true, year: 1999 })
    const note = 'watched.csv: 1 row with extra unnamed columns (row 2)'
    expect(dataset.audit.notes).toContain(note)
    expect((await analyze(dataset, null, { offline: true, discover: false })).quality.notes).toContain(note)
  })

  it('reports PapaParse field and quote errors with header-inclusive row numbers', async () => {
    const text = 'Date,Name,Year,Letterboxd URI\n2024-01-01,Alpha,1999,https://boxd.it/A\n2024-01-01,"Unterminated'
    const detailed = parseCsvDetailed(text)
    expect(detailed.errors).toContainEqual({ row: 3, message: 'Quoted field unterminated' })
    expect(detailed.errors.some((e) => e.row === 3 && e.message.startsWith('Too few fields:'))).toBe(true)
    const dataset = normalize(fixtureArchive({ 'watched.csv': text }))
    expect(dataset.films.find((f) => f.id === 'lb:A')!.watched).toBe(true)
    const note = dataset.audit.notes.find((n) => n.startsWith('watched.csv: CSV parse issue'))!
    expect(note).toContain('row 3: Quoted field unterminated')
    expect((await analyze(dataset, null, { offline: true, discover: false })).quality.notes).toContain(note)
  })

  it('caps diagnostic row lists and CSV errors at five entries per file and kind', () => {
    const rows = Array.from({ length: 7 }, (_, i) => `2026-02-30,Film ${i},1999,https://boxd.it/F${i},extra`)
    const dataset = normalize(fixtureArchive({
      'watched.csv': 'Date,Name,Year,Letterboxd URI\n' + rows.join('\n'),
    }))
    expect(dataset.audit.notes).toContain('watched.csv: 7 impossible dates ignored (rows 2, 3, 4, 5, 6, …)')
    expect(dataset.audit.notes).toContain('watched.csv: 7 rows with extra unnamed columns (rows 2, 3, 4, 5, 6, …)')
    const parseNotes = dataset.audit.notes.filter((n) => n.startsWith('watched.csv: CSV parse issue'))
    expect(parseNotes).toHaveLength(1)
    expect(parseNotes[0].match(/row \d+/g)).toEqual(['row 2', 'row 3', 'row 4', 'row 5', 'row 6'])
    expect(parseNotes[0].endsWith('; …')).toBe(true)
  })

  it('reports list CSV quote errors and extra columns through the notes route', async () => {
    const dataset = normalize(fixtureArchive({
      'lists/best.csv': FIXTURE_FILES['lists/best.csv'].replace('2,Delta,1972,https://boxd.it/DDD4,', '2,Delta,1972,https://boxd.it/DDD4,,extra') + '3,"Unterminated\n',
    }))
    const notes = dataset.audit.notes.filter((n) => n.startsWith('lists/best.csv:'))
    expect(notes.some((n) => /extra unnamed columns/.test(n))).toBe(true)
    expect(notes.some((n) => /CSV parse issue/.test(n))).toBe(true)
    const data = await analyze(dataset, null, { offline: true, discover: false })
    for (const n of notes) expect(data.quality.notes).toContain(n)
  })
})
