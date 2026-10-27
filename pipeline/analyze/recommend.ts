import type { Recommendation } from '../../shared/app-types.ts'
import type { Film, FilmMetadata, MetadataFile } from '../../shared/types.ts'
import { toMetadata } from '../enrich/index.ts'
import type { Wikidata } from '../enrich/wikidata.ts'
import { FILM_CLASSES, isFilmLike, yearsOf } from '../enrich/wikidata.ts'
import { titleKey } from '../util/slug.ts'
import type { AffinityRow } from '../../shared/app-types.ts'
import type { FilmRecord } from './features.ts'
import { buildRecords } from './features.ts'
import { predict, ROLE_LABEL, type TrainedModel } from './model.ts'
import { round } from './stats.ts'

export const MOODS: { id: string; test: (r: FilmRecord) => boolean }[] = [
  { id: 'Pulse-pounding', test: (r) => r.genres.some((g) => ['Thriller', 'Action', 'Crime'].includes(g)) },
  { id: 'Dark & unsettling', test: (r) => r.genres.includes('Horror') || r.subgenres.some((s) => /psycholog|black comedy|neo-noir|body horror/i.test(s)) },
  { id: 'Laugh-out-loud', test: (r) => r.genres.includes('Comedy') && !r.genres.includes('Horror') },
  { id: 'Mind-bending', test: (r) => r.genres.some((g) => ['Science Fiction', 'Mystery', 'Fantasy'].includes(g)) || r.subgenres.some((s) => /surreal|psycholog|absurd/i.test(s)) },
  { id: 'Heartfelt', test: (r) => r.genres.some((g) => ['Romance', 'Family'].includes(g)) || (r.genres.includes('Drama') && !r.genres.some((g) => ['Thriller', 'Horror', 'Crime', 'War', 'Action'].includes(g))) },
  { id: 'Epic & sweeping', test: (r) => r.genres.some((g) => ['Adventure', 'War', 'History', 'Western'].includes(g)) || (r.runtime ?? 0) >= 150 },
  { id: 'Animated', test: (r) => r.animated },
  { id: 'True stories', test: (r) => r.documentary || r.subgenres.some((s) => /biograph|true crime|docu/i.test(s)) },
]

/** Major-award items used to seed an "acclaimed films" discovery pool (nominations or wins). */
const CANON_AWARDS = {
  Q102427: 'Academy Award for Best Picture',
  Q105304: 'Academy Award for Best International Feature Film',
  Q106800: 'Academy Award for Best Animated Feature',
  Q41417: 'Academy Award for Best Original Screenplay',
  Q179808: "Palme d'Or",
  Q209459: 'Golden Lion',
  Q154590: 'Golden Bear',
} as const

export interface DiscoveryPool {
  /** QID → reasons it entered the pool */
  via: Map<string, string[]>
}

/**
 * Builds a pool of real, released films from Wikidata: other work by people whose films you
 * rate above your baseline, plus major-award nominees in genres where you have positive affinity.
 */
export async function discoverPool(
  wd: Wikidata,
  people: { qid: string; name: string; role: 'director' | 'writer' | 'cinematographer' | 'cast'; delta: number }[],
  maxCandidates: number,
): Promise<DiscoveryPool> {
  const via = new Map<string, string[]>()
  const add = (qid: string, why: string) => via.set(qid, [...new Set([...(via.get(qid) ?? []), why])])
  const prop = { director: 'P57', writer: 'P58', cinematographer: 'P344', cast: 'P161' } as const
  const classes = [...FILM_CLASSES].slice(0, 6).map((c) => `wd:${c}`).join(' ')
  const thisYear = new Date().getUTCFullYear()

  for (const role of Object.keys(prop) as (keyof typeof prop)[]) {
    const ps = people.filter((p) => p.role === role)
    for (let i = 0; i < ps.length; i += 40) {
      const batch = ps.slice(i, i + 40)
      const minLinks = role === 'cast' ? 25 : 8
      const rows = await wd.sparql(`SELECT DISTINCT ?film ?person ?sl WHERE {
        VALUES ?person { ${batch.map((p) => `wd:${p.qid}`).join(' ')} }
        ?film wdt:${prop[role]} ?person ; wdt:P31 ?type ; wikibase:sitelinks ?sl ; wdt:P577 ?date .
        VALUES ?type { ${classes} }
        FILTER(?sl >= ${minLinks} && YEAR(?date) <= ${thisYear})
      }`)
      for (const r of rows) {
        const person = batch.find((p) => r.person.value.endsWith(`/${p.qid}`))!
        add(r.film.value.split('/').pop()!, `${role === 'cast' ? 'features' : role === 'director' ? 'directed by' : role === 'writer' ? 'written by' : 'shot by'} ${person.name}`)
      }
    }
  }
  const awards = Object.entries(CANON_AWARDS)
  const rows = await wd.sparql(`SELECT DISTINCT ?film ?award ?sl WHERE {
    VALUES ?award { ${awards.map(([q]) => `wd:${q}`).join(' ')} }
    { ?film wdt:P1411 ?award } UNION { ?film wdt:P166 ?award }
    ?film wikibase:sitelinks ?sl ; wdt:P577 ?date .
    FILTER(YEAR(?date) >= 1960 && YEAR(?date) <= ${thisYear} && ?sl >= 20)
  }`)
  for (const r of rows) {
    const q = r.award.value.split('/').pop()! as keyof typeof CANON_AWARDS
    add(r.film.value.split('/').pop()!, `recognised: ${CANON_AWARDS[q]}`)
  }
  // Keep the most connected candidates, then the notable ones.
  const ranked = [...via].sort((a, b) => b[1].length - a[1].length)
  return { via: new Map(ranked.slice(0, maxCandidates)) }
}

