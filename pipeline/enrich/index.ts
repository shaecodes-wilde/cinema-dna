import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Dataset, Film, FilmMetadata, MetadataFile, PersonRef } from '../../shared/types.ts'
import { PATHS, readJson, writeJson } from '../paths.ts'
import { canonicalGenres, isPlainGenre, subgenreLabel } from './genres.ts'
import { CachedHttp } from './http.ts'
import { pickBest, scoreCandidate, slugCandidates, type CandidateScore } from './match.ts'
import { HttpError, Tmdb, applyTmdb, tmdbCredentials } from './tmdb.ts'
import { FILM_CLASSES, FILM_PROPS as P, TV_CLASSES, Wikidata, yearsOf, type CompactEntity } from './wikidata.ts'

export interface EnrichOptions {
  offline?: boolean
  log?: (msg: string) => void
  paths?: Pick<typeof PATHS, 'cache' | 'overrides' | 'metadata' | 'metadataPrev'>
  fetchImpl?: typeof fetch
}

interface Overrides {
  /** filmId → Wikidata QID, or null to force "no match" */
  matches?: Record<string, string | null>
}

const ANIMATED = new Set(['Q202866', 'Q29168811', 'Q17517379', 'Q63952888', 'Q1107'])
const SHORT_OR_SPECIAL = new Set(['Q24862', 'Q1261214', 'Q21191270', 'Q17517379'])

export function newWikidata(offline: boolean, cacheRoot = PATHS.cache, fetchImpl?: typeof fetch): { wd: Wikidata; http: CachedHttp } {
  const http = new CachedHttp({ cacheDir: join(cacheRoot, 'wikidata-http'), minIntervalMs: 2500, offline, fetchImpl })
  return { wd: new Wikidata(http, cacheRoot), http }
}

export function readPreviousMetadata(path: string, log: (msg: string) => void = console.warn): MetadataFile | null {
  try {
    const file = readJson<MetadataFile | null>(path)
    if (file?.films && typeof file.films === 'object' && !Array.isArray(file.films)) return file
  } catch {
    // Missing or interrupted previous writes start cold.
  }
  log('  ignoring unreadable previous metadata.json; nothing to carry forward')
  return null
}

function permitsPrevious(id: string, prev: FilmMetadata, overrides: Overrides): boolean {
  const override = overrides.matches?.[id]
  return override === undefined || (override !== null && override === prev.match.wikidataId)
}

export function carryForward(
  prev: MetadataFile | null,
  out: MetadataFile['films'],
  unmatched: MetadataFile['unmatched'],
  films: Film[],
  overrides: Overrides,
  offline: boolean,
): Pick<MetadataFile, 'films' | 'unmatched'> {
  const next = { ...out }
  if (offline && prev) {
    for (const film of films) {
      const old = prev.films[film.id]
      if (next[film.id] || !old || old.filmId !== film.id || !permitsPrevious(film.id, old, overrides)) continue
      next[film.id] = {
        ...old,
        match: { ...old.match, notes: [...new Set([...old.match.notes, 'carried from previous metadata (offline run)'])] },
      }
    }
  }
  return { films: next, unmatched: unmatched.filter((u) => !next[u.filmId]) }
}

export function unexplainedLosses(prev: MetadataFile | null, next: MetadataFile, films: Film[], overrides: Overrides): string[] {
  const currentIds = new Set(films.map((f) => f.id))
  return Object.entries(prev?.films ?? {})
    .filter(([id, old]) => currentIds.has(id) && !next.films[id] && permitsPrevious(id, old, overrides))
    .map(([id]) => id)
}

