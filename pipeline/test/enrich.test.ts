import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { canonicalGenres, isPlainGenre, subgenreLabel } from '../enrich/genres.ts'
import { CachedHttp, redactUrl } from '../enrich/http.ts'
import { emptyMetadata, toMetadata } from '../enrich/index.ts'
import { pickBest, scoreCandidate, slugCandidates } from '../enrich/match.ts'
import { Tmdb, applyTmdb } from '../enrich/tmdb.ts'
import type { CompactEntity } from '../enrich/wikidata.ts'

const entity = (over: Partial<CompactEntity> & { claims?: Record<string, string[]> }): CompactEntity => ({
  id: 'Q1', label: 'Alpha', description: '2020 film', aliases: [], sitelinks: 20, claims: { P31: ['Q11424'], P577: ['2020-05-01T00:00:00Z'] }, ...over,
})

describe('identity matching', () => {
  it('generates Letterboxd-style slug candidates', () => {
    expect(slugCandidates({ title: 'Fantastic Four', year: 2015 })).toEqual(['fantastic-four', 'fantastic-four-2015', 'fantastic-four-1', 'fantastic-four-2'])
  })
  it('accepts exact title + year with high confidence', () => {
    expect(scoreCandidate({ title: 'Alpha', year: 2020 }, entity({}), false)?.confidence).toBe('high')
  })
  it('rejects a remake from a different year', () => {
    expect(scoreCandidate({ title: 'Alpha', year: 2005 }, entity({}), false)).toBeNull()
  })
  it('rejects undated items found by search but trusts an explicit Letterboxd ID', () => {
    const undated = entity({ claims: { P31: ['Q5398426'] }, description: 'American television series' })
    expect(scoreCandidate({ title: 'Alpha', year: 2020 }, undated, false)).toBeNull()
    expect(scoreCandidate({ title: 'Alpha', year: 2020 }, undated, true)?.confidence).toBe('medium')
  })
  it('rejects non-film items (e.g. a musical work) from search', () => {
    expect(scoreCandidate({ title: 'Alpha', year: 2020 }, entity({ claims: { P31: ['Q105543609'], P577: ['2020'] }, description: 'work by a composer' }), false)).toBeNull()
  })
  it('downgrades ambiguous near-ties', () => {
    const a = scoreCandidate({ title: 'Alpha', year: 2020 }, entity({ id: 'Q1', sitelinks: 10 }), false)
    const b = scoreCandidate({ title: 'Alpha', year: 2020 }, entity({ id: 'Q2', sitelinks: 12 }), false)
    expect(pickBest([a, b])?.confidence).toBe('medium')
  })
})

describe('genre normalisation', () => {
  it('maps source labels onto the canonical vocabulary', () => {
    expect(canonicalGenres('psychological thriller film')).toEqual(['Thriller'])
    expect(canonicalGenres('superhero film').sort()).toEqual(['Action', 'Adventure'])
    expect(canonicalGenres('comedy-drama').sort()).toEqual(['Comedy', 'Drama'])
    expect(canonicalGenres('science fiction film')).toEqual(['Science Fiction'])
    expect(canonicalGenres('LGBTQ-related film')).toEqual([])
    expect(subgenreLabel('neo-noir film')).toBe('neo-noir')
    expect(isPlainGenre('action')).toBe(true)
    expect(isPlainGenre('neo-noir')).toBe(false)
  })
})

describe('metadata projection', () => {
  it('builds typed metadata from an entity with labels resolved', () => {
    const labels: Record<string, string> = { Q130232: 'drama film', Q1: 'Alpha', Q42: 'Jane Director', Q30: 'United States', Q1860: 'English', Q202866: 'animated film' }
    const m = toMetadata({ id: 'lb:A', title: 'Alpha', year: 2020 }, entity({ claims: { P31: ['Q202866'], P577: ['2020-05-01T00:00:00Z'], P136: ['Q130232'], P57: ['Q42'], P495: ['Q30'], P364: ['Q1860'], P2047: ['101'], P4947: ['123'] } }), { label: (id) => labels[id] ?? id }, { method: 'letterboxd-id', confidence: 'high', notes: [] })
    expect(m.genres).toEqual(['Animation', 'Drama'])
    expect(m.directors).toEqual([{ id: 'Q42', name: 'Jane Director' }])
    expect(m.runtime).toBe(101)
    expect(m.isAnimated).toBe(true)
    expect(m.match.tmdbId).toBe(123)
    expect(m.countries).toEqual(['United States'])
  })
})

