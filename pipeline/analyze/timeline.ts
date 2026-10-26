import type { AppData } from '../../shared/app-types.ts'
import type { Viewing } from '../../shared/types.ts'
import type { FilmRecord } from './features.ts'
import { releaseLag } from './features.ts'
import { mean, round } from './stats.ts'

/** Viewing-history aggregates. Only trustworthy dates (not backfilled/approximate) are used. */
export function buildTimeline(records: FilmRecord[], viewings: Viewing[]): AppData['timeline'] {
  const byId = new Map(records.map((r) => [r.film.id, r]))
  const dated = viewings.filter((v) => v.watchedDate && (v.dateQuality === 'live' || v.dateQuality === 'delayed'))

  const monthMap = new Map<string, Viewing[]>()
  for (const v of dated) {
    const m = v.watchedDate!.slice(0, 7)
    monthMap.set(m, [...(monthMap.get(m) ?? []), v])
  }
  // Fill gaps so the series is continuous.
  const keys = [...monthMap.keys()].sort()
  const months: AppData['timeline']['months'] = []
  if (keys.length) {
    let [y, m] = keys[0].split('-').map(Number)
    const [ey, em] = keys.at(-1)!.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      const vs = monthMap.get(key) ?? []
      const ratings = vs.map((v) => v.rating).filter((x): x is number => x !== null)
      const firsts = vs.filter((v) => !v.rewatch)
      const fresh = firsts.filter((v) => {
        const f = byId.get(v.filmId)?.film
        return f?.year && Number(v.watchedDate!.slice(0, 4)) - f.year <= 1
      })
      months.push({
        month: key,
        viewings: vs.length,
        rewatches: vs.filter((v) => v.rewatch).length,
        meanRating: ratings.length ? round(mean(ratings)) : null,
        newReleaseShare: firsts.length ? round(fresh.length / firsts.length, 3) : null,
      })
      if (++m > 12) [y, m] = [y + 1, 1]
    }
  }

  const yearMap = new Map<number, Viewing[]>()
  for (const v of dated) {
    const y = Number(v.watchedDate!.slice(0, 4))
    yearMap.set(y, [...(yearMap.get(y) ?? []), v])
  }
  const years = [...yearMap]
    .sort((a, b) => a[0] - b[0])
    .map(([year, vs]) => {
      const ratings = vs.map((v) => v.rating).filter((x): x is number => x !== null)
      const films = [...new Set(vs.map((v) => v.filmId))].map((id) => byId.get(id)!).filter(Boolean)
      const withGenres = films.filter((f) => f.genres.length)
      const genreShares: Record<string, number> = {}
      for (const f of withGenres) for (const g of f.genres) genreShares[g] = (genreShares[g] ?? 0) + 1 / withGenres.length
      for (const g of Object.keys(genreShares)) genreShares[g] = round(genreShares[g], 3)
      const releaseYears = films.map((f) => f.film.year).filter((y): y is number => !!y)
      // Top films of the year: highest rating given in that year's diary entries.
      const best = new Map<string, number>()
      for (const v of vs) if (v.rating !== null) best.set(v.filmId, Math.max(best.get(v.filmId) ?? 0, v.rating))
      return {
        year,
        viewings: vs.length,
        meanRating: ratings.length ? round(mean(ratings)) : null,
        meanReleaseYear: releaseYears.length ? round(mean(releaseYears), 1) : null,
        topFilmIds: [...best].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id),
        genreShares,
      }
    })

  const lagDays = records
    .map((r) => ({ filmId: r.film.id, lag: releaseLag(r) }))
    .filter((x): x is { filmId: string; lag: number } => x.lag !== null)
  return { months, years, lagDays }
}
