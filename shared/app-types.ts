/**
 * The analysis bundle the dashboard renders (public/data/cinema-dna.json).
 * Every number in the UI is either stored here or derived from `films` / `viewings` below,
 * which are themselves projections of data/normalized/{dataset,metadata}.json.
 */
import type { Audit, DateQuality, ISODate, MatchConfidence } from './types.ts'

export type Confidence = 'high' | 'medium' | 'low'
export type EvidenceKind = 'ratings' | 'metadata' | 'review-text' | 'behaviour' | 'interpretation'

export interface AppFilm {
  id: string
  title: string
  year: number | null
  rating: number | null
  /** rating expressed relative to the user's own mean, in standard deviations */
  z: number | null
  liked: boolean
  favorite: boolean
  watched: boolean
  inWatchlist: boolean
  watchlistAddedDate: ISODate | null
  watchedAddedDate: ISODate | null
  firstWatched: ISODate | null
  lastWatched: ISODate | null
  viewingCount: number
  rewatchCount: number
  reviews: { date: ISODate; watched: ISODate | null; rating: number | null; text: string; rewatch: boolean }[]
  ratingHistory: { date: ISODate; rating: number; source: 'diary' | 'current' }[]
  lists: { name: string; position: number }[]
  // metadata (empty when unmatched)
  matched: boolean
  matchConfidence: MatchConfidence | null
  wikidataId: string | null
  genres: string[]
  subgenres: string[]
  directors: string[]
  writers: string[]
  cast: string[]
  cinematographers: string[]
  composers: string[]
  countries: string[]
  languages: string[]
  runtime: number | null
  decade: number | null
  sitelinks: number
  prestige: string[]
  franchise: string | null
  animated: boolean
  documentary: boolean
  poster: string | null
  /** taste-model prediction for this film (cross-validated for rated films) */
  predicted: number | null
  constellation: { x: number; y: number; cluster: number } | null
}

export interface AppViewing {
  id: string
  filmId: string
  date: ISODate | null
  logged: ISODate
  rating: number | null
  rewatch: boolean
  reviewed: boolean
  quality: DateQuality
  tags: string[]
}

export interface Stat {
  label: string
  value: string
  hint?: string
}

export interface Insight {
  id: string
  category:
    | 'hidden-favourite'
    | 'contradiction'
    | 'formula'
    | 'disappointment'
    | 'evolution'
    | 'loyalty'
    | 'rewatch'
    | 'underrated-corner'
    | 'intersection'
    | 'watchlist'
    | 'generosity'
    | 'defining'
    | 'language'
    | 'exception'
  title: string
  finding: string
  /** why the pattern matters, in plain English */
  explanation: string
  stats: Stat[]
  filmIds: string[]
  n: number
  confidence: Confidence
  evidence: EvidenceKind
  /** set when the insight is an interpretation built on top of the data, not the data itself */
  speculative?: boolean
}

export interface AffinityRow {
  kind: string
  key: string
  label: string
  n: number
  mean: number
  /** empirical-Bayes mean pulled toward the user's overall mean */
  shrunk: number
  /** shrunk − overall mean, in stars */
  delta: number
  ci: [number, number]
  sd: number
  /** share of the user's rated films in this group */
  share: number
  /** share of films in this group rated ≥ 4.5 */
  topShare: number
  confidence: Confidence
  filmIds: string[]
}

export interface DnaDimension {
  id: string
  name: string
  /** short label for radar axes */
  axis: string
  score: number // 0–100
  headline: string
  definition: string
  value: string
  n: number
  confidence: Confidence
  evidence: EvidenceKind
  filmIds: string[]
  /** extra numbers shown in the expanded view */
  stats: Stat[]
  /** rating lift (stars vs. baseline) for films carrying this trait, if defined */
  affinity: number | null
}

export interface GenrePair {
  a: string
  b: string
  n: number
  mean: number
  shrunk: number
  /** shrunk(A∩B) − max(shrunk(A), shrunk(B)) */
  synergy: number
  filmIds: string[]
}

export interface Cluster {
  id: number
  label: string
  traits: string[]
  n: number
  meanRating: number | null
  filmIds: string[]
}