describe('http cache', () => {
  it('serves cached responses and never hits the network offline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cdna-http-'))
    try {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
      const http = new CachedHttp({ cacheDir: dir, minIntervalMs: 0, offline: false, fetchImpl: fetchImpl as unknown as typeof fetch })
      expect(await http.json('https://x.test/a')).toEqual({ ok: 1 })
      expect(await http.json('https://x.test/a')).toEqual({ ok: 1 })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const offline = new CachedHttp({ cacheDir: dir, minIntervalMs: 0, offline: true, fetchImpl: fetchImpl as unknown as typeof fetch })
      expect(await offline.json('https://x.test/b')).toBeNull()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('credential hygiene', () => {
  it('never puts API keys into error messages', async () => {
    expect(redactUrl('https://api.themoviedb.org/3/search/movie?query=x&api_key=SECRET123')).toBe('https://api.themoviedb.org/3/search/movie?query=x&api_key=REDACTED')
    const dir = mkdtempSync(join(tmpdir(), 'cdna-redact-'))
    try {
      const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
      const http = new CachedHttp({ cacheDir: dir, minIntervalMs: 0, offline: false, fetchImpl: fetchImpl as unknown as typeof fetch })
      await expect(http.json('https://api.themoviedb.org/3/movie/1?api_key=SECRET123')).rejects.toThrow(/api_key=REDACTED/)
      await expect(http.json('https://api.themoviedb.org/3/movie/1?api_key=SECRET123')).rejects.not.toThrow(/SECRET123/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('TMDB layer (mocked)', () => {
  it('searches with year and overlays poster, genres and billing-ordered cast', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cdna-tmdb-'))
    try {
      const calls: string[] = []
      const fetchImpl = vi.fn(async (url: string) => {
        calls.push(url)
        const body = url.includes('/search/movie')
          ? { results: [{ id: 7, title: 'Alpha', release_date: '2020-05-01' }] }
          : { id: 7, title: 'Alpha', runtime: 99, poster_path: '/p.jpg', overview: 'o', genres: [{ id: 1, name: 'Drama' }, { id: 2, name: 'TV Movie' }], keywords: { keywords: [{ id: 1, name: 'grief' }] }, credits: { cast: [{ id: 2, name: 'B', order: 1 }, { id: 1, name: 'A', order: 0 }], crew: [{ id: 3, name: 'D', job: 'Director' }] } }
        return new Response(JSON.stringify(body), { status: 200 })
      })
      const tmdb = new Tmdb({ key: 'k' }, dir, false, fetchImpl as unknown as typeof fetch)
      const id = await tmdb.search('Alpha', 2020)
      expect(id).toBe(7)
      expect(calls[0]).toContain('year=2020')
      expect(calls[0]).toContain('api_key=k')
      const movie = (await tmdb.movie(7))!
      const meta = applyTmdb(emptyMetadata({ id: 'lb:A', title: 'Alpha', year: 2020 } as never, { method: 'tmdb-search', confidence: 'medium', notes: [] }), movie)
      expect(meta.posterUrl).toBe('https://image.tmdb.org/t/p/w342/p.jpg')
      expect(meta.genres).toEqual(['Drama'])
      expect(meta.cast.map((c) => c.name)).toEqual(['A', 'B'])
      expect(meta.directors.map((d) => d.name)).toEqual(['D'])
      expect(meta.keywords).toEqual(['grief'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
