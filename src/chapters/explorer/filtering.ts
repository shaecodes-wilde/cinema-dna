import type { AppFilm, AppViewing } from '../../../shared/app-types.ts'
import type { ExplorerFilter } from '../../lib/data.tsx'

export type SortKey = 'title' | 'year' | 'rating' | 'predicted' | 'firstWatched' | 'viewings' | 'runtime' | 'director'

export const STATUS_LABEL: Record<ExplorerFilter['status'], string> = {
  all: 'All films',
  watched: 'Watched',
  watchlist: 'Watchlist (unwatched)',
  rated: 'Rated',
  reviewed: 'Reviewed',
  rewatched: 'Rewatched',
  liked: 'Liked',
}

export function watchYears(viewings: AppViewing[]): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>()
  for (const v of viewings) {
    if (!v.date) continue
    const s = m.get(v.filmId) ?? new Set<number>()
    s.add(Number(v.date.slice(0, 4)))
    m.set(v.filmId, s)
  }
  return m
}

const people = (f: AppFilm) => [...f.directors, ...f.writers, ...f.cast, ...f.cinematographers, ...f.composers]

export function applyFilter(films: AppFilm[], f: ExplorerFilter, years: Map<string, Set<number>>): AppFilm[] {
  const q = f.query.trim().toLowerCase()
  return films.filter((film) => {
    switch (f.status) {
      case 'watched':
        if (!film.watched) return false
        break
      case 'watchlist':
        if (!film.inWatchlist || film.watched) return false
        break
      case 'rated':
        if (film.rating === null) return false
        break
      case 'reviewed':
        if (!film.reviews.length) return false
        break
      case 'rewatched':
        if (!film.rewatchCount) return false
        break
      case 'liked':
        if (!film.liked) return false
        break
    }
    if (f.genre && !film.genres.includes(f.genre)) return false
    if (f.person) {
      // Exact names arrive from drill-downs; partial names while typing in the search box.
      const needle = f.person.toLowerCase()
      if (!people(film).some((p) => p.toLowerCase().includes(needle))) return false
    }
    if (f.decade !== null && film.decade !== f.decade) return false
    if (f.minRating > 0 && (film.rating === null || film.rating < f.minRating)) return false
    if (f.watchedYear !== null && !years.get(film.id)?.has(f.watchedYear)) return false
    if (q && !`${film.title} ${people(film).join(' ')}`.toLowerCase().includes(q)) return false
    return true
  })
}

const cmpNullLast = (a: number | string | null, b: number | string | null, dir: 1 | -1) => {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a < b ? -1 : a > b ? 1 : 0) * dir
}

export function sortFilms(films: AppFilm[], key: SortKey, dir: 1 | -1): AppFilm[] {
  const val = (f: AppFilm): number | string | null => {
    switch (key) {
      case 'title':
        return f.title.toLowerCase()
      case 'year':
        return f.year
      case 'rating':
        return f.rating
      case 'predicted':
        return f.predicted
      case 'firstWatched':
        return f.firstWatched
      case 'viewings':
        return f.viewingCount
      case 'runtime':
        return f.runtime
      case 'director':
        return f.directors[0]?.toLowerCase() ?? null
    }
  }
  return [...films].sort((a, b) => cmpNullLast(val(a), val(b), dir) || a.title.localeCompare(b.title))
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(films: AppFilm[]): string {
  const header = ['title', 'year', 'rating', 'predicted', 'liked', 'watched', 'in_watchlist', 'first_watched', 'last_watched', 'viewings', 'rewatches', 'runtime', 'directors', 'genres', 'countries', 'wikidata_id']
  const rows = films.map((f) =>
    [f.title, f.year, f.rating, f.predicted, f.liked, f.watched, f.inWatchlist, f.firstWatched, f.lastWatched, f.viewingCount, f.rewatchCount, f.runtime, f.directors.join('; '), f.genres.join('; '), f.countries.join('; '), f.wikidataId]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}
