import type { LanguageCategory } from '../../shared/app-types.ts'
import type { Review } from '../../shared/types.ts'
import { logOddsZ, mean, pearson, round } from './stats.ts'

/**
 * Transparent lexicons for what a review talks about. Matching is whole-word on lowercase text;
 * a trailing * means prefix match. Categories are descriptive, not sentiment.
 */
export const CATEGORIES: { id: string; label: string; terms: string[] }[] = [
  { id: 'visuals', label: 'Visuals & cinematography', terms: ['visual*', 'cinematograph*', 'shot', 'shots', 'colour*', 'color*', 'pallet*', 'palette', 'gorgeous', 'stunning', 'beautiful*', 'aesthetic*', 'look', 'looks', 'looked', 'framing', 'lighting', 'cgi', 'effects', 'vfx', 'imagery', 'animation', 'animated', 'art style', 'style'] },
  { id: 'sound', label: 'Score & sound', terms: ['score', 'soundtrack', 'music', 'sound*', 'song*', 'needle drop*', 'composer'] },
  { id: 'story', label: 'Story & writing', terms: ['story', 'plot*', 'writing', 'written', 'script', 'narrative', 'twist*', 'ending', 'third act', 'premise', 'storytelling', 'dialogue', 'character*'] },
  { id: 'pacing', label: 'Pacing & length', terms: ['pacing', 'paced', 'pace', 'slow*', 'sluggish', 'long', 'length', 'runtime', 'dragged', 'drags', 'boring', 'bored'] },
  { id: 'performance', label: 'Acting & casting', terms: ['acting', 'actor*', 'actress*', 'performance*', 'cast', 'casting*', 'castings', 'shine*', 'shined', 'chemistry', 'role', 'played', 'portray*'] },
  { id: 'emotion', label: 'Emotion & heart', terms: ['cry', 'cried', 'crying', 'tears', 'emotional*', 'heart*', 'moving', 'touching', 'sad', 'feel*', 'felt', 'wholesome', 'love', 'loved'] },
  { id: 'fun', label: 'Fun & entertainment', terms: ['fun', 'funny', 'hilarious', 'laugh*', 'entertaining', 'enjoy*', 'popcorn', 'blast', 'goofy', 'silly', 'comedy', 'jokes'] },
  { id: 'tension', label: 'Tension & dread', terms: ['tense', 'tension', 'scary', 'creepy', 'dread', 'unsettling', 'disturbing', 'intense', 'thrilling', 'suspense*', 'edge of my seat', 'horror'] },
  { id: 'ideas', label: 'Ideas & meaning', terms: ['message', 'theme*', 'meaning', 'commentary', 'thought provoking', 'thought-provoking', 'think', 'thinking', 'philosoph*', 'society', 'social', 'grief', 'existential'] },
  { id: 'atmosphere', label: 'Atmosphere & world', terms: ['atmosphere', 'atmospheric', 'vibe*', 'mood*', 'tone', 'world', 'world-building', 'worldbuilding', 'immersive', 'setting'] },
  { id: 'craft', label: 'Direction & craft', terms: ['direct*', 'director*', 'filmmaking', 'craft*', 'masterpiece', 'masterclass', 'editing', 'execution', 'executed'] },
  { id: 'theatre', label: 'The theatre experience', terms: ['theatre', 'theater', 'cinema', 'imax', 'big screen', 'crowd', 'audience', 'screening'] },
]