/** Turns pool QIDs into FilmRecords (fetching/caching entity data). */
export async function poolRecords(wd: Wikidata, pool: DiscoveryPool): Promise<{ record: FilmRecord; meta: FilmMetadata }[]> {
  const ents = await wd.entities([...pool.via.keys()])
  const out: { record: FilmRecord; meta: FilmMetadata }[] = []
  for (const [qid, e] of ents) {
    if (!isFilmLike(e)) continue
    const ys = yearsOf(e)
    const year = ys.length ? Math.min(...ys) : null
    const film: Film = {
      id: `wd:${qid}`, title: e.label, year, slug: '', letterboxdUri: null, watched: false, watchedAddedDate: null,
      rating: null, ratingDate: null, liked: false, likedDate: null, inWatchlist: false, watchlistAddedDate: null,
      isProfileFavorite: false, viewingIds: [], reviewIds: [], listMemberships: [], provenance: [],
    }
    const meta = toMetadata(film, e, wd, { method: 'title-year-search', confidence: 'high', notes: ['discovered via Wikidata (exact item)'] })
    const [record] = buildRecords(
      { films: [film], viewings: [] } as unknown as Parameters<typeof buildRecords>[0],
      { films: { [film.id]: meta } } as unknown as MetadataFile,
    )
    out.push({ record, meta })
  }
  return out
}

export interface ScoreContext {
  model: TrainedModel
  rated: FilmRecord[]
  exposure: { genre: Map<string, number>; decade: Map<number, number>; region: Map<string, number>; nonEnglish: number }
  genreRows: AffinityRow[]
}

export function exposureOf(watched: FilmRecord[]): ScoreContext['exposure'] {
  const genre = new Map<string, number>(), decade = new Map<number, number>(), region = new Map<string, number>()
  const withMeta = watched.filter((r) => r.meta)
  for (const r of withMeta) {
    r.genres.forEach((g) => genre.set(g, (genre.get(g) ?? 0) + 1 / withMeta.length))
    if (r.decade) decade.set(r.decade, (decade.get(r.decade) ?? 0) + 1 / withMeta.length)
    if (r.region) region.set(r.region, (region.get(r.region) ?? 0) + 1 / withMeta.length)
  }
  const nonEnglish = withMeta.filter((r) => r.englishLanguage === false).length / Math.max(withMeta.length, 1)
  return { genre, decade, region, nonEnglish }
}

/** 0 = squarely inside your usual territory, 1 = somewhere you rarely go. */
export function novelty(r: FilmRecord, ex: ScoreContext['exposure']): number {
  const maxG = Math.max(...ex.genre.values(), 0.01)
  const maxD = Math.max(...ex.decade.values(), 0.01)
  const maxR = Math.max(...ex.region.values(), 0.01)
  const parts: number[] = []
  if (r.genres.length) parts.push(1 - Math.max(...r.genres.map((g) => (ex.genre.get(g) ?? 0) / maxG)) * 0.5 - (r.genres.reduce((a, g) => a + (ex.genre.get(g) ?? 0) / maxG, 0) / r.genres.length) * 0.5)
  if (r.decade) parts.push(1 - (ex.decade.get(r.decade) ?? 0) / maxD)
  if (r.region) parts.push(1 - (ex.region.get(r.region) ?? 0) / maxR)
  if (r.englishLanguage === false) parts.push(1 - ex.nonEnglish)
  return parts.length ? round(parts.reduce((a, b) => a + b, 0) / parts.length, 3) : 0.5
}

