import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AffinityRow, AppData, AppFilm, AppViewing, Recommendation } from '../../shared/app-types.ts'
import type { Dataset, MetadataFile } from '../../shared/types.ts'
import { newWikidata } from '../enrich/index.ts'
import { PATHS, readJson, writeJson } from '../paths.ts'
import { titleKey } from '../util/slug.ts'
import { affinity, baseline, genrePairs } from './affinity.ts'
import { WEIGHTS, buildConstellation } from './constellation.ts'
import { buildDna } from './dna.ts'
import { NOTABILITY_LABEL, buildRecords, type FilmRecord } from './features.ts'
import { buildInsights } from './insights.ts'
import { analyzeLanguage, snippet } from './language.ts'
import { trainModel } from './model.ts'
import { buildNarrative } from './narrative.ts'
import { discoverPool, exposureOf, isKnown, poolRecords, scoreCandidate, type ScoreContext } from './recommend.ts'
import { renderReportHtml, renderReportMarkdown, renderTasteAnalysisMarkdown } from './report.ts'
import { mean, median, round, sd } from './stats.ts'
import { buildTimeline } from './timeline.ts'

export interface AnalyzeOptions {
  offline?: boolean
  discover?: boolean
  log?: (msg: string) => void
}

export async function analyzeAll(opts: AnalyzeOptions = {}): Promise<AppData> {
  const log = opts.log ?? console.log
  const dataset = readJson<Dataset>(PATHS.dataset)
  const metadata = existsSync(PATHS.metadata) ? readJson<MetadataFile>(PATHS.metadata) : null
  log(`▸ analyze ${dataset.films.length} films${metadata ? '' : ' (no metadata — run `npm run enrich` for genres, people, etc.)'}`)
  const data = await analyze(dataset, metadata, opts)
  writeJson(PATHS.appData, data, false)
  mkdirSync(PATHS.reports, { recursive: true })
  const html = renderReportHtml(data)
  writeFileSync(join(PATHS.reports, 'cinema-dna-report.html'), html)
  writeFileSync(join(PATHS.reports, 'cinema-dna-report.md'), renderReportMarkdown(data))
  writeFileSync(join(PATHS.reports, 'taste-analysis.md'), renderTasteAnalysisMarkdown(data))
  writeFileSync(join(PATHS.appData, '..', 'cinema-dna-report.html'), html)
  log(`  wrote public/data/cinema-dna.json and reports/ (${data.insights.length} insights, ${data.recommendations.length} recommendations)`)
  return data
}