const POSITIVE = ['amazing', 'awesome', 'great', 'loved', 'love', 'perfect', 'perfection', 'masterpiece', 'beautiful', 'incredible', 'fantastic', 'excellent', 'brilliant', 'favourite', 'favorite', 'best', 'enjoyed', 'fun', 'stunning', 'gorgeous', 'wonderful', 'solid', 'good', 'phenomenal', 'unreal', 'hilarious', 'gem', 'banger', 'peak', 'shined', 'shine', 'chef', 'kiss', 'goated', 'nice', 'cool', 'impressive', 'blast', 'masterclass', 'superb', 'delight', 'delightful']
const NEGATIVE = ['boring', 'bad', 'worst', 'disappointing', 'disappointed', 'mid', 'meh', 'sluggish', 'slow', 'dragged', 'messy', 'mess', 'weak', 'awful', 'terrible', 'forgettable', 'annoying', 'cringe', 'dull', 'lacking', 'lacked', 'confusing', 'overrated', 'waste', 'flat', 'predictable', 'bland', 'tedious', 'poor', 'lame', 'why', 'rough', 'unfortunately', 'sadly', 'off']
const HEDGES = ['but', 'though', 'although', 'however', 'just', 'wish', 'if only', 'could have', "could've", 'should have', "should've", 'felt like', 'kind of', 'kinda', 'a bit', 'somewhat']

const STOP = new Set(('a an the and or but if of to in on at for with without is it its it\'s this that was were be been are i i\'m im me my we you your he she they them his her their as so very really just too not no yes all any some more most much from by about into out up down over than then there here what which who whom how when where why can could would should will do did does done have has had get got one two also even still only like film movie movies films watch watched watching see saw seen time made make makes way thing things lot bit').split(' '))

export const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []

