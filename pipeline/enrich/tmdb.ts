import type { FilmMetadata, PersonRef } from '../../shared/types.ts'
import { CachedHttp, HttpError } from './http.ts'
export { HttpError }
import { fromTmdbGenre } from './genres.ts'
import { titleKey } from '../util/slug.ts'

/**
 * Optional TMDB layer. Enabled when TMDB_API_KEY (v3 key) or TMDB_READ_ACCESS_TOKEN (v4 token)
 * is set. Adds posters, overviews, keywords, billing-ordered cast and TMDB genres.
 * "This product uses the TMDB API but is not endorsed or certified by TMDB."
 */
const BASE = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w342'

interface TmdbMovie {
  id: number
  title: string
  release_date?: string
  runtime?: number | null
  overview?: string
  poster_path?: string | null
  genres?: { id: number; name: string }[]
  original_language?: string
  keywords?: { keywords: { id: number; name: string }[] }
  credits?: {
    cast: { id: number; name: string; order: number }[]
    crew: { id: number; name: string; job: string }[]
  }
}

export function tmdbCredentials(): { key?: string; token?: string } | null {
  const key = process.env.TMDB_API_KEY
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  return key || token ? { key, token } : null
}

export class Tmdb {
  private http: CachedHttp
  private key?: string

  constructor(creds: { key?: string; token?: string }, cacheDir: string, offline: boolean, fetchImpl?: typeof fetch) {
    this.key = creds.key
    this.http = new CachedHttp({
      cacheDir,
      minIntervalMs: 60, // TMDB allows ~50 req/s; stay far below
      offline,
      headers: creds.token ? { Authorization: `Bearer ${creds.token}` } : {},
      fetchImpl,
    })
  }

  private url(path: string, params: Record<string, string> = {}) {
    const p = new URLSearchParams(params)
    if (this.key) p.set('api_key', this.key)
    return `${BASE}${path}?${p}`
  }

  async search(title: string, year: number | null): Promise<number | null> {
    const params: Record<string, string> = { query: title, include_adult: 'false' }
    if (year) params.year = String(year)
    const res = await this.http.json<{ results: { id: number; title: string; original_title?: string; release_date?: string }[] }>(
      this.url('/search/movie', params),
    )
    // Only accept a result whose (original) title actually matches and whose year agrees within ±1.
    const want = titleKey(title)
    const hits = (res?.results ?? []).filter(
      (r) =>
        [r.title, r.original_title ?? ''].some((t) => titleKey(t) === want) &&
        (!year || Math.abs(Number(r.release_date?.slice(0, 4)) - year) <= 1),
    )
    return hits.length === 1 || (hits.length > 1 && year) ? hits[0].id : null
  }

  async movie(id: number): Promise<TmdbMovie | null> {
    return this.http.json<TmdbMovie>(this.url(`/movie/${id}`, { append_to_response: 'credits,keywords' }))
  }
}

const people = (list: { id: number; name: string }[]): PersonRef[] => {
  const seen = new Set<number>()
  return list.filter((p) => !seen.has(p.id) && seen.add(p.id)).map((p) => ({ id: `tmdb:${p.id}`, name: p.name }))
}

/** Overlays TMDB data onto Wikidata-derived metadata (TMDB wins for genres, poster, cast order). */
export function applyTmdb(meta: FilmMetadata, m: TmdbMovie): FilmMetadata {
  const crew = m.credits?.crew ?? []
  const byJob = (...jobs: string[]) => people(crew.filter((c) => jobs.includes(c.job)))
  const genres = (m.genres ?? []).map((g) => fromTmdbGenre(g.name)).filter((g): g is NonNullable<typeof g> => !!g)
  const pick = <T,>(tmdb: T[], wd: T[]) => (wd.length ? wd : tmdb)
  return {
    ...meta,
    match: { ...meta.match, tmdbId: m.id },
    runtime: m.runtime || meta.runtime,
    genres: genres.length ? genres : meta.genres,
    cast: m.credits?.cast.length
      ? people([...m.credits.cast].sort((a, b) => a.order - b.order).slice(0, 15))
      : meta.cast,
    directors: pick(byJob('Director'), meta.directors),
    writers: pick(byJob('Screenplay', 'Writer'), meta.writers),
    cinematographers: pick(byJob('Director of Photography'), meta.cinematographers),
    composers: pick(byJob('Original Music Composer', 'Music'), meta.composers),
    posterUrl: m.poster_path ? `${TMDB_IMAGE}${m.poster_path}` : meta.posterUrl,
    overview: m.overview || meta.overview,
    keywords: (m.keywords?.keywords ?? []).map((k) => k.name),
    sources: [...new Set([...meta.sources, 'tmdb'])],
  }
}