export async function analyze(dataset: Dataset, metadata: MetadataFile | null, opts: AnalyzeOptions = {}): Promise<AppData> {
  const log = opts.log ?? (() => {})
  const records = buildRecords(dataset, metadata)
  const watched = records.filter((r) => r.film.watched)
  const rated = watched.filter((r) => r.rating !== null)
  const base = baseline(rated)
  const byId = new Map(records.map((r) => [r.film.id, r]))

  // ── Affinities ──────────────────────────────────────────────────────────
  const A = (kind: string, keys: (r: FilmRecord) => (string | null | undefined)[], minN = 1) =>
    affinity(kind, rated, (r) => keys(r).filter((k): k is string => !!k), base, minN)
  const affinities: Record<string, AffinityRow[]> = {
    genre: A('genre', (r) => r.genres),
    subgenre: A('subgenre', (r) => r.subgenres, 2),
    decade: A('decade', (r) => [r.decade ? `${r.decade}s` : null]),
    runtime: A('runtime', (r) => [r.runtimeBucket]),
    region: A('region', (r) => [r.region]),
    country: A('country', (r) => r.countries),
    language: A('language', (r) => r.languages.slice(0, 1)),
    notability: A('notability', (r) => [r.notability ? NOTABILITY_LABEL[r.notability] : null]),
    prestige: A('prestige', (r) => (r.meta ? (r.prestige.length ? r.prestige : ['No major-award recognition']) : [])),
    franchise: A('franchise', (r) => [r.franchise], 2),
    director: A('director', (r) => r.directors),
    writer: A('writer', (r) => r.writers, 2),
    cast: A('cast', (r) => r.cast, 2),
    cinematographer: A('cinematographer', (r) => r.cinematographers, 2),
    composer: A('composer', (r) => r.composers, 2),
  }
  const pairs = genrePairs(rated, affinities.genre, base)

  // ── Model, constellation, language, timeline ───────────────────────────
  const model = trainModel(rated, base)
  log(`  taste model: CV RMSE ${model.report.cvRmse} vs baseline ${model.report.baselineRmse} (λ=${model.lambda}, ${model.report.features} features)`)
  const constellation = buildConstellation(watched)
  const reviewsByFilm = new Map<string, typeof dataset.reviews>()
  for (const rv of dataset.reviews) reviewsByFilm.set(rv.filmId, [...(reviewsByFilm.get(rv.filmId) ?? []), rv])
  const language = analyzeLanguage(dataset.reviews, (r, re) => snippet(r.text, re))
  const timeline = buildTimeline(records, dataset.viewings)

  // ── Recommendations ─────────────────────────────────────────────────────
  const recommendations = await buildRecommendations(records, rated, model, affinities, opts, log)

  // ── App films ───────────────────────────────────────────────────────────
  const listName = new Map(dataset.lists.map((l) => [l.id, l.name.trim()]))
  const viewingById = new Map(dataset.viewings.map((v) => [v.id, v]))
  const films: AppFilm[] = records
    .filter((r) => r.film.watched || r.film.inWatchlist || r.film.listMemberships.length)
    .map((r): AppFilm => {
      const f = r.film
      const vs = r.viewings
      const history = [
        ...vs.filter((v) => v.rating !== null).map((v) => ({ date: v.watchedDate ?? v.loggedDate, rating: v.rating!, source: 'diary' as const })),
        ...(f.rating !== null && f.ratingDate ? [{ date: f.ratingDate, rating: f.rating, source: 'current' as const }] : []),
      ]
      return {
        id: f.id,
        title: f.title,
        year: f.year,
        rating: f.rating,
        z: f.rating !== null && base.sd ? round((f.rating - base.mean) / base.sd) : null,
        liked: f.liked,
        favorite: f.isProfileFavorite,
        watched: f.watched,
        inWatchlist: f.inWatchlist,
        watchlistAddedDate: f.watchlistAddedDate,
        watchedAddedDate: f.watchedAddedDate,
        firstWatched: vs[0]?.watchedDate ?? null,
        lastWatched: vs.at(-1)?.watchedDate ?? null,
        viewingCount: vs.length,
        rewatchCount: vs.filter((v) => v.rewatch).length,
        reviews: (reviewsByFilm.get(f.id) ?? []).map((rv) => ({
          date: rv.loggedDate,
          watched: rv.watchedDate,
          rating: rv.rating,
          text: rv.text,
          rewatch: rv.rewatch || (rv.viewingId ? viewingById.get(rv.viewingId)?.rewatch ?? false : false),
        })),
        ratingHistory: history,
        lists: f.listMemberships.map((m) => ({ name: listName.get(m.listId) ?? m.listId, position: m.position })),
        matched: !!r.meta,
        matchConfidence: r.meta?.match.confidence ?? null,
        wikidataId: r.meta?.match.wikidataId ?? null,
        genres: r.genres,
        subgenres: r.subgenres,
        directors: r.directors,
        writers: r.writers,
        cast: r.cast.slice(0, 12),
        cinematographers: r.cinematographers,
        composers: r.composers,
        countries: r.countries,
        languages: r.languages,
        runtime: r.runtime,
        decade: r.decade,
        sitelinks: r.meta?.sitelinks ?? 0,
        prestige: r.prestige,
        franchise: r.franchise,
        animated: r.animated,
        documentary: r.documentary,
        poster: r.meta?.posterUrl ?? null,
        predicted: r.rating !== null ? model.cvPredictions.get(f.id) ?? null : null,
        constellation: constellation.positions.get(f.id) ?? null,
      }
    })

  const viewings: AppViewing[] = dataset.viewings.map((v) => ({
    id: v.id,
    filmId: v.filmId,
    date: v.watchedDate,
    logged: v.loggedDate,
    rating: v.rating,
    rewatch: v.rewatch,
    reviewed: !!v.reviewId,
    quality: v.dateQuality,
    tags: v.tags,
  }))

  // ── Totals ──────────────────────────────────────────────────────────────
  const ratings = rated.map((r) => r.rating!)
  const runtimes = watched.map((r) => r.runtime)
  const withRuntime = watched.filter((r) => r.runtime)
  // Hours: each diary viewing counts once; watched films without diary entries count once.
  const hours =
    (watched.reduce((a, r) => a + (r.runtime ?? 0) * Math.max(r.viewings.length, 1), 0) / 60)
  const logDates = dataset.viewings.map((v) => v.loggedDate).sort()
  const ratingDistribution = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => ({
    rating,
    count: ratings.filter((x) => x === rating).length,
  }))

  const partial: Omit<AppData, 'identity' | 'dna' | 'insights' | 'report' | 'fiveStar'> = {
    generatedAt: new Date().toISOString(),
    profile: {
      username: dataset.profile.username,
      name: dataset.profile.givenName || dataset.profile.username,
      joined: dataset.profile.joinedDate,
      location: dataset.profile.location,
      bio: dataset.profile.bio,
      favoriteFilmIds: dataset.profile.favoriteFilmIds,
    },
    source: { archive: dataset.source.archive, exportedAt: dataset.source.exportedAt, metadataSources: metadata?.sources ?? [] },
    totals: {
      watchedFilms: watched.length,
      ratedFilms: rated.length,
      diaryViewings: dataset.viewings.length,
      rewatchViewings: dataset.viewings.filter((v) => v.rewatch).length,
      reviewedFilms: new Set(dataset.reviews.map((r) => r.filmId)).size,
      reviews: dataset.reviews.length,
      likedFilms: dataset.films.filter((f) => f.liked).length,
      watchlist: dataset.films.filter((f) => f.inWatchlist && !f.watched).length,
      hoursWatched: withRuntime.length ? Math.round(hours) : null,
      hoursCoverage: round(withRuntime.length / Math.max(watched.length, 1), 3),
      firstLog: logDates[0] ?? null,
      lastLog: logDates.at(-1) ?? null,
      // Zero-rating libraries are gated in the UI and reports (MIN_RATED_FILMS); keep the bundle finite.
      meanRating: ratings.length ? round(base.mean) : 0,
      sdRating: ratings.length ? round(base.sd) : 0,
      medianRating: ratings.length ? median(ratings) : 0,
    },
    films,
    viewings,
    affinities,
    genrePairs: pairs,
    timeline,
    constellation: {
      method: [
        'Each watched film with metadata becomes a weighted attribute vector (weights below).',
        'Similarity is the cosine similarity of those vectors — films are close when they share verified attributes such as director, genre, decade or region.',
        'UMAP (14 neighbours, seeded for reproducibility) projects the vectors onto two dimensions. Axes have no meaning; only neighbourhoods do.',
        'Clusters come from k-means on the original vectors (k chosen by silhouette score), labelled by their most over-represented traits.',
      ],
      weights: WEIGHTS.map(({ feature, weight }) => ({ feature, weight })),
      clusters: constellation.clusters,
    },
    critical: {
      distribution: ratingDistribution,
      revisions: dataset.audit.conflicts
        .filter((c) => c.kind === 'rating-mismatch' && c.filmId)
        .map((c) => {
          const m = c.detail.match(/latest diary rating ([\d.]+)★, current rating ([\d.]+)★ \(revised (.+)\)$/)
          return m ? { filmId: c.filmId!, from: Number(m[1]), to: Number(m[2]), date: m[3] === 'null' ? null : m[3] } : null
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
      language: language.categories,
      distinctiveWords: language.distinctive,
      lengthVsRating: language.lengthVsRating,
      textRatingCorrelation: language.textRatingCorrelation,
      exceptions: {
        above: (model.report.available ? rated : [])
          .map((r) => ({ id: r.film.id, gap: r.rating! - model.cvPredictions.get(r.film.id)! }))
          .sort((a, b) => b.gap - a.gap)
          .slice(0, 8)
          .map((x) => x.id),
        below: (model.report.available ? rated : [])
          .map((r) => ({ id: r.film.id, gap: r.rating! - model.cvPredictions.get(r.film.id)! }))
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 8)
          .map((x) => x.id),
      },
    },
    recommendations,
    model: model.report,
    quality: buildQuality(dataset, metadata, watched),
  }

  const ctx = { records, watched, rated, base, byId, affinities, pairs, model, language, timeline, dataset, runtimes, constellation }
  const dna = buildDna(ctx)
  const { insights, fiveStar } = buildInsights(ctx)
  const narrative = buildNarrative({ ...ctx, dna, insights, partial })
  return { ...partial, dna, insights, fiveStar, identity: narrative.identity, report: narrative.report }
}