export interface Recommendation {
  key: string
  title: string
  year: number | null
  source: 'watchlist' | 'discovery'
  filmId: string | null
  wikidataId: string | null
  predicted: number
  /** 0–1, how far the film sits from what you usually watch */
  novelty: number
  genres: string[]
  directors: string[]
  cast: string[]
  countries: string[]
  languages: string[]
  runtime: number | null
  decade: number | null
  sitelinks: number
  moods: string[]
  reasons: string[]
  becauseFilmIds: string[]
  /** how the candidate entered the pool (e.g. "director of Past Lives") */
  via: string[]
  matchConfidence: MatchConfidence | null
  uncertain: boolean
  uncertainty: string[]
  poster: string | null
}

export interface ModelReport {
  /** false when there are too few (or no varied) ratings to fit anything honestly */
  available: boolean
  n: number
  features: number
  lambda: number
  cvRmse: number
  baselineRmse: number
  cvMae: number
  correlation: number
  topPositive: { feature: string; weight: number }[]
  topNegative: { feature: string; weight: number }[]
}

export interface LanguageCategory {
  id: string
  label: string
  terms: string[]
  reviews: number
  share: number
  meanWhenMentioned: number | null
  meanOtherwise: number | null
  lift: number | null
  examples: { filmId: string; snippet: string }[]
}

export interface ReportSection {
  heading: string
  kicker?: string
  paragraphs: string[]
  filmIds?: string[]
}

/** Fewer rated films than this and the dashboard/report show a "rate a few more films" state. */
export const MIN_RATED_FILMS = 5

export interface AppData {
  generatedAt: string
  profile: { username: string; name: string; joined: ISODate | null; location: string; bio: string; favoriteFilmIds: string[] }
  source: { archive: string; exportedAt: string | null; metadataSources: string[] }
  totals: {
    watchedFilms: number
    ratedFilms: number
    diaryViewings: number
    rewatchViewings: number
    reviewedFilms: number
    reviews: number
    likedFilms: number
    watchlist: number
    hoursWatched: number | null
    hoursCoverage: number
    firstLog: ISODate | null
    lastLog: ISODate | null
    meanRating: number
    sdRating: number
    medianRating: number
  }
  identity: { title: string; subtitle: string; intro: string[]; standouts: Stat[] }
  films: AppFilm[]
  viewings: AppViewing[]
  dna: DnaDimension[]
  affinities: Record<string, AffinityRow[]>
  genrePairs: GenrePair[]
  insights: Insight[]
  timeline: {
    months: { month: string; viewings: number; rewatches: number; meanRating: number | null; newReleaseShare: number | null }[]
    years: { year: number; viewings: number; meanRating: number | null; meanReleaseYear: number | null; topFilmIds: string[]; genreShares: Record<string, number> }[]
    lagDays: { filmId: string; lag: number }[]
  }
  constellation: { method: string[]; weights: { feature: string; weight: number }[]; clusters: Cluster[] }
  fiveStar: { filmIds: string[]; threshold: number; traits: Stat[]; links: { a: string; b: string; reasons: string[] }[] }
  critical: {
    distribution: { rating: number; count: number }[]
    revisions: { filmId: string; from: number; to: number; date: ISODate | null }[]
    language: LanguageCategory[]
    distinctiveWords: { high: { word: string; score: number; count: number }[]; low: { word: string; score: number; count: number }[] }
    lengthVsRating: { rating: number; meanWords: number; n: number }[]
    textRatingCorrelation: number | null
    exceptions: { above: string[]; below: string[] }
  }
  recommendations: Recommendation[]
  model: ModelReport
  report: { title: string; subtitle: string; sections: ReportSection[] }
  quality: {
    audit: Audit
    /** Letterboxd social activity in the export (not used in the taste analysis) */
    social: { likedReviews: number; likedLists: number; commentsWritten: number }
    metadata: {
      matched: number
      total: number
      byConfidence: Record<string, number>
      watchedMatched: number
      watchedTotal: number
      fieldCoverage: { field: string; watched: number; share: number }[]
      unmatched: { title: string; year: number | null; reason: string }[]
    }
    notes: string[]
  }
}
