import { scaleLinear, scaleTime } from 'd3'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data.tsx'
import { COOL, fmtDate, fmtStars, NEUTRAL, ratingColor, WARM } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

/**
 * Watch date (x) against release year (y). The diagonal marks "watched in its release year";
 * distance below it is how far back in film history a viewing reached.
 */
export function LagScatter() {
  const { data, film, openFilm } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const { meanRating: mean, sdRating: sd } = data.totals

  const points = useMemo(
    () =>
      data.viewings
        .filter((v) => v.date && (v.quality === 'live' || v.quality === 'delayed'))
        .map((v) => ({ v, f: film(v.filmId)! }))
        .filter((p) => p.f?.year)
        .map((p) => ({ ...p, t: new Date(`${p.v.date}T12:00:00`), year: p.f.year! })),
    [data.viewings, film],
  )
  const h = 340
  const m = { l: 44, r: 16, t: 12, b: 28 }
  const x = scaleTime()
    .domain([Math.min(...points.map((p) => +p.t)), Math.max(...points.map((p) => +p.t))])
    .nice()
    .range([m.l, width - m.r])
  const minYear = Math.min(...points.map((p) => p.year))
  const y = scaleLinear()
    .domain([Math.floor(minYear / 10) * 10, new Date().getFullYear() + 1])
    .range([h - m.b, m.t])
  const [d0, d1] = x.domain()
  const fresh = points.filter((p) => p.t.getFullYear() - p.year <= 1).length

  return (
    <div ref={ref} className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COOL }} />below your average</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NEUTRAL }} />around it</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: WARM }} />above it</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: '#c9c1b4' }} />ring = rewatch</span>
        <span className="text-muted">{fresh} of {points.length} viewings were of a film released that year or the year before</span>
      </div>
      <svg width={width} height={h} role="img" aria-label={`Scatter of ${points.length} dated viewings: watch date against film release year`}>
        {y.ticks(6).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="#2a2724" />
            <text x={m.l - 6} y={y(t) + 3} textAnchor="end" className="num fill-muted text-[10px]">{t}</text>
          </g>
        ))}
        {x.ticks(width < 600 ? 4 : 8).map((t) => (
          <text key={+t} x={x(t)} y={h - 8} textAnchor="middle" className="num fill-muted text-[10px]">
            {t.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' })}
          </text>
        ))}
        <line
          x1={x(d0)}
          y1={y(d0.getFullYear())}
          x2={x(d1)}
          y2={y(d1.getFullYear())}
          stroke="#e0a43a"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        <text x={x(d1) - 4} y={y(d1.getFullYear()) - 6} textAnchor="end" className="fill-ink-2 text-[10px]">
          watched in its release year
        </text>
        <text x={m.l + 4} y={h - m.b - 6} className="fill-muted text-[10px]">
          ↓ older films
        </text>
        {points.map((p) => {
          const c = ratingColor(p.v.rating, mean, sd)
          const on = hover === p.v.id
          return (
            <circle
              key={p.v.id}
              cx={x(p.t)}
              cy={y(p.year)}
              r={on ? 7 : 4.5}
              fill={p.v.rewatch ? 'transparent' : c}
              stroke={p.v.rewatch ? c : '#0f0e0d'}
              strokeWidth={p.v.rewatch ? 2 : 1.5}
              className="cursor-pointer"
              onMouseMove={(e) => {
                setHover(p.v.id)
                tip.show(
                  <div>
                    <div className="font-medium">{p.f.title} <span className="text-muted">({p.year})</span></div>
                    <div className="text-ink-2">Watched {fmtDate(p.v.date)}{p.v.rewatch ? ' · rewatch' : ''}</div>
                    <div className="text-ink-2">{p.t.getFullYear() - p.year <= 0 ? 'Same year as release' : `${p.t.getFullYear() - p.year} years after release`} · {fmtStars(p.v.rating)}</div>
                  </div>,
                  e,
                )
              }}
              onMouseLeave={() => {
                setHover(null)
                tip.hide()
              }}
              onClick={() => openFilm(p.f.id)}
            />
          )
        })}
      </svg>
    </div>
  )
}
