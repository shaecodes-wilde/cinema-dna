import { interpolateRgb } from 'd3'
import { COOL, NEUTRAL, WARM } from '../../lib/format.ts'

/** Diverging colour for a rating lift in stars (± `max` saturates). */
export function deltaColor(delta: number | null | undefined, max = 0.5): string {
  if (delta === null || delta === undefined) return NEUTRAL
  const t = Math.max(-1, Math.min(1, delta / max))
  return t >= 0 ? interpolateRgb(NEUTRAL, WARM)(t) : interpolateRgb(NEUTRAL, COOL)(-t)
}

export const GRID = '#2a2724'
export const AXIS_INK = '#8d877d'
