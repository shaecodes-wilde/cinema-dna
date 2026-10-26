import type {
  Audit,
  Dataset,
  DateQuality,
  DetachedEntry,
  FileAudit,
  Film,
  IdentityConflict,
  Profile,
  Review,
  SourceRef,
  UserList,
  Viewing,
} from '../../shared/types.ts'
import { filmKey, slugify } from '../util/slug.ts'
import type { ExportArchive } from './archive.ts'
import { isoDate, num, parseCsv, parseListCsv, uriCode, type Row } from './csv.ts'

const FILM_FILES = ['watched.csv', 'ratings.csv', 'likes/films.csv', 'watchlist.csv'] as const
const DAY = 86_400_000

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY)
}

export function classifyDate(watched: string | null, logged: string, joined: string | null): DateQuality {
  if (!watched) return 'missing'
  if (joined && watched < joined) return watched.endsWith('-01-01') ? 'approximate' : 'backfilled'
  return daysBetween(watched, logged) > 7 ? 'delayed' : 'live'
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Builds the normalized dataset. Film identity is anchored on the film's boxd.it code from
 * the film-level files; diary/review rows carry *entry* codes, so they join on (title, year).
 */
export function normalize(archive: ExportArchive, now = new Date()): Dataset {
  const files = archive.files
  const fileAudits: FileAudit[] = []
  const conflicts: IdentityConflict[] = []
  const notes: string[] = []

  const read = (name: string): Row[] => {
    const text = files.get(name)
    return text === undefined ? [] : parseCsv(text)
  }
  const audit = (file: string, rows: Row[], linked: number, required: string[]): FileAudit => {
    const missing: Record<string, number> = {}
    for (const field of required) {
      const n = rows.filter((r) => !r[field]).length
      if (n) missing[field] = n
    }
    const fa = { file, present: files.has(file), rows: rows.length, linked, unlinked: rows.length - linked, missing }
    fileAudits.push(fa)
    return fa
  }

  // ── Profile ────────────────────────────────────────────────────────────
  const profileRow = read('profile.csv')[0] ?? {}
  const joinedDate = isoDate(profileRow['Date Joined'])

  // ── Films (identity) ──────────────────────────────────────────────────
  const byId = new Map<string, Film>()
  const byKey = new Map<string, Film>()
  const blank = (id: string, title: string, year: number | null, uri: string | null): Film => ({
    id,
    title,
    year,
    slug: slugify(title),
    letterboxdUri: uri,
    watched: false,
    watchedAddedDate: null,
    rating: null,
    ratingDate: null,
    liked: false,
    likedDate: null,
    inWatchlist: false,
    watchlistAddedDate: null,
    isProfileFavorite: false,
    viewingIds: [],
    reviewIds: [],
    listMemberships: [],
    provenance: [],
  })

  const upsertByUri = (title: string, year: number | null, uri: string, ref: SourceRef): Film => {
    const code = uriCode(uri)!
    const id = `lb:${code}`
    let film = byId.get(id)
    if (!film) {
      film = blank(id, title, year, uri)
      byId.set(id, film)
    } else if (film.title !== title || film.year !== year) {
      conflicts.push({
        kind: 'same-uri-different-title',
        detail: `${uri} is "${film.title}" (${film.year}) and "${title}" (${year})`,
        refs: [...film.provenance.slice(0, 1), ref],
      })
    }
    const key = filmKey(title, year)
    const other = byKey.get(key)
    if (other && other.id !== id) {
      conflicts.push({
        kind: 'same-title-year-different-uri',
        detail: `"${title}" (${year}) maps to ${other.id} and ${id}`,
        refs: [...other.provenance.slice(0, 1), ref],
      })
    } else byKey.set(key, film)
    film.provenance.push(ref)
    return film
  }

  /** Diary/review/orphan rows: resolve by (title, year), creating a title-keyed film only as a last resort. */
  const resolveByTitle = (title: string, year: number | null, ref: SourceRef): Film => {
    const key = filmKey(title, year)
    let film = byKey.get(key)
    if (!film) {
      conflicts.push({
        kind: 'unresolved-title-year',
        detail: `"${title}" (${year}) has no film-level record; created a title-keyed film`,
        refs: [ref],
      })
      film = blank(`ty:${key}`, title, year, null)
      byId.set(film.id, film)
      byKey.set(key, film)
    }
    film.provenance.push(ref)
    return film
  }

  for (const file of FILM_FILES) {
    const rows = read(file)
    let linked = 0
    rows.forEach((r, i) => {
      const uri = r['Letterboxd URI']
      if (!uriCode(uri) || !r.Name) return
      linked++
      const film = upsertByUri(r.Name, num(r.Year), uri, { file, row: i + 1 })
      const date = isoDate(r.Date)
      if (file === 'watched.csv') {
        film.watched = true
        film.watchedAddedDate = date
      } else if (file === 'ratings.csv') {
        film.rating = num(r.Rating)
        film.ratingDate = date
      } else if (file === 'likes/films.csv') {
        film.liked = true
        film.likedDate = date
      } else {
        film.inWatchlist = true
        film.watchlistAddedDate = date
      }
    })
    audit(file, rows, linked, ['Name', 'Year', 'Letterboxd URI', ...(file === 'ratings.csv' ? ['Rating'] : [])])
  }
  // Rated or liked implies watched on Letterboxd even if watched.csv was trimmed.
  for (const f of byId.values()) {
    if ((f.rating !== null || f.liked) && !f.watched) {
      notes.push(`"${f.title}" is rated/liked but missing from watched.csv; treated as watched.`)
      f.watched = true
    }
  }

  // ── Diary viewings ────────────────────────────────────────────────────
  const viewings: Viewing[] = []
  const diaryRows = read('diary.csv')
  diaryRows.forEach((r, i) => {
    const ref = { file: 'diary.csv', row: i + 1 }
    const film = resolveByTitle(r.Name, num(r.Year), ref)
    const watchedDate = isoDate(r['Watched Date'])
    const loggedDate = isoDate(r.Date) ?? watchedDate ?? ''
    const v: Viewing = {
      id: uriCode(r['Letterboxd URI']) ?? `diary-${i + 1}`,
      filmId: film.id,
      watchedDate,
      loggedDate,
      rating: num(r.Rating),
      rewatch: r.Rewatch === 'Yes',
      tags: splitTags(r.Tags),
      reviewId: null,
      dateQuality: classifyDate(watchedDate, loggedDate, joinedDate),
      provenance: [ref],
    }
    if (!film.watched) {
      film.watched = true
      notes.push(`"${film.title}" has a diary entry but no watched.csv row; treated as watched.`)
    }
    viewings.push(v)
    film.viewingIds.push(v.id)
  })
  audit('diary.csv', diaryRows, diaryRows.length, ['Name', 'Year', 'Watched Date', 'Rating'])
  const viewingById = new Map(viewings.map((v) => [v.id, v]))

  // ── Reviews ───────────────────────────────────────────────────────────
  const reviews: Review[] = []
  const reviewRows = read('reviews.csv')
  let reviewLinked = 0
  reviewRows.forEach((r, i) => {
    const ref = { file: 'reviews.csv', row: i + 1 }
    const film = resolveByTitle(r.Name, num(r.Year), ref)
    const id = uriCode(r['Letterboxd URI']) ?? `review-${i + 1}`
    const viewing = viewingById.get(id) ?? null
    if (viewing) {
      reviewLinked++
      viewing.reviewId = id
    }
    const text = r.Review ?? ''
    reviews.push({
      id,
      filmId: film.id,
      viewingId: viewing?.id ?? null,
      text,
      wordCount: wordCount(text),
      rating: num(r.Rating),
      watchedDate: isoDate(r['Watched Date']),
      loggedDate: isoDate(r.Date) ?? '',
      rewatch: r.Rewatch === 'Yes',
      tags: splitTags(r.Tags),
      provenance: [ref],
    })
    film.reviewIds.push(id)
  })
  audit('reviews.csv', reviewRows, reviewLinked, ['Name', 'Year', 'Review'])
  if (reviewRows.length > reviewLinked)
    notes.push(`${reviewRows.length - reviewLinked} reviews have no matching diary entry (review-only).`)

  // ── Rating revisions: current rating vs. the most recent diary rating ──
  let ratingRevisions = 0
  for (const film of byId.values()) {
    const rated = film.viewingIds
      .map((id) => viewingById.get(id)!)
      .filter((v) => v.rating !== null)
      .sort((a, b) => (a.watchedDate ?? a.loggedDate).localeCompare(b.watchedDate ?? b.loggedDate))
    const last = rated.at(-1)
    if (last && film.rating !== null && last.rating !== film.rating) {
      ratingRevisions++
      conflicts.push({
        kind: 'rating-mismatch',
        detail: `"${film.title}": latest diary rating ${last.rating}★, current rating ${film.rating}★ (revised ${film.ratingDate})`,
        refs: [...last.provenance, ...film.provenance.filter((p) => p.file === 'ratings.csv')],
      })
    }
  }

  // ── Lists ─────────────────────────────────────────────────────────────
  const lists: UserList[] = []
  for (const [name, text] of [...files].filter(([n]) => n.startsWith('lists/')).sort()) {
    const { meta, entries } = parseListCsv(text)
    const listId = uriCode(meta.URL) ?? name
    const list: UserList = {
      id: listId,
      name: meta.Name?.trim() || name,
      url: meta.URL || null,
      createdDate: isoDate(meta.Date),
      description: meta.Description ?? '',
      tags: splitTags(meta.Tags),
      isRanking: /rank/i.test(meta.Name ?? ''),
      entries: [],
      provenance: [{ file: name, row: 1 }],
    }
    let linked = 0
    entries.forEach((e, i) => {
      const ref = { file: name, row: i + 1 }
      const year = num(e.Year)
      const film = uriCode(e.URL) ? upsertByUri(e.Name, year, e.URL, ref) : resolveByTitle(e.Name, year, ref)
      linked++
      const position = num(e.Position) ?? i + 1
      list.entries.push({ position, filmId: film.id, title: film.title, year: film.year })
      film.listMemberships.push({ listId, position })
    })
    audit(name, entries, linked, ['Name', 'Year', 'URL'])
    lists.push(list)
  }

  // ── Profile favourites ───────────────────────────────────────────────
  const favoriteFilmIds: string[] = []
  for (const uri of (profileRow['Favorite Films'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const film = byId.get(`lb:${uriCode(uri)}`)
    if (film) {
      film.isProfileFavorite = true
      favoriteFilmIds.push(film.id)
    } else notes.push(`Profile favourite ${uri} does not match any exported film.`)
  }
  const profile: Profile = {
    username: profileRow.Username ?? '',
    givenName: profileRow['Given Name'] ?? '',
    joinedDate,
    location: profileRow.Location ?? '',
    bio: profileRow.Bio ?? '',
    pronoun: profileRow.Pronoun ?? '',
    website: profileRow.Website ?? '',
    favoriteFilmIds,
  }
  audit('profile.csv', profileRow.Username ? [profileRow] : [], profileRow.Username ? 1 : 0, ['Username', 'Date Joined'])

  // ── Orphaned / deleted content: kept, never counted as viewing history ─
  const detached: DetachedEntry[] = []
  for (const status of ['orphaned', 'deleted'] as const) {
    for (const kind of ['diary', 'reviews', 'comments'] as const) {
      const file = `${status}/${kind}.csv`
      const rows = read(file)
      rows.forEach((r, i) =>
        detached.push({
          status,
          kind: kind === 'reviews' ? 'review' : kind === 'comments' ? 'comment' : 'diary',
          title: r.Name || null,
          year: num(r.Year),
          rating: num(r.Rating),
          watchedDate: isoDate(r['Watched Date']),
          loggedDate: isoDate(r.Date),
          text: r.Review || r.Comment || null,
          provenance: [{ file, row: i + 1 }],
        }),
      )
      if (files.has(file)) audit(file, rows, 0, [])
    }
  }

  const films = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title) || (a.year ?? 0) - (b.year ?? 0))
  const byQuality = { live: 0, delayed: 0, backfilled: 0, approximate: 0, missing: 0 } as Record<DateQuality, number>
  for (const v of viewings) byQuality[v.dateQuality]++

  const auditOut: Audit = {
    files: fileAudits,
    conflicts,
    counts: {
      films: films.length,
      watchedFilms: films.filter((f) => f.watched).length,
      ratedFilms: films.filter((f) => f.rating !== null).length,
      diaryViewings: viewings.length,
      rewatchViewings: viewings.filter((v) => v.rewatch).length,
      reviews: reviews.length,
      watchedWithoutDiary: films.filter((f) => f.watched && f.viewingIds.length === 0).length,
      watchlistFilms: films.filter((f) => f.inWatchlist).length,
      likedFilms: films.filter((f) => f.liked).length,
      lists: lists.length,
      detachedEntries: detached.length,
      viewingsByDateQuality: byQuality,
      ratingRevisions,
    },
    notes,
  }
  const watchedAndListed = films.filter((f) => f.watched && f.inWatchlist).length
  if (watchedAndListed) notes.push(`${watchedAndListed} film${watchedAndListed === 1 ? ' is' : 's are'} both watched and on the watchlist.`)

  const exportedAt = archive.path.match(/(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-utc/)
  // Renamed archives lose the timestamp; fall back to the newest date recorded in the export itself.
  const newest = [...viewings.map((v) => v.loggedDate), ...films.flatMap((f) => [f.ratingDate, f.watchedAddedDate, f.watchlistAddedDate, f.likedDate])]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    source: {
      archive: archive.path.split('/').pop() ?? archive.path,
      sha256: archive.sha256,
      exportedAt: exportedAt ? `${exportedAt[1]}T${exportedAt[2]}:${exportedAt[3]}:00Z` : newest ? `${newest}T00:00:00Z` : null,
    },
    profile,
    films,
    viewings,
    reviews,
    lists,
    detached,
    social: {
      likedReviews: read('likes/reviews.csv').length,
      likedLists: read('likes/lists.csv').length,
      commentsWritten: read('comments.csv').length,
    },
    audit: auditOut,
  }
}

function splitTags(s: string | undefined): string[] {
  return (s ?? '').split(',').map((t) => t.trim()).filter(Boolean)
}