function losesTmdbMetadata(prev: FilmMetadata, next: FilmMetadata | undefined): boolean {
  if (prev.match.method === 'tmdb-search' && !next) return true
  const changed = (key: keyof FilmMetadata) => {
    const value = prev[key]
    return value != null && value !== '' && (!Array.isArray(value) || value.length > 0)
      && JSON.stringify(value) !== JSON.stringify(next?.[key])
  }
  if ((['posterUrl', 'overview', 'keywords'] as const).some(changed)) return true
  if ((['cast', 'directors', 'writers', 'cinematographers', 'composers'] as const)
    .some((key) => prev[key].some((p) => p.id.startsWith('tmdb:')) && changed(key))) return true
  // Runtime and genres have no field-level provenance; compare conservatively after a prior overlay.
  return prev.sources.includes('tmdb') && (
    (prev.match.tmdbId !== null && prev.match.tmdbId !== next?.match.tmdbId)
    || (['runtime', 'genres'] as const).some(changed)
  )
}

export async function enrich(dataset: Dataset, opts: EnrichOptions = {}): Promise<MetadataFile> {
  const log = opts.log ?? console.log
  const offline = !!opts.offline
  const paths = opts.paths ?? PATHS
  const previous = readPreviousMetadata(paths.metadata, log)
  const { wd, http } = newWikidata(offline, paths.cache, opts.fetchImpl)
  const overrides: Overrides = existsSync(paths.overrides) ? readJson(paths.overrides) : {}
  const films = dataset.films
  log(`▸ enrich  ${films.length} films via Wikidata${offline ? ' (offline: cache only)' : ''}`)

  // 1 ─ Letterboxd-ID lookup (P6127) for every slug candidate.
  const slugsByFilm = new Map(films.filter((f) => overrides.matches?.[f.id] === undefined).map((f) => [f.id, slugCandidates(f)]))
  const slugHits = await wd.findByLetterboxdSlugs([...new Set([...slugsByFilm.values()].flat())])
  const slugQids = [...slugHits.values()].flat()
  const slugEntities = await wd.entities(slugQids)

  const matches = new Map<string, CandidateScore & { method: 'letterboxd-id' | 'title-year-search' | 'manual-override' }>()
  for (const film of films) {
    const override = overrides.matches?.[film.id]
    if (override === null) continue
    if (override !== undefined) {
      const e = (await wd.entities([override])).get(override)
      if (e) matches.set(film.id, { entity: e, score: 99, confidence: 'high', notes: ['manual override'], method: 'manual-override' })
      continue
    }
    const scored = slugsByFilm
      .get(film.id)!
      .flatMap((s) => slugHits.get(s) ?? [])
      .map((qid) => slugEntities.get(qid))
      .filter((e): e is CompactEntity => !!e)
      .map((e) => scoreCandidate(film, e, true))
    const best = pickBest(scored)
    if (best) matches.set(film.id, { ...best, method: 'letterboxd-id' })
  }
  log(`  ${matches.size} matched by Letterboxd ID`)

  // 2 ─ Exact English title/alias match among film-like items, then fuzzy entity search.
  const scoreAll = async (film: Film, ids: string[], title: string) => {
    const ents = [...(await wd.entities(ids)).values()]
    return pickBest(ents.map((e) => scoreCandidate(film, { ...e, aliases: [...e.aliases, title] }, false)))
  }
  let pending = films.filter((f) => !matches.has(f.id) && overrides.matches?.[f.id] === undefined)
  const exact = await wd.findByExactTitle([...new Set(pending.map((f) => f.title))])
  await wd.entities([...exact.values()].flat())
  for (const film of pending) {
    const best = await scoreAll(film, exact.get(film.title) ?? [], film.title)
    if (best) matches.set(film.id, { ...best, method: 'title-year-search' })
  }
  log(`  ${matches.size} matched after exact-title lookup`)
  pending = pending.filter((f) => !matches.has(f.id))
  let done = 0
  for (const film of pending) {
    const ids = await wd.search(film.title)
    // Search hits are only accepted on title + year agreement (no alias injection here).
    const best = pickBest([...(await wd.entities(ids)).values()].map((e) => scoreCandidate(film, e, false)))
    if (best) matches.set(film.id, { ...best, method: 'title-year-search' })
    if (++done % 25 === 0) log(`  searched ${done}/${pending.length}`)
  }
  log(`  ${matches.size}/${films.length} matched after fuzzy search`)

  // 4 ─ Build metadata records.
  const records: Record<string, FilmMetadata> = {}
  const missing: MetadataFile['unmatched'] = []
  for (const film of films) {
    const m = matches.get(film.id)
    if (!m) {
      const override = overrides.matches?.[film.id]
      const reason = override === null ? 'override: no match'
        : override !== undefined ? `override: ${override} ${offline ? 'not available offline (uncached)' : 'not found'}`
          : 'no confident Wikidata match'
      missing.push({ filmId: film.id, title: film.title, year: film.year, reason })
      continue
    }
    records[film.id] = toMetadata(film, m.entity, wd, { method: m.method, confidence: m.confidence, notes: m.notes })
  }
  const { films: out, unmatched } = carryForward(previous, records, missing, films, overrides, offline)

  // 5 ─ Optional TMDB overlay.
  const sources = ['wikidata']
  const tmdbFailed = new Set<string>()
  const creds = tmdbCredentials()
  if (creds) {
    const tmdb = new Tmdb(creds, join(paths.cache, 'tmdb'), offline, opts.fetchImpl)
    sources.push('tmdb')
    let n = 0
    const eligible = films.filter((f) => overrides.matches?.[f.id] !== null
      && (overrides.matches?.[f.id] === undefined || out[f.id]))
    for (const [index, film] of eligible.entries()) {
      try {
        const meta = out[film.id]
        const id = meta?.match.tmdbId ?? (await tmdb.search(film.title, film.year))
        if (!id) continue
        const movie = await tmdb.movie(id)
        if (!movie) continue
        out[film.id] = meta
          ? applyTmdb(meta, movie)
          : applyTmdb(emptyMetadata(film, { method: 'tmdb-search', confidence: 'medium', notes: ['matched via TMDB search only'] }), movie)
        n++
      } catch (err) {
        tmdbFailed.add(film.id)
        log(`  tmdb: ${film.title}: ${(err as Error).message}`)
        if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
          for (const skipped of eligible.slice(index + 1)) tmdbFailed.add(skipped.id)
          log('  TMDB rejected the credentials (check TMDB_API_KEY / TMDB_READ_ACCESS_TOKEN); skipping TMDB.')
          break
        }
      }
    }
    log(`  TMDB overlay applied to ${n} films`)
  } else {
    log('  TMDB disabled (set TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN to add posters & keywords)')
  }

  const file: MetadataFile = {
    generatedAt: new Date().toISOString(),
    sources: [...new Set([...sources, ...Object.values(out).flatMap((m) => m.sources)])],
    films: out,
    unmatched: unmatched.filter((u) => !out[u.filmId]),
  }
  const losses = unexplainedLosses(previous, file, films, overrides)
  if (losses.length) {
    const message = `unexplained metadata losses: ${losses.join(', ')}`
    if (offline) throw new Error(message)
    log(`  ⚠ ${message}`)
  }
  if ([...tmdbFailed].some((id) => {
    const old = previous?.films[id]
    return old && permitsPrevious(id, old, overrides) && losesTmdbMetadata(old, out[id])
  })) {
    throw new Error('degraded refresh: a metadata source failed; previous metadata.json kept unchanged (replacement not published)')
  }
  if (existsSync(paths.metadata)) {
    mkdirSync(dirname(paths.metadataPrev), { recursive: true })
    copyFileSync(paths.metadata, paths.metadataPrev)
  }
  writeJson(paths.metadata, file)
  const conf = Object.values(out).reduce<Record<string, number>>((a, m) => ((a[m.match.confidence] = (a[m.match.confidence] ?? 0) + 1), a), {})
  log(`  wrote ${Object.keys(out).length} records (${JSON.stringify(conf)}) · ${file.unmatched.length} unmatched · ${http.networkRequests} requests, ${http.cacheHits} cache hits`)
  return file
}

