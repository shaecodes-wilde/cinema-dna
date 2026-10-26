import { interpolateRgb } from 'd3'

/** Diverging colour for a rating relative to the user's own mean (cool below, warm above). */
export const COOL = '#3987e5'
export const WARM = '#e0a43a'
export const NEUTRAL = '#77736b'
export const EMBER = '#d95926'
export const AQUA = '#199e70'

export function ratingColor(rating: number | null | undefined, mean: number, sd: number): string {
  if (rating === null || rating === undefined) return '#3a3632'
  const z = Math.max(-2, Math.min(2, (rating - mean) / (sd || 1))) / 2
  return z >= 0 ? interpolateRgb(NEUTRAL, WARM)(z) : interpolateRgb(NEUTRAL, COOL)(-z)
}

/** Sequential amber ramp for counts/heat (0 = surface). */
export function heat(t: number): string {
  if (t <= 0) return '#1e1b18'
  return interpolateRgb('#3b2c12', '#f0b54a')(Math.min(1, Math.max(0, t)))
}

export const stars = (r: number | null | undefined): string => {
  if (r === null || r === undefined) return '—'
  const full = Math.floor(r)
  return '★'.repeat(full) + (r % 1 ? '½' : '')
}

/** Averages: fixed decimals ("3.48★"). */
export const fmtRating = (r: number | null | undefined, digits = 2) => (r === null || r === undefined ? '—' : `${r.toFixed(digits)}★`)

/** A single star rating as entered on Letterboxd ("4.5★", "3★"). */
export const fmtStars = (r: number | null | undefined) =>
  r === null || r === undefined ? '—' : `${Number.isInteger(r) ? r.toFixed(0) : Number.isInteger(r * 2) ? r.toFixed(1) : r.toFixed(2)}★`

export const signed = (x: number | null | undefined, digits = 2) =>
  x === null || x === undefined ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}`

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', opts) : '—'

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? word : pluralWord}`

/** Deterministic hue-free "poster" palette from a film id so typographic posters vary subtly. */
export function posterTone(id: string): { bg: string; ink: string } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const tones = [
    ['#1d1813', '#e9dcc4'], ['#14181d', '#d9e1ea'], ['#1c1416', '#ecd6d6'], ['#16191a', '#d5e3dc'],
    ['#1b1a14', '#e6e1c8'], ['#191520', '#ddd6ea'], ['#201812', '#f0d9bf'], ['#121716', '#cfe3dc'],
  ]
  const [bg, ink] = tones[h % tones.length]
  return { bg, ink }
}
