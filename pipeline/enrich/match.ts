import type { MatchConfidence } from '../../shared/types.ts'
import { slugify, titleKey } from '../util/slug.ts'
import { isFilmLike, yearsOf, type CompactEntity } from './wikidata.ts'

export interface FilmQuery {
  title: string
  year: number | null
}

export interface CandidateScore {
  entity: CompactEntity
  score: number
  confidence: MatchConfidence
  notes: string[]
}

/** Letterboxd-style slug candidates (Letterboxd disambiguates duplicates with -year or -n suffixes). */
export function slugCandidates(q: FilmQuery): string[] {
  const base = slugify(q.title)
  const out = [base]
  if (q.year) out.push(`${base}-${q.year}`)
  out.push(`${base}-1`, `${base}-2`)
  return out
}

function yearDistance(q: FilmQuery, e: CompactEntity): number | null {
  if (!q.year) return 0
  const ys = yearsOf(e)
  if (!ys.length) return null
  return Math.min(...ys.map((y) => Math.abs(y - q.year!)))
}

function titleMatch(q: FilmQuery, e: CompactEntity): 'exact' | 'partial' | 'none' {
  const k = titleKey(q.title)
  const names = [e.label, ...e.aliases].map(titleKey)
  if (names.includes(k)) return 'exact'
  const stripped = (s: string) => s.replace(/^the/, '')
  if (names.some((n) => stripped(n) === stripped(k))) return 'exact'
  if (names.some((n) => n.length > 3 && (n.includes(k) || k.includes(n)))) return 'partial'
  return 'none'
}

/**
 * Scores a Wikidata candidate for a Letterboxd film. Returns null when the candidate is
 * rejected (not film-like, year off by >1, or title unrelated for search hits).
 */
export function scoreCandidate(q: FilmQuery, e: CompactEntity, viaLetterboxdId: boolean): CandidateScore | null {
  const notes: string[] = []
  if (!isFilmLike(e) && !viaLetterboxdId) return null
  const yd = yearDistance(q, e)
  if (yd === null) {
    // Search hits must agree on year; only an explicit Letterboxd ID can vouch for an undated item.
    if (!viaLetterboxdId) return null
    notes.push('candidate has no publication date (series or undated item)')
  }
  else if (yd > 1) return null
  const tm = titleMatch(q, e)
  if (tm === 'none' && !viaLetterboxdId) return null
  let score = 0
  if (viaLetterboxdId) score += 6
  score += tm === 'exact' ? 3 : tm === 'partial' ? 1 : 0
  score += yd === 0 ? 3 : yd === 1 ? 1 : 0
  score += Math.min(e.sitelinks, 60) / 60 // tie-break toward the notable work
  if (yd === 1) notes.push('release year differs by one')
  if (tm === 'partial') notes.push(`title "${e.label}" only partially matches`)
  const confidence: MatchConfidence =
    viaLetterboxdId && yd !== null ? 'high' : tm === 'exact' && yd === 0 ? 'high' : tm === 'exact' ? 'medium' : 'low'
  return { entity: e, score, confidence, notes }
}

export function pickBest(scored: (CandidateScore | null)[]): CandidateScore | null {
  const valid = scored.filter((s): s is CandidateScore => s !== null).sort((a, b) => b.score - a.score)
  if (!valid.length) return null
  const [best, second] = valid
  // Two near-identical candidates (e.g. a film and its remake in the same year) → downgrade.
  if (second && best.score - second.score < 0.5 && best.confidence === 'high') {
    return { ...best, confidence: 'medium', notes: [...best.notes, `ambiguous with ${second.entity.id}`] }
  }
  return best
}