function matcher(terms: string[]): (text: string) => boolean {
  const res = terms.map((t) =>
    t.endsWith('*') ? new RegExp(`\\b${escape(t.slice(0, -1))}`, 'i') : new RegExp(`\\b${escape(t)}\\b`, 'i'),
  )
  return (text) => res.some((re) => re.test(text))
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function countTerms(text: string, terms: string[]): number {
  const toks = tokenize(text)
  const lower = ' ' + toks.join(' ') + ' '
  let n = 0
  for (const t of terms) {
    if (t.includes(' ')) n += lower.split(` ${t} `).length - 1
    else n += toks.filter((w) => w === t).length
  }
  return n
}

export function sentiment(text: string): number {
  const toks = tokenize(text)
  if (!toks.length) return 0
  const pos = toks.filter((t) => POSITIVE.includes(t)).length
  const neg = toks.filter((t) => NEGATIVE.includes(t)).length
  return (pos - neg) / Math.sqrt(toks.length)
}

export interface LanguageResult {
  categories: LanguageCategory[]
  distinctive: { high: { word: string; score: number; count: number }[]; low: { word: string; score: number; count: number }[] }
  lengthVsRating: { rating: number; meanWords: number; n: number }[]
  textRatingCorrelation: number | null
  lengthCorrelation: number | null
  hedgeRate: { high: number; low: number }
  mismatches: { warmerThanRating: { filmId: string; sentiment: number; rating: number }[]; coolerThanRating: { filmId: string; sentiment: number; rating: number }[] }
  meanWords: number
  /** share of reviews with ≤ 12 words */
  shortShare: number
}

export function analyzeLanguage(reviews: Review[], snippetFor: (r: Review, re: (t: string) => boolean) => string): LanguageResult {
  const rated = reviews.filter((r) => r.rating !== null && r.text.trim())
  const categories: LanguageCategory[] = CATEGORIES.map((c) => {
    const m = matcher(c.terms)
    const hit = rated.filter((r) => m(r.text))
    const miss = rated.filter((r) => !m(r.text))
    const mh = hit.length ? mean(hit.map((r) => r.rating!)) : null
    const mm = miss.length ? mean(miss.map((r) => r.rating!)) : null
    return {
      id: c.id,
      label: c.label,
      terms: c.terms,
      reviews: hit.length,
      share: round(hit.length / Math.max(rated.length, 1), 3),
      meanWhenMentioned: mh === null ? null : round(mh),
      meanOtherwise: mm === null ? null : round(mm),
      lift: mh !== null && mm !== null && hit.length >= 5 ? round(mh - mm) : null,
      examples: hit
        .sort((a, b) => b.rating! - a.rating! || b.wordCount - a.wordCount)
        .slice(0, 4)
        .map((r) => ({ filmId: r.filmId, snippet: snippetFor(r, m) })),
    }
  })

  // Distinctive vocabulary: ≥ 4★ reviews vs ≤ 3★ reviews.
  const high = rated.filter((r) => r.rating! >= 4)
  const low = rated.filter((r) => r.rating! <= 3)
  const counts = (rs: Review[]) => {
    const m = new Map<string, number>()
    for (const r of rs) for (const w of new Set(tokenize(r.text))) if (!STOP.has(w) && w.length > 2) m.set(w, (m.get(w) ?? 0) + 1)
    return m
  }
  const ch = counts(high), cl = counts(low)
  const vocab = new Set([...ch.keys(), ...cl.keys()])
  const scored = [...vocab]
    .map((w) => {
      const a = ch.get(w) ?? 0, b = cl.get(w) ?? 0
      return { word: w, score: round(logOddsZ(a, high.length, b, low.length, 0.5, 1), 2), count: a + b, a, b }
    })
    .filter((x) => x.count >= 3)
  const distinctive = {
    high: scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 18).map(({ word, score, a }) => ({ word, score, count: a })),
    low: scored.filter((x) => x.score < 0).sort((a, b) => a.score - b.score).slice(0, 18).map(({ word, score, b }) => ({ word, score, count: b })),
  }

  const byRating = new Map<number, number[]>()
  for (const r of rated) byRating.set(r.rating!, [...(byRating.get(r.rating!) ?? []), r.wordCount])
  const lengthVsRating = [...byRating]
    .sort((a, b) => a[0] - b[0])
    .map(([rating, ws]) => ({ rating, meanWords: round(mean(ws), 1), n: ws.length }))

  const sentiments = rated.map((r) => sentiment(r.text))
  const ratings = rated.map((r) => r.rating!)
  const corr = pearson(sentiments, ratings)
  const lenCorr = pearson(rated.map((r) => r.wordCount), ratings)
  const hedgeShare = (rs: Review[]) => (rs.length ? rs.filter((r) => countTerms(r.text, HEDGES) > 0).length / rs.length : 0)

  // Mismatch: sentiment z vs rating z.
  const ms = mean(sentiments), ss = Math.sqrt(mean(sentiments.map((s) => (s - ms) ** 2))) || 1
  const mr = mean(ratings), sr = Math.sqrt(mean(ratings.map((s) => (s - mr) ** 2))) || 1
  const gaps = rated
    .map((r, i) => ({ filmId: r.filmId, sentiment: round(sentiments[i]), rating: r.rating!, gap: (sentiments[i] - ms) / ss - (r.rating! - mr) / sr, words: r.wordCount }))
    .filter((g) => g.words >= 6)
  return {
    categories,
    distinctive,
    lengthVsRating,
    textRatingCorrelation: Number.isFinite(corr) ? round(corr) : null,
    lengthCorrelation: Number.isFinite(lenCorr) ? round(lenCorr) : null,
    hedgeRate: { high: round(hedgeShare(high), 3), low: round(hedgeShare(low), 3) },
    mismatches: {
      warmerThanRating: gaps.filter((g) => g.gap > 1.6).sort((a, b) => b.gap - a.gap).slice(0, 6).map(({ filmId, sentiment, rating }) => ({ filmId, sentiment, rating })),
      coolerThanRating: gaps.filter((g) => g.gap < -1.6).sort((a, b) => a.gap - b.gap).slice(0, 6).map(({ filmId, sentiment, rating }) => ({ filmId, sentiment, rating })),
    },
    meanWords: rated.length ? round(mean(rated.map((r) => r.wordCount)), 1) : 0,
    shortShare: round(rated.filter((r) => r.wordCount <= 12).length / Math.max(rated.length, 1), 3),
  }
}

/** First sentence of a review that matches `re`, trimmed to ~160 chars. */
export function snippet(text: string, re: (t: string) => boolean): string {
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).filter(Boolean)
  const s = sentences.find((x) => re(x)) ?? sentences[0] ?? text
  return s.length > 160 ? s.slice(0, 157).trimEnd() + '…' : s
}
