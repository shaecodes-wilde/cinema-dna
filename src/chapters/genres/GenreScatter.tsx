import { scaleLinear, scalePow, scaleSqrt } from 'd3'
import type { AffinityRow } from '../../../shared/app-types.ts'
import { useReducedMotion } from '../../lib/data.tsx'
import { fmtRating, pct, signed } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { deltaColor, GRID } from '../dna/scales.ts'
import { onActivate, useWidth } from '../../lib/useSize.ts'

/**
 * Watch share (x) vs. shrunk rating (y) with 90% interval whiskers. Dot area = films,
 * colour = lift (diverging), the dashed-free baseline is the user's mean.
 */
export function GenreScatter({
  rows,
  baseline,
  selected,
  onSelect,
  labelAll,
}: {
  rows: AffinityRow[]
  baseline: number
  selected: string | null
  onSelect: (key: string) => void
  labelAll: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>(800)
  const tip = useTooltip()
  const reduced = useReducedMotion()
  const height = Math.max(360, Math.min(560, width * 0.6))
  const narrow = width < 560
  const m = { t: 20, r: narrow ? 56 : 84, b: 44, l: narrow ? 44 : 66 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const maxShare = Math.max(0.05, ...rows.map((r) => r.share))
  // Square-root x spreads the many small genres without hiding the big ones.
  const x = scalePow().exponent(0.5).domain([0, maxShare * 1.08]).range([0, iw]).nice()
  const yLo = Math.min(baseline - 0.3, ...rows.map((r) => r.ci[0]))
  const yHi = Math.max(baseline + 0.3, ...rows.map((r) => r.ci[1]))
  const y = scaleLinear().domain([yLo - 0.05, yHi + 0.05]).range([ih, 0]).nice()
  const rad = scaleSqrt().domain([0, Math.max(...rows.map((r) => r.n), 1)]).range([3, Math.min(22, width / 40)])

  // Greedy label placement: try right, left, above, below; skip if all collide.
  const placed: { x: number; y: number; w: number; h: number }[] = []
  const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' }>()
  const order = [...rows].sort((a, b) => (selected === a.key ? -1 : selected === b.key ? 1 : b.n - a.n))
  for (const r of order) {
    const cx = x(r.share)
    const cy = y(r.shrunk)
    const w = r.label.length * 6.6 + 4
    const rr = rad(r.n) + 4
    const options: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: { x: number; y: number } }[] = [
      { x: cx + rr, y: cy + 4, anchor: 'start', box: { x: cx + rr, y: cy - 7 } },
      { x: cx - rr, y: cy + 4, anchor: 'end', box: { x: cx - rr - w, y: cy - 7 } },
      { x: cx, y: cy - rr - 4, anchor: 'middle', box: { x: cx - w / 2, y: cy - rr - 16 } },
      { x: cx, y: cy + rr + 12, anchor: 'middle', box: { x: cx - w / 2, y: cy + rr } },
    ]
    if ((!labelAll || narrow) && selected !== r.key && r.n < 8 && Math.abs(r.delta) < 0.2) continue
    for (const o of options) {
      const b = { x: o.box.x, y: o.box.y, w, h: 14 }
      if (b.x < 2 || b.x + b.w > iw + m.r - 2 || b.y < -m.t) continue
      if (placed.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y)) continue
      placed.push(b)
      labels.set(r.key, { x: o.x, y: o.y, anchor: o.anchor })
      break
    }
  }

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="group" aria-label="Genres by share of your viewing and shrunk average rating">
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(6).map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x2={iw} stroke={GRID} />
              <text x={-10} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
                {t.toFixed(1)}★
              </text>
            </g>
          ))}
          {(narrow ? [0, 0.05, 0.2, 0.5] : [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5]).filter((t) => t <= x.domain()[1]).map((t) => (
            <g key={t} transform={`translate(${x(t)},${ih})`}>
              <line y1={0} y2={6} stroke="#3a3632" />
              <text y={20} textAnchor="middle" className="fill-muted text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
                {pct(t)}
              </text>
            </g>
          ))}
          <line x2={iw} y1={ih} y2={ih} stroke="#3a3632" />
          <line x2={iw} y1={y(baseline)} y2={y(baseline)} stroke="#c9c1b4" strokeOpacity={0.5} strokeWidth={1.5} />
          <text x={iw + 8} y={y(baseline) - 3} className="fill-ink-2 text-[10px] uppercase tracking-[0.14em]">
            {narrow ? 'avg' : 'your avg'}
          </text>
          <text x={iw + 8} y={y(baseline) + 10} className="fill-ink-2 text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
            {fmtRating(baseline)}
          </text>
          <text x={iw / 2} y={ih + 38} textAnchor="middle" className="fill-muted text-[10px] uppercase tracking-[0.18em]">
            share of your rated films →
          </text>
          <text display={narrow ? 'none' : undefined} transform={`translate(${-54},${ih / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[10px] uppercase tracking-[0.18em]">
            shrunk average →
          </text>

          {rows.map((r) => {
            const cx = x(r.share)
            const cy = y(r.shrunk)
            const sel = selected === r.key
            const dim = selected !== null && !sel
            const select = () => onSelect(r.key)
            return (
              <g
                key={r.key}
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={`${r.label}: ${r.n} films, ${pct(r.share)} of your ratings, shrunk average ${fmtRating(r.shrunk)}, ${signed(r.delta)} stars versus your mean`}
                onClick={select}
                onKeyDown={onActivate(select)}
                onMouseMove={(e) =>
                  tip.show(
                    <div className="space-y-1">
                      <div className="font-medium">{r.label}</div>
                      <div className="num text-ink-2">
                        {r.n} films · {pct(r.share)} of rated
                      </div>
                      <div className="num">
                        raw {fmtRating(r.mean)} → shrunk {fmtRating(r.shrunk)} ({signed(r.delta)}★)
                      </div>
                      <div className="num text-muted">
                        90% interval {r.ci[0].toFixed(2)}–{r.ci[1].toFixed(2)} · {r.confidence} confidence
                      </div>
                      <div className="text-muted">{pct(r.topShare)} rated 4.5★+ · click for films</div>
                    </div>,
                    e,
                  )
                }
                onMouseLeave={tip.hide}
                className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-amber"
                style={{ opacity: dim ? 0.35 : 1, transition: reduced ? undefined : 'opacity .3s' }}
              >
                <line x1={cx} x2={cx} y1={y(r.ci[0])} y2={y(r.ci[1])} stroke={deltaColor(r.delta)} strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={rad(r.n) + 8} fill="transparent" />
                <circle cx={cx} cy={cy} r={rad(r.n)} fill={deltaColor(r.delta)} fillOpacity={0.85} stroke={sel ? '#efe8dc' : '#0f0e0d'} strokeWidth={2} />
              </g>
            )
          })}
          {rows.map((r) => {
            const l = labels.get(r.key)
            if (!l) return null
            return (
              <text
                key={`l-${r.key}`}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
                className={`pointer-events-none text-[11px] ${selected === r.key ? 'fill-amber' : 'fill-ink-2'}`}
                style={{ opacity: selected !== null && selected !== r.key ? 0.4 : 1 }}
              >
                {r.label}
              </text>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
