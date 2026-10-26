import { line, scaleLinear } from 'd3'
import type { AppData } from '../../../shared/app-types.ts'
import { pct } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { GRID } from '../dna/scales.ts'

/**
 * Small multiples: one panel per genre, share of that year's films (by viewing date).
 * All panels share the same y-scale so slopes are comparable; the selected genre is amber.
 */
export function GenreEvolution({
  years,
  genres,
  selected,
  onSelect,
}: {
  years: AppData['timeline']['years']
  genres: string[]
  selected: string | null
  onSelect: (g: string) => void
}) {
  const tip = useTooltip()
  const w = 180
  const h = 92
  const m = { t: 10, r: 10, b: 18, l: 10 }
  const maxShare = Math.max(0.1, ...years.flatMap((y) => genres.map((g) => y.genreShares[g] ?? 0)))
  const x = scaleLinear().domain([years[0]?.year ?? 0, years.at(-1)?.year ?? 1]).range([m.l, w - m.r])
  const y = scaleLinear().domain([0, maxShare]).range([h - m.b, m.t]).nice()
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {genres.map((g) => {
        const pts = years.map((yy) => ({ year: yy.year, v: yy.genreShares[g] ?? 0, n: yy.viewings }))
        const path = line<{ year: number; v: number }>()
          .x((d) => x(d.year))
          .y((d) => y(d.v))(pts)
        const sel = selected === g
        const first = pts[0]?.v ?? 0
        const last = pts.at(-1)?.v ?? 0
        return (
          <button
            key={g}
            type="button"
            aria-pressed={sel}
            onClick={() => onSelect(g)}
            aria-label={`${g}: ${pts.map((p) => `${p.year} ${pct(p.v)}`).join(', ')}`}
            className={`rounded-[3px] border p-3 text-left transition ${sel ? 'border-amber/70 bg-night-3' : 'border-line bg-night-2 hover:border-line-2'}`}
          >
            <div className="flex items-baseline justify-between">
              <span className={`text-[12px] ${sel ? 'text-amber' : 'text-ink-2'}`}>{g}</span>
              <span className="num text-[11px] text-muted">
                {pct(first)} → <span className="text-ink">{pct(last)}</span>
              </span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full" aria-hidden>
              {y.ticks(2).map((t) => (
                <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={GRID} />
              ))}
              <path d={path ?? ''} fill="none" stroke={sel ? '#e0a43a' : '#c9c1b4'} strokeWidth={2} strokeLinejoin="round" />
              {pts.map((p) => (
                <g key={p.year}>
                  <circle
                    cx={x(p.year)}
                    cy={y(p.v)}
                    r={3.5}
                    fill={sel ? '#e0a43a' : '#efe8dc'}
                    stroke="#161412"
                    strokeWidth={2}
                    onMouseMove={(e) => tip.show(<span className="num">{g} · {p.year}: {pct(p.v)} of {p.n} viewings' films</span>, e)}
                    onMouseLeave={tip.hide}
                  />
                </g>
              ))}
              {[pts[0], pts.at(-1)].filter(Boolean).map((p) => (
                <text key={p!.year} x={x(p!.year)} y={h - 4} textAnchor="middle" className="fill-muted text-[9px]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {p!.year}
                </text>
              ))}
            </svg>
          </button>
        )
      })}
    </div>
  )
}