export function emptyMetadata(film: Film, match: Pick<FilmMetadata['match'], 'method' | 'confidence' | 'notes'>): FilmMetadata {
  return {
    filmId: film.id,
    match: { wikidataId: null, tmdbId: null, imdbId: null, letterboxdSlug: null, ...match },
    label: film.title,
    description: null,
    releaseYear: film.year,
    runtime: null,
    genres: [],
    subgenres: [],
    directors: [],
    writers: [],
    cast: [],
    cinematographers: [],
    composers: [],
    editors: [],
    producers: [],
    companies: [],
    distributors: [],
    countries: [],
    languages: [],
    subjects: [],
    series: [],
    basedOn: [],
    awardsWon: [],
    nominations: [],
    sitelinks: 0,
    isAnimated: false,
    isDocumentary: false,
    isShortOrSpecial: false,
    isTv: false,
    posterUrl: null,
    overview: null,
    keywords: [],
    sources: [],
  }
}

export function toMetadata(
  film: Pick<Film, 'id' | 'title' | 'year'>,
  e: CompactEntity,
  wd: Pick<Wikidata, 'label'>,
  match: Pick<FilmMetadata['match'], 'method' | 'confidence' | 'notes'>,
): FilmMetadata {
  const c = e.claims
  const ids = (p: string) => (c[p] ?? []).filter((v) => /^Q\d+$/.test(v))
  const people = (p: string): PersonRef[] =>
    ids(p).map((id) => ({ id, name: wd.label(id) })).filter((x) => x.name !== x.id)
  const labels = (p: string) => ids(p).map((id) => wd.label(id)).filter((l) => !/^Q\d+$/.test(l))

  const genreLabels = labels(P.genre)
  const genres = new Set(genreLabels.flatMap(canonicalGenres))
  const types = c[P.instanceOf] ?? []
  const isAnimated = types.some((t) => ANIMATED.has(t)) || genreLabels.some((g) => /animat|anime/i.test(g))
  const isDocumentary = types.includes('Q93204') || genreLabels.some((g) => /documentary/i.test(g))
  if (isAnimated) genres.add('Animation')
  if (isDocumentary) genres.add('Documentary')
  const years = yearsOf(e)
  const runtime = Number(c[P.duration]?.[0])
  const tmdbId = Number(c[P.tmdb]?.[0])

  return {
    filmId: film.id,
    match: {
      wikidataId: e.id,
      tmdbId: Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : null,
      imdbId: c[P.imdb]?.[0] ?? null,
      letterboxdSlug: c[P.letterboxd]?.[0] ?? null,
      ...match,
    },
    label: e.label,
    description: e.description,
    releaseYear: years.length ? Math.min(...years) : film.year,
    runtime: Number.isFinite(runtime) && runtime > 0 ? runtime : null,
    genres: [...genres].sort(),
    subgenres: [...new Set(genreLabels.map(subgenreLabel))].filter((g) => !isPlainGenre(g)),
    directors: people(P.director),
    writers: people(P.screenwriter),
    cast: people(P.cast),
    cinematographers: people(P.cinematographer),
    composers: people(P.composer),
    editors: people(P.editor),
    producers: people(P.producer),
    companies: people(P.company),
    distributors: people(P.distributor),
    countries: labels(P.country),
    languages: labels(P.language),
    subjects: labels(P.subject),
    series: [...labels(P.series), ...labels(P.franchise)],
    basedOn: labels(P.basedOn),
    awardsWon: labels(P.award),
    nominations: labels(P.nominated),
    sitelinks: e.sitelinks,
    isAnimated,
    isDocumentary,
    isShortOrSpecial: types.some((t) => SHORT_OR_SPECIAL.has(t)),
    isTv:
      types.some((t) => TV_CLASSES.has(t)) ||
      (!types.some((t) => FILM_CLASSES.has(t)) && /television|tv series|miniseries|web series/i.test(e.description ?? '')),
    posterUrl: null,
    overview: null,
    keywords: [],
    sources: ['wikidata'],
  }
}
