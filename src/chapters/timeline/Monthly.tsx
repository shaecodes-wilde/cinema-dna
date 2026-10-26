import { line, scaleBand, scaleLinear } from 'd3'
import { useMemo, useState } from 'react'
import type { AppData } from '../../../shared/app-types.ts'
import { COOL, fmtRating, pct, WARM } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

type Month = AppData['timeline']['months'][number]
const FIRST = '#c98500'
const label = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })

/**
 * Two aligned charts sharing one time axis (never a dual axis):
 * monthly viewings (first watches vs rewatches, stacked) and a 3-month rolling mean rating.
 */
export function Monthly({ months, mean, selected, onSelect }: { months: Month[]; mean: number; selected: string | null; onSelect: (m: string | null) => void }) {
  const tip = useTooltip()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const m = { l: 36, r: 12 }
  const x = scaleBand<string>()
    .domain(months.map((d) => d.month))
    .range([m.l, width - m.r])
    .paddingInner(0.18)
  const barH = 170
  const y = scaleLinear()
    .domain([0, Math.max(1, ...months.map((d) => d.viewings))])
    .nice()
    .range([barH, 8])

  const rolling = useMemo(
    () =>
      months.map((d, i) => {
        const win = months.slice(Math.max(0, i - 2), i + 1).filter((w) => w.meanRating !== null)
        const n = win.reduce((a, w) => a + w.viewings, 0)
        return { month: d.month, value: n ? win.reduce((a, w) => a + w.meanRating! * w.viewings, 0) / n : null, n }
      }),
    [months],
  )
  const lineH = 120
  const ratingVals = rolling.map((r) => r.value).filter((v): v is number => v !== null)
  const y2 = scaleLinear()
    .domain([Math.min(mean - 0.5, ...ratingVals) - 0.05, Math.max(mean + 0.5, ...ratingVals) + 0.05])
    .range([lineH - 6, 8])
  const cx = (mo: string) => (x(mo) ?? 0) + x.bandwidth() / 2
  const path = line<(typeof rolling)[number]>()
    .defined((d) => d.value !== null)
    .x((d) => cx(d.month))
    .y((d) => y2(d.value!))(rolling)
  const yearTicks = months.filter((d) => d.month.endsWith('-01') || d === months[0])
  const active = hover ?? selected

  const tipFor = (d: Month, e: React.MouseEvent) => {
    const r = rolling.find((x) => x.month === d.month)
    tip.show(
      <div className="space-y-0.5">
        <div className="text-muted">{label(d.month)}</div>
        <div className="flex justify-between gap-4"><span>First watches</span><span className="num">{d.viewings - d.rewatches}</span></div>
        <div className="flex justify-between gap-4"><span>Rewatches</span><span className="num">{d.rewatches}</span></div>
        <div className="flex justify-between gap-4"><span>Mean rating</span><span className="num">{fmtRating(d.meanRating)}</span></div>
        <div className="flex justify-between gap-4"><span>3-month rolling</span><span className="num">{fmtRating(r?.value ?? null)}</span></div>
        {d.newReleaseShare !== null && <div className="flex justify-between gap-4"><span>New releases</span><span className="num">{pct(d.newReleaseShare)}</span></div>}
      </div>,
      e,
    )
  }

  return (
    <div ref={ref} className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
        <span className="label">Viewings per month</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: FIRST }} />First watch</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: COOL }} />Rewatch</span>
      </div>
      <svg width={width} height={barH + 22} role="group" aria-label="Monthly viewings, first watches and rewatches">
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#2a2724" />
            <text x={m.l - 6} y={y(t) + 3} textAnchor="end" className="num fill-muted text-[10px]">{t}</text>
          </g>
        ))}
        {months.map((d) => {
          const bx = x(d.month) ?? 0
          const first = d.viewings - d.rewatches
          const dim = active && active !== d.month ? 0.35 : 1
          const fTop = y(first)
          return (
            <g
              key={d.month}
              role="button"
              tabIndex={d.viewings ? 0 : -1}
              aria-label={`${label(d.month)}: ${d.viewings} viewings, ${d.rewatches} rewatches, mean ${fmtRating(d.meanRating)}`}
              aria-pressed={selected === d.month}
              className="cursor-pointer outline-none"
              opacity={dim}
              onMouseMove={(e) => { setHover(d.month); tipFor(d, e) }}
              onMouseLeave={() => { setHover(null); tip.hide() }}
              onClick={() => onSelect(selected === d.month ? null : d.month)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selected === d.month ? null : d.month) } }}
            >
              <rect x={bx - 1} y={0} width={x.bandwidth() + 2} height={barH} fill="transparent" />
              {first > 0 && <rect x={bx} y={fTop} width={x.bandwidth()} height={barH - fTop} rx={Math.min(3, x.bandwidth() / 3)} fill={FIRST} />}
              {d.rewatches > 0 && (
                <rect x={bx} y={y(d.viewings)} width={x.bandwidth()} height={Math.max(1, fTop - y(d.viewings) - 2)} rx={Math.min(3, x.bandwidth() / 3)} fill={COOL} />
              )}
              {selected === d.month && <rect x={bx - 2} y={y(d.viewings) - 4} width={x.bandwidth() + 4} height={barH - y(d.viewings) + 4} fill="none" stroke="#efe8dc" strokeWidth={1} rx={3} />}
            </g>
          )
        })}
        <line x1={m.l} x2={width - m.r} y1={barH} y2={barH} stroke="#3a3632" />
        {yearTicks.map((d) => (
          <text key={d.month} x={x(d.month) ?? 0} y={barH + 16} className="num fill-muted text-[10px]">
            {d.month.slice(0, 4)}
          </text>
        ))}
      </svg>

      <div className="mb-2 mt-6 flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
        <span className="label">Rating, 3-month rolling mean</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: WARM }} />rolling mean</span>
        <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-ink-2" />your all-time {fmtRating(mean)}</span>
      </div>
      <svg width={width} height={lineH + 6} role="img" aria-label="Three-month rolling mean rating over time">
        {y2.ticks(4).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y2(t)} y2={y2(t)} stroke="#2a2724" />
            <text x={m.l - 6} y={y2(t) + 3} textAnchor="end" className="num fill-muted text-[10px]">{t.toFixed(1)}</text>
          </g>
        ))}
        <line x1={m.l} x2={width - m.r} y1={y2(mean)} y2={y2(mean)} stroke="#c9c1b4" strokeOpacity={0.5} />
        {path && <path d={path} fill="none" stroke={WARM} strokeWidth={2} />}
        {rolling.map((r) =>
          r.value === null ? null : (
            <circle key={r.month} cx={cx(r.month)} cy={y2(r.value)} r={active === r.month ? 4 : 0} fill={WARM} stroke="#0f0e0d" strokeWidth={2} />
          ),
        )}
        {months.map((d) => (
          <rect
            key={d.month}
            x={x(d.month)}
            y={0}
            width={x.bandwidth() + x.step() * 0.18}
            height={lineH}
            fill="transparent"
            onMouseMove={(e) => { setHover(d.month); tipFor(d, e) }}
            onMouseLeave={() => { setHover(null); tip.hide() }}
            onClick={() => onSelect(selected === d.month ? null : d.month)}
          />
        ))}
        {active && <line x1={cx(active)} x2={cx(active)} y1={4} y2={lineH} stroke="#5d5850" pointerEvents="none" />}
      </svg>
    </div>
  )
}
