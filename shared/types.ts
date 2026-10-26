/**
 * CINEMA DNA — shared, typed normalized model.
 * Produced by the pipeline (pipeline/) and consumed by the dashboard (src/).
 *
 * Semantics worth knowing:
 *  - A film being "watched" (watched.csv) is NOT a viewing event. Only diary rows are viewings.
 *  - `watchedAddedDate` is the date the film was marked watched on Letterboxd, never a watch date.
 *  - `Viewing.watchedDate` is the user-entered "Watched Date" of a diary entry.
 *  - Orphaned / deleted rows (content Letterboxd could not link to a film) are kept separately.
 */

export type ISODate = string // YYYY-MM-DD

export interface SourceRef {
  file: string
  /** 1-based data row (header excluded) */
  row: number
}

export interface Film {
  /** "lb:<boxd.it code>" when a film URI is known, otherwise "ty:<slug>:<year>" */
  id: string
  title: string
  year: number | null
  slug: string
  letterboxdUri: string | null
  watched: boolean
  /** date the film was marked as watched on Letterboxd — not a viewing date */
  watchedAddedDate: ISODate | null
  /** current star rating (0.5–5) from ratings.csv */
  rating: number | null
  ratingDate: ISODate | null
  liked: boolean
  likedDate: ISODate | null
  inWatchlist: boolean
  watchlistAddedDate: ISODate | null
  isProfileFavorite: boolean
  viewingIds: string[]
  reviewIds: string[]
  listMemberships: { listId: string; position: number }[]
  provenance: SourceRef[]
}

export type DateQuality =
  /** logged within 7 days of the watch date */
  | 'live'
  /** logged more than 7 days after the watch date */
  | 'delayed'
  /** watch date precedes the account's creation: retro-logged from memory */
  | 'backfilled'
  /** backfilled and set to Jan 1 — almost certainly a placeholder year */
  | 'approximate'
  | 'missing'

export interface Viewing {
  /** diary entry code (boxd.it) */
  id: string
  filmId: string
  watchedDate: ISODate | null
  loggedDate: ISODate
  /** the rating attached to this diary entry at the time it was logged */
  rating: number | null
  rewatch: boolean
  tags: string[]
  reviewId: string | null
  dateQuality: DateQuality
  provenance: SourceRef[]
}

export interface Review {
  id: string
  filmId: string
  viewingId: string | null
  text: string
  wordCount: number
  rating: number | null
  watchedDate: ISODate | null
  loggedDate: ISODate
  rewatch: boolean
  tags: string[]
  provenance: SourceRef[]
}

/** Content Letterboxd exported without a film link (e.g. TV events, deleted films). */
export interface DetachedEntry {
  status: 'orphaned' | 'deleted'
  kind: 'diary' | 'review' | 'comment'
  title: string | null
  year: number | null
  rating: number | null
  watchedDate: ISODate | null
  loggedDate: ISODate | null
  text: string | null
  provenance: SourceRef[]
}

export interface UserList {
  id: string
  name: string
  url: string | null
  createdDate: ISODate | null
  description: string
  tags: string[]
  /** heuristically detected: list name contains "ranked" */
  isRanking: boolean
  entries: { position: number; filmId: string; title: string; year: number | null }[]
  provenance: SourceRef[]
}

export interface Profile {
  username: string
  givenName: string
  joinedDate: ISODate | null
  location: string
  bio: string
  pronoun: string
  website: string
  favoriteFilmIds: string[]
}

export interface IdentityConflict {
  kind: 'same-uri-different-title' | 'same-title-year-different-uri' | 'unresolved-title-year' | 'rating-mismatch'
  detail: string
  refs: SourceRef[]
}

export interface FileAudit {
  file: string
  present: boolean
  rows: number
  linked: number
  unlinked: number
  missing: Record<string, number>
}

export interface Audit {
  files: FileAudit[]
  conflicts: IdentityConflict[]
  counts: {
    films: number
    watchedFilms: number
    ratedFilms: number
    diaryViewings: number
    rewatchViewings: number
    reviews: number
    watchedWithoutDiary: number
    watchlistFilms: number
    likedFilms: number
    lists: number
    detachedEntries: number
    viewingsByDateQuality: Record<DateQuality, number>
    ratingRevisions: number
  }
  notes: string[]
}

export interface Dataset {
  schemaVersion: 1
  generatedAt: string
  source: { archive: string; sha256: string; exportedAt: string | null }
  profile: Profile
  films: Film[]
  viewings: Viewing[]
  reviews: Review[]
  lists: UserList[]
  detached: DetachedEntry[]
  social: { likedReviews: number; likedLists: number; commentsWritten: number }
  audit: Audit
}

// ─── Enrichment ────────────────────────────────────────────────────────────

export interface PersonRef {
  id: string // Wikidata QID or tmdb:<id>
  name: string
}

export type MatchConfidence = 'high' | 'medium' | 'low'

export interface FilmMatch {
  wikidataId: string | null
  tmdbId: number | null
  imdbId: string | null
  letterboxdSlug: string | null
  method: 'letterboxd-id' | 'title-year-search' | 'tmdb-search' | 'manual-override'
  confidence: MatchConfidence
  notes: string[]
}

export interface FilmMetadata {
  filmId: string
  match: FilmMatch
  label: string
  description: string | null
  releaseYear: number | null
  runtime: number | null
  /** canonical genres (small controlled vocabulary) */
  genres: string[]
  /** finer-grained source genre labels (e.g. "psychological thriller", "superhero film") */
  subgenres: string[]
  directors: PersonRef[]
  writers: PersonRef[]
  cast: PersonRef[]
  cinematographers: PersonRef[]
  composers: PersonRef[]
  editors: PersonRef[]
  producers: PersonRef[]
  companies: PersonRef[]
  distributors: PersonRef[]
  countries: string[]
  languages: string[]
  subjects: string[]
  series: string[]
  basedOn: string[]
  awardsWon: string[]
  nominations: string[]
  /** number of Wikipedia language editions covering the film — a notability proxy */
  sitelinks: number
  isAnimated: boolean
  isDocumentary: boolean
  isShortOrSpecial: boolean
  /** television series / miniseries that Letterboxd lists alongside films */
  isTv: boolean
  posterUrl: string | null
  overview: string | null
  keywords: string[]
  sources: string[]
}

export interface MetadataFile {
  generatedAt: string
  sources: string[]
  films: Record<string, FilmMetadata>
  unmatched: { filmId: string; title: string; year: number | null; reason: string }[]
}