export type AnalysisContext = {
  records: FilmRecord[]
  watched: FilmRecord[]
  rated: FilmRecord[]
  base: ReturnType<typeof baseline>
  byId: Map<string, FilmRecord>
  affinities: Record<string, AffinityRow[]>
  pairs: ReturnType<typeof genrePairs>
  model: ReturnType<typeof trainModel>
  language: ReturnType<typeof analyzeLanguage>
  timeline: AppData['timeline']
  dataset: Dataset
  runtimes: (number | null)[]
  constellation: ReturnType<typeof buildConstellation>
}

async function buildRecommendations(
  records: FilmRecord[],
  rated: FilmRecord[],
  model: ReturnType<typeof trainModel>,
  affinities: Record<string, AffinityRow[]>,
  opts: AnalyzeOptions,
  log: (m: string) => void,
): Promise<Recommendation[]> {
  const watched = records.filter((r) => r.film.watched)
  const ctx: ScoreContext = { model, rated, exposure: exposureOf(watched), genreRows: affinities.genre }
  const title = new Map(records.map((r) => [r.film.id, r.film.title]))
  const rating = new Map(records.map((r) => [r.film.id, r.rating]))
  const thisYear = new Date().getUTCFullYear()
  const released = (r: FilmRecord) => !r.film.year || r.film.year <= thisYear

  const out: Recommendation[] = records
    .filter((r) => r.film.inWatchlist && !r.film.watched && released(r))
    .map((r) => scoreCandidate(r, ctx, 'watchlist', ['on your watchlist'], (id) => title.get(id) ?? id, (id) => rating.get(id) ?? null))

  if (opts.discover === false) return out.sort((a, b) => b.predicted - a.predicted)

  // Discovery: people with a positive, non-trivial track record + award canon.
  const qidOf = new Map<string, string>()
  for (const r of rated)
    for (const role of ['directors', 'writers', 'cinematographers', 'cast'] as const)
      for (const p of r.meta?.[role] ?? []) if (/^Q\d+$/.test(p.id)) qidOf.set(p.name, p.id)
  const people: Parameters<typeof discoverPool>[1] = []
  const pick = (rows: AffinityRow[], role: 'director' | 'writer' | 'cinematographer' | 'cast', min: number, minN = 1) =>
    rows
      .filter((x) => x.delta >= min && x.n >= minN && qidOf.has(x.key))
      .forEach((x) => people.push({ qid: qidOf.get(x.key)!, name: x.key, role, delta: x.delta }))
  pick(affinities.director, 'director', 0.1)
  pick(affinities.writer, 'writer', 0.15, 2)
  pick(affinities.cinematographer, 'cinematographer', 0.15, 2)
  pick(affinities.cast, 'cast', 0.2, 2)

  try {
    const { wd } = newWikidata(!!opts.offline)
    const pool = await discoverPool(wd, people, 450)
    const candidates = await poolRecords(wd, pool)
    const known = {
      qids: new Set(records.map((r) => r.meta?.match.wikidataId).filter((q): q is string => !!q)),
      titleYears: new Set(records.map((r) => `${titleKey(r.film.title)}:${r.film.year}`)),
    }
    let added = 0
    for (const c of candidates) {
      if (isKnown(c.record, known) || !released(c.record) || c.record.film.year === null) continue
      if (c.meta.isShortOrSpecial) continue
      out.push(scoreCandidate(c.record, ctx, 'discovery', pool.via.get(c.meta.match.wikidataId!) ?? [], (id) => title.get(id) ?? id, (id) => rating.get(id) ?? null))
      added++
    }
    log(`  discovery pool: ${pool.via.size} candidates from ${people.length} people + award canon → ${added} new films scored`)
  } catch (err) {
    log(`  discovery skipped: ${(err as Error).message}`)
  }
  return out.sort((a, b) => b.predicted - a.predicted)
}

