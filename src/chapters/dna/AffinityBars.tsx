import { scaleLinear } from 'd3'
import type { AffinityRow } from '../../../shared/app-types.ts'
import { fmtRating, signed } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { deltaColor, GRID } from './scales.ts'
import { onActivate, useWidth } from '../../lib/useSize.ts'

const KIND_LABEL: Record<string, string> = {
  genre: 'Genre', subgenre: 'Sub-genre', director: 'Director', writer: 'Writer', cinematographer: 'Cinematographer',
  composer: 'Composer', region: 'Region', prestige: 'Awards', cast: 'Cast', decade: 'Decade', runtime: 'Runtime',
  franchise: 'Franchise', country: 'Country', language: 'Language', notability: 'Notability',
}
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k

/**
 * Forest plot of shrunk rating lift: one row per group, dot = shrunk Δ vs. baseline,
 * whisker = 90% interval. Rows are buttons (keyboard + click → onSelect).
 */
export function AffinityBars({
  rows,
  baseline,
  onSelect,
  selectedKey,
  showKind = true,
}: {
  rows: AffinityRow[]
  baseline: number
  onSelect?: (row: AffinityRow) => void
  selectedKey?: string | null
  showKind?: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>(560)
  const tip = useTooltip()
  const labelW = Math.min(240, width * 0.42)
  const statW = 92
  const plotW = Math.max(80, width - labelW - statW - 8)
  const extent = Math.max(0.6, ...rows.flatMap((r) => [Math.abs(r.ci[0] - baseline), Math.abs(r.ci[1] - baseline)]))
  const x = scaleLinear().domain([-extent, extent]).range([0, plotW]).nice()
  const rowH = 30
  const h = rows.length * rowH + 22
  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={h} role="list" aria-label="Rating lift by group with 90% intervals">
        <g transform={`translate(${labelW},0)`}>
          {x.ticks(5).map((t) => (
            <g key={t} transform={`translate(${x(t)},0)`}>
              <line y1={0} y2={h - 18} stroke={GRID} strokeWidth={t === 0 ? 1.5 : 1} />
              <text y={h - 4} textAnchor="middle" className="fill-muted text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
                {t === 0 ? 'you' : `${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(1)}`}
              </text>
            </g>
          ))}
        </g>
        {rows.map((r, i) => {
          const y = i * rowH + rowH / 2
          const lo = r.ci[0] - baseline
          const hi = r.ci[1] - baseline
          const sel = selectedKey === `${r.kind}:${r.key}`
          const select = () => onSelect?.(r)
          return (
            <g
              key={`${r.kind}:${r.key}`}
              role="listitem"
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${kindLabel(r.kind)} ${r.label}: ${r.n} films, shrunk ${signed(r.delta)} stars versus your average, ${r.confidence} confidence`}
              onClick={select}
              onKeyDown={onActivate(select)}
              onMouseMove={(e) =>
                tip.show(
                  <div className="space-y-1">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-muted">{kindLabel(r.kind)} · {r.n} films · {r.confidence} confidence</div>
                    <div className="num">raw {fmtRating(r.mean)} · shrunk {fmtRating(r.shrunk)}</div>
                    <div className="num">90% interval {r.ci[0].toFixed(2)}–{r.ci[1].toFixed(2)}★</div>
                  </div>,
                  e,
                )
              }
              onMouseLeave={tip.hide}
              className={onSelect ? 'cursor-pointer outline-none [&:focus-visible_rect]:stroke-amber' : ''}
            >
              <rect x={0} y={y - rowH / 2 + 1} width={width} height={rowH - 2} rx={2} fill={sel ? '#1e1b18' : 'transparent'} stroke="transparent" strokeWidth={1.5} className="transition-colors hover:fill-[#1a1816]" />
              <text x={0} y={y + 4} className="fill-ink text-[13px]">
                {truncate(r.label, Math.floor(labelW / 7.4) - (showKind ? 0 : 0))}
              </text>
              {showKind && (
                <text x={labelW - 10} y={y + 4} textAnchor="end" className="fill-faint text-[10px] uppercase tracking-wider">
                  {kindLabel(r.kind)}
                </text>
              )}
              <g transform={`translate(${labelW},0)`}>
                <line x1={x(Math.max(-extent, lo))} x2={x(Math.min(extent, hi))} y1={y} y2={y} stroke={deltaColor(r.delta)} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
                <circle cx={x(r.delta)} cy={y} r={r.confidence === 'high' ? 6 : r.confidence === 'medium' ? 5 : 4} fill={deltaColor(r.delta)} stroke="#0f0e0d" strokeWidth={2} />
              </g>
              <text x={width - 4} y={y + 4} textAnchor="end" className="fill-ink-2 text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>
                {signed(r.delta)}★ <tspan className="fill-muted">n{r.n}</tspan>
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
