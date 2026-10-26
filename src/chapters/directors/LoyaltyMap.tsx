import { scaleLinear } from 'd3'
import type { AffinityRow } from '../../../shared/app-types.ts'
import { fmtRating, signed } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { deltaColor, GRID } from '../dna/scales.ts'
import { onActivate, useWidth } from '../../lib/useSize.ts'

/** Loyalty (films watched, x) vs. love (shrunk average, y) for people with 2+ films. */
export function LoyaltyMap({ rows, baseline, selected, onSelect, noun }: { rows: AffinityRow[]; baseline: number; selected: string | null; onSelect: (k: string) => void; noun: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(700)
  const tip = useTooltip()
  const height = 300
  const m = { t: 16, r: 84, b: 40, l: 56 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const maxN = Math.max(3, ...rows.map((r) => r.n))
  const x = scaleLinear().domain([1.5, maxN + 0.5]).range([0, iw])
  const ys = rows.map((r) => r.shrunk)
  const y = scaleLinear().domain([Math.min(baseline - 0.4, ...ys) - 0.05, Math.max(baseline + 0.4, ...ys) + 0.05]).range([ih, 0]).nice()
  // Jitter points sharing an n so they don't overprint (deterministic by rank).
  const byN = new Map<number, AffinityRow[]>()
  rows.forEach((r) => byN.set(r.n, [...(byN.get(r.n) ?? []), r]))
  const jitter = new Map<string, number>()
  for (const [, rs] of byN) rs.sort((a, b) => a.shrunk - b.shrunk).forEach((r, i) => jitter.set(r.key, rs.length > 1 ? ((i % 5) - 2) * Math.min(7, iw / maxN / 8) : 0))
  const labelled = new Set(
    [...rows]
      .sort((a, b) => Math.abs(b.delta) * Math.sqrt(b.n) - Math.abs(a.delta) * Math.sqrt(a.n))
      .slice(0, 8)
      .map((r) => r.key),
  )
  if (selected) labelled.add(selected)
  // Drop labels that would overprint an already-placed one (priority: selected, then strongest).
  const boxes: { x: number; y: number; w: number }[] = []
  const priority = [...rows].sort((a, b) => (a.key === selected ? -1 : b.key === selected ? 1 : Math.abs(b.delta) * Math.sqrt(b.n) - Math.abs(a.delta) * Math.sqrt(a.n)))
  for (const r of priority) {
    if (!labelled.has(r.key)) continue
    const cx = x(r.n) + (jitter.get(r.key) ?? 0)
    const w = r.key.length * 6.4
    const bx = cx > iw - 60 ? cx - 9 - w : cx + 9
    const by = y(r.shrunk)
    if (boxes.some((b) => Math.abs(b.y - by) < 13 && bx < b.x + b.w && bx + w > b.x)) labelled.delete(r.key)
    else boxes.push({ x: bx, y: by, w })
  }
  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="group" aria-label={`${noun}: films watched versus shrunk average rating`}>
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(5).map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x2={iw} stroke={GRID} />
              <text x={-10} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
                {t.toFixed(1)}★
              </text>
            </g>
          ))}
          {x.ticks(Math.min(maxN, 8)).filter((t) => Number.isInteger(t) && t >= 2).map((t) => (
            <text key={t} x={x(t)} y={ih + 18} textAnchor="middle" className="fill-muted text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
              {t}
            </text>
          ))}
          <text x={iw / 2} y={ih + 34} textAnchor="middle" className="fill-muted text-[10px] uppercase tracking-[0.18em]">
            films watched (loyalty) →
          </text>
          <text transform={`translate(-44,${ih / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[10px] uppercase tracking-[0.18em]">
            shrunk avg (love) →
          </text>
          <line x2={iw} y1={y(baseline)} y2={y(baseline)} stroke="#c9c1b4" strokeOpacity={0.5} strokeWidth={1.5} />
          <text x={iw + 8} y={y(baseline) + 4} className="fill-ink-2 text-[10px] uppercase tracking-[0.12em]">
            your avg
          </text>
          {rows.map((r) => {
            const cx = x(r.n) + (jitter.get(r.key) ?? 0)
            const cy = y(r.shrunk)
            const sel = selected === r.key
            const select = () => onSelect(r.key)
            return (
              <g
                key={r.key}
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={`${r.key}: ${r.n} films, shrunk ${fmtRating(r.shrunk)}, ${signed(r.delta)} versus your mean`}
                onClick={select}
                onKeyDown={onActivate(select)}
                onMouseMove={(e) =>
                  tip.show(
                    <div className="space-y-1">
                      <div className="font-medium">{r.key}</div>
                      <div className="num">
                        {r.n} films · raw {fmtRating(r.mean)} · shrunk {fmtRating(r.shrunk)} ({signed(r.delta)}★)
                      </div>
                      <div className="num text-muted">SD {r.sd.toFixed(2)} · {r.confidence} confidence</div>
                    </div>,
                    e,
                  )
                }
                onMouseLeave={tip.hide}
                className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-amber"
                style={{ opacity: selected && !sel ? 0.45 : 1 }}
              >
                <circle cx={cx} cy={cy} r={10} fill="transparent" />
                <circle cx={cx} cy={cy} r={sel ? 7 : 5} fill={deltaColor(r.delta)} stroke={sel ? '#efe8dc' : '#0f0e0d'} strokeWidth={2} />
                {labelled.has(r.key) && (
                  <text x={cx > iw - 60 ? cx - 9 : cx + 9} textAnchor={cx > iw - 60 ? 'end' : 'start'} y={cy + 4} className={`pointer-events-none text-[11px] ${sel ? 'fill-amber' : 'fill-ink-2'}`}>
                    {r.key}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