/** Rated films most similar to the candidate, with human-readable shared attributes. */
export function becauseOf(c: FilmRecord, rated: FilmRecord[]): { filmId: string; reasons: string[]; score: number }[] {
  return rated
    .filter((r) => r.rating !== null && r.rating >= 4)
    .map((r) => {
      const reasons: string[] = []
      let score = 0
      const shared = (a: string[], b: string[]) => a.filter((x) => b.includes(x))
      for (const d of shared(c.directors, r.directors)) { reasons.push(`same director (${d})`); score += 4 }
      for (const w of shared(c.writers, r.writers)) { reasons.push(`same writer (${w})`); score += 2.5 }
      for (const p of shared(c.cast, r.cast).slice(0, 2)) { reasons.push(`shares ${p}`); score += 1.2 }
      for (const p of shared([...c.cinematographers, ...c.composers], [...r.cinematographers, ...r.composers]).slice(0, 1)) { reasons.push(`same crew (${p})`); score += 1.2 }
      if (c.franchise && c.franchise === r.franchise) { reasons.push(`same series (${c.franchise})`); score += 2 }
      const g = shared(c.genres, r.genres)
      const jac = g.length / new Set([...c.genres, ...r.genres]).size || 0
      score += jac * 2.2
      const sub = shared(c.subgenres, r.subgenres)
      score += sub.length * 0.8
      if (c.decade && c.decade === r.decade) score += 0.4
      if (jac >= 0.5 && g.length >= 2) reasons.push(`${g.slice(0, 3).join(' / ')}`)
      else if (sub.length) reasons.push(sub[0])
      score += (r.rating! - 4) * 0.8
      return { filmId: r.film.id, reasons, score }
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export function scoreCandidate(
  c: FilmRecord,
  ctx: ScoreContext,
  source: 'watchlist' | 'discovery',
  via: string[],
  filmTitle: (id: string) => string,
  ratingOf: (id: string) => number | null,
): Recommendation {
  const p = predict(ctx.model, c)
  const because = becauseOf(c, ctx.rated)
  const reasons: string[] = []
  // People track records, strongest first.
  const seenPeople = new Set<string>()
  const strong = [...p.signals]
    .sort((a, b) => b.delta - a.delta)
    .filter((s) => (s.role === 'cast' ? s.delta >= 0.3 && s.films.length >= 2 : s.delta >= 0.15))
    .filter((s) => !seenPeople.has(s.person) && seenPeople.add(s.person))
  for (const s of strong.slice(0, 2)) {
    const titles = [...s.films].sort((a, b) => (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0)).slice(0, 2).map(filmTitle).join(', ')
    reasons.push(`You rate ${s.person}'s work +${s.delta.toFixed(1)}★ above your average (${ROLE_LABEL[s.role]}; ${titles}${s.films.length > 2 ? '…' : ''})`)
  }
  // Generic attribute reasons only fill in when there's little specific (people) evidence.
  const genericSlots = strong.length >= 2 ? 1 : 2
  for (const con of p.contributions.filter((x) => x.present && x.value > 0.04 && !x.name.startsWith('people:')).sort((a, b) => b.value - a.value).slice(0, genericSlots)) {
    reasons.push(`Selected supporting factor — ${con.label}: +${con.value.toFixed(2)}★ in your taste model`)
  }
  for (const b of because.slice(0, 2)) {
    reasons.push(`Like ${filmTitle(b.filmId)} (${ratingOf(b.filmId)}★)${b.reasons.length ? ' — ' + b.reasons.slice(0, 2).join(', ') : ''}`)
  }
  const negatives = p.contributions.filter((x) => x.present && x.value < -0.08).sort((a, b) => a.value - b.value).slice(0, 1)
  for (const n of negatives) reasons.push(`Caveat — ${n.label.toLowerCase()} tends to pull your ratings down (${n.value.toFixed(2)}★)`)

  const uncertainty: string[] = []
  const conf = c.meta?.match.confidence ?? null
  if (!c.meta) uncertainty.push('no metadata match — the estimate uses the release year where possible, and missing details can still shift the score')
  else if (conf !== 'high') uncertainty.push(`metadata match is ${conf} confidence`)
  if (c.meta && !c.genres.length) uncertainty.push('no genre data')
  if (c.meta && !c.directors.length) uncertainty.push('no director data')
  if (c.film.year && c.film.year >= new Date().getUTCFullYear()) uncertainty.push('very recent — metadata may be incomplete')

  return {
    key: c.film.id,
    title: c.film.title,
    year: c.film.year,
    source,
    filmId: source === 'watchlist' ? c.film.id : null,
    wikidataId: c.meta?.match.wikidataId ?? null,
    predicted: p.value,
    novelty: novelty(c, ctx.exposure),
    genres: c.genres,
    directors: c.directors,
    cast: c.cast.slice(0, 6),
    countries: c.countries,
    languages: c.languages,
    runtime: c.runtime,
    decade: c.decade,
    sitelinks: c.meta?.sitelinks ?? 0,
    moods: MOODS.filter((m) => m.test(c)).map((m) => m.id),
    reasons,
    becauseFilmIds: because.map((b) => b.filmId),
    via,
    matchConfidence: conf,
    uncertain: uncertainty.length > 0,
    uncertainty,
    poster: c.meta?.posterUrl ?? null,
  }
}

export function watchedElsewhere(rec: FilmRecord, watchedQids: Set<string>): boolean {
  const q = rec.meta?.match.wikidataId
  return !!q && /^Q\d+$/.test(q) && watchedQids.has(q)
}

/** Removes discovery candidates that are already in the user's library (by QID or title+year). */
export function isKnown(rec: FilmRecord, known: { qids: Set<string>; titleYears: Set<string> }): boolean {
  const q = rec.meta?.match.wikidataId
  if (q && known.qids.has(q)) return true
  const y = rec.film.year
  return [y, y ? y - 1 : null, y ? y + 1 : null].some((yy) => known.titleYears.has(`${titleKey(rec.film.title)}:${yy}`))
}