function buildQuality(dataset: Dataset, metadata: MetadataFile | null, watched: FilmRecord[]): AppData['quality'] {
  const metas = Object.values(metadata?.films ?? {})
  const byConfidence: Record<string, number> = {}
  for (const m of metas) byConfidence[m.match.confidence] = (byConfidence[m.match.confidence] ?? 0) + 1
  const field = (name: string, test: (r: FilmRecord) => boolean) => {
    const n = watched.filter(test).length
    return { field: name, watched: n, share: round(n / Math.max(watched.length, 1), 3) }
  }
  return {
    audit: dataset.audit,
    social: dataset.social,
    metadata: {
      matched: metas.length,
      total: dataset.films.length,
      byConfidence,
      watchedMatched: watched.filter((r) => r.meta).length,
      watchedTotal: watched.length,
      fieldCoverage: [
        field('Genres', (r) => r.genres.length > 0),
        field('Director', (r) => r.directors.length > 0),
        field('Writer', (r) => r.writers.length > 0),
        field('Cast', (r) => r.cast.length > 0),
        field('Cinematographer', (r) => r.cinematographers.length > 0),
        field('Composer', (r) => r.composers.length > 0),
        field('Runtime', (r) => r.runtime !== null),
        field('Country', (r) => r.countries.length > 0),
        field('Language', (r) => r.languages.length > 0),
        field('Poster', (r) => !!r.meta?.posterUrl),
      ],
      unmatched: (metadata?.unmatched ?? []).map(({ title, year, reason }) => ({ title, year, reason })),
    },
    notes: [
      ...dataset.audit.notes,
      'Ratings use your current Letterboxd rating per film; diary ratings are kept as history.',
      'Timeline charts use only diary entries whose watch date is on/after your join date (backfilled dates are flagged).',
      `${dataset.detached.length} orphaned/deleted entries (e.g. TV events) are excluded from film statistics.`,
      ...(metadata ? [] : ['No metadata file found: genre, people and recommendation analysis is unavailable.']),
      ...(metadata?.sources.includes('tmdb') ? [] : ['Posters and keywords require TMDB (set TMDB_API_KEY and re-run `npm run enrich`).']),
    ],
  }
}

// Re-exported for tests.
export { mean, sd }
