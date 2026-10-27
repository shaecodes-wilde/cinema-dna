import { describe, expect, it } from 'vitest'
import type { MetadataFile } from '../../shared/types.ts'
import { buildRecords } from '../analyze/features.ts'
import { analyze } from '../analyze/index.ts'
import { isKnown, watchedElsewhere } from '../analyze/recommend.ts'
import { emptyMetadata } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { titleKey } from '../util/slug.ts'

interface Entry {
  id: string
  title: string
  year: number
  watched?: boolean
  inWatchlist?: boolean
  qid?: string
  lowConfidence?: boolean
}

function library(entries: Entry[]) {
  const csv = (selected: Entry[]) => 'Date,Name,Year,Letterboxd URI\n' + selected
    .map((e) => `2024-01-01,${e.title},${e.year},https://boxd.it/${e.id}\n`).join('')
  const dataset = normalize({
    path: 'synthetic', sha256: 'synthetic', files: new Map([
      ['watched.csv', csv(entries.filter((e) => e.watched))],
      ['watchlist.csv', csv(entries.filter((e) => e.inWatchlist))],
    ]),
  })
  const metadata: MetadataFile = {
    generatedAt: dataset.generatedAt, sources: ['wikidata'], unmatched: [],
    films: Object.fromEntries(dataset.films.flatMap((film) => {
      const entry = entries.find((e) => `lb:${e.id}` === film.id)!
      if (entry.qid === undefined) return []
      const meta = emptyMetadata(film, {
        method: 'letterboxd-id', confidence: entry.lowConfidence ? 'low' : 'high',
        notes: [],
      })
      meta.match.wikidataId = entry.qid
      return [[film.id, meta]]
    })),
  }
  return { dataset, metadata }
}

const run = ({ dataset, metadata }: ReturnType<typeof library>) => analyze(dataset, metadata, { offline: true, discover: false })

describe('watchlist watched exclusion', () => {
  it('T1: excludes a different record with the same watched QID, preserving survivor predictions', async () => {
    const entries: Entry[] = [
      { id: 'X0', title: 'Original record', year: 2000, watched: true, qid: 'Q123456' },
      { id: 'X6', title: 'Duplicate record', year: 2000, inWatchlist: true, qid: 'Q123456' },
      { id: 'X7', title: 'Another film', year: 2001, inWatchlist: true, qid: 'Q7' },
    ]
    const before = await run(library(entries.map((e) => e.id === 'X6' ? { ...e, qid: 'Q6' } : e)))
    expect(before.recommendations.map((r) => r.filmId).sort()).toEqual(['lb:X6', 'lb:X7'])
    const after = await run(library(entries))
    expect(after.recommendations.map((r) => r.filmId)).toEqual(['lb:X7'])
    expect(after.recommendations[0].predicted).toBe(before.recommendations.find((r) => r.filmId === 'lb:X7')!.predicted)
  })

  it('T2: keeps a same-title adjacent-year remake with a different QID', async () => {
    const data = await run(library([
      { id: 'X0', title: 'Suspiria', year: 2018, watched: true, qid: 'Q999' },
      { id: 'X6', title: 'Suspiria', year: 2017, inWatchlist: true, qid: 'Q888' },
    ]))
    expect(data.recommendations.map((r) => r.filmId)).toEqual(['lb:X6'])
  })

  it('T3: keeps a metadata-unmatched same-title adjacent-year record', async () => {
    const data = await run(library([
      { id: 'X0', title: 'Suspiria', year: 2018, watched: true, qid: 'Q999' },
      { id: 'X6', title: 'Suspiria', year: 2017, inWatchlist: true },
    ]))
    expect(data.recommendations.map((r) => r.filmId)).toEqual(['lb:X6'])
  })

  it('T4: keeps an unmatched duplicate and reports both Letterboxd IDs in the identity conflict', async () => {
    const input = library([
      { id: 'A', title: 'Mother', year: 2009, watched: true },
      { id: 'B', title: 'Mother', year: 2009, inWatchlist: true },
    ])
    const conflict = input.dataset.audit.conflicts.find((c) => c.kind === 'same-title-year-different-uri')!
    expect(conflict.detail).toContain('lb:A')
    expect(conflict.detail).toContain('lb:B')
    expect((await run(input)).recommendations.map((r) => r.filmId)).toEqual(['lb:B'])
  })

  it('T5: preserves every eligible recommendation without watched QID overlap', async () => {
    const input = library([
      { id: 'A', title: 'Watched', year: 2000, watched: true, inWatchlist: true, qid: 'Q1' },
      { id: 'B', title: 'Known metadata', year: 2001, inWatchlist: true, qid: 'Q2' },
      { id: 'C', title: 'No metadata', year: 2002, inWatchlist: true },
      { id: 'D', title: 'Future film', year: new Date().getUTCFullYear() + 1, inWatchlist: true, qid: 'Q3' },
      { id: 'E', title: 'Shared unwatched QID', year: 2001, inWatchlist: true, qid: 'Q2' },
    ])
    const legacy = input.dataset.films.filter((f) => f.inWatchlist && !f.watched && (!f.year || f.year <= new Date().getUTCFullYear()))
    const recommendations = (await run(input)).recommendations
    expect(legacy).toHaveLength(3)
    expect(recommendations.map((r) => r.filmId).sort()).toEqual(legacy.map((f) => f.id).sort())
  })

  it('T6: keeps discovery dedup against all known records by QID or title within one year', () => {
    const { dataset, metadata } = library([
      { id: 'A', title: 'Watched', year: 2000, watched: true, qid: 'Q1' },
      { id: 'B', title: 'Watchlist', year: 2001, inWatchlist: true, qid: 'Q2' },
    ])
    const records = buildRecords(dataset, metadata)
    const known = {
      qids: new Set(records.map((r) => r.meta!.match.wikidataId!)),
      titleYears: new Set(records.map((r) => `${titleKey(r.film.title)}:${r.film.year}`)),
    }
    const candidate = records.find((r) => r.film.id === 'lb:B')!
    expect(isKnown({ ...candidate, film: { ...candidate.film, title: 'Different title' } }, known)).toBe(true)
    expect(isKnown({ ...candidate, meta: null, film: { ...candidate.film, year: 2002 } }, known)).toBe(true)
    expect(isKnown({ ...candidate, meta: null, film: { ...candidate.film, title: 'New film' } }, known)).toBe(false)
  })

  it.each(['', 'q123', 'Q', 'https://www.wikidata.org/wiki/Q123'])('ignores invalid QID %j', async (qid) => {
    const input = library([
      { id: 'A', title: 'Watched', year: 2000, watched: true, qid },
      { id: 'B', title: 'Candidate', year: 2001, inWatchlist: true, qid },
    ])
    const candidate = buildRecords(input.dataset, input.metadata).find((r) => r.film.id === 'lb:B')!
    expect(watchedElsewhere(candidate, new Set([qid]))).toBe(false)
    expect((await run(input)).recommendations.map((r) => r.filmId)).toEqual(['lb:B'])
  })

  it.each(['A', 'B'])('ignores a low-confidence match on record %s', async (id) => {
    const input = library([
      { id: 'A', title: 'Watched', year: 2000, watched: true, qid: 'Q123', lowConfidence: id === 'A' },
      { id: 'B', title: 'Candidate', year: 2001, inWatchlist: true, qid: 'Q123', lowConfidence: id === 'B' },
    ])
    expect((await run(input)).recommendations.map((r) => r.filmId)).toEqual(['lb:B'])
  })
})
