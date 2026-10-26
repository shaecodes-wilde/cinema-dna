import { scaleBand, scaleLinear, scaleSqrt } from 'd3'
import { useMemo } from 'react'
import { useData } from '../../lib/data.tsx'
import { COOL, NEUTRAL, WARM, fmtRating, fmtStars, pct, ratingColor } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

const AXIS = '#2a2724'
const TEXT_MUTED = '#8d877d'

/** Parses a star rubric like "5 Stars: masterpiece | 3 Stars: good | 1 Star: skip" from a bio. */
export function parseRubric(bio: string): { from: number; to: number; label: string }[] {
  const out: { from: number; to: number; label: string }[] = []
  const re = /(\d(?:\.5)?)(?:\s*-\s*(\d(?:\.5)?))?\s*Stars?\s*:\s*([^|/\n]+)/gi
  for (const m of bio.matchAll(re)) {
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    out.push({ from: Math.min(a, b), to: Math.max(a, b), label: m[3].trim().replace(/[“”"]/g, '') })
  }
  return out
}

function hashJitter(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

// ─── Rating distribution ────────────────────────────────────────────────

export function RatingHistogram() {
  const { data, setFilter } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth()
  const { distribution } = data.critical
  const { meanRating: mean, medianRating: median, sdRating: sd, ratedFilms } = data.totals
  const rubric = useMemo(() => parseRubric(data.profile.bio), [data.profile.bio])
  const h = 300
  const m = { t: rubric.length ? 54 : 24, r: 12, b: 34, l: 36 }
  const x = scaleBand<number>()
    .domain(distribution.map((d) => d.rating))
    .range([m.l, width - m.r])
    .paddingInner(0.18)
  const y = scaleLinear()
    .domain([0, Math.max(...distribution.map((d) => d.count)) * 1.08])
    .nice()
    .range([h - m.b, m.t])
  // continuous position for a rating (centre of its band, interpolated for means)
  const pos = (r: number) => {
    const lo = Math.floor(r * 2) / 2
    const hi = Math.min(5, lo + 0.5)
    const xl = (x(lo) ?? m.l) + x.bandwidth() / 2
    const xh = (x(hi) ?? xl) + x.bandwidth() / 2
    return xl + ((r - lo) / 0.5) * (xh - xl)
  }

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={h} role="img" aria-label={`Histogram of ${ratedFilms} ratings; mean ${mean.toFixed(2)}, median ${median}`}>
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={AXIS} />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={TEXT_MUTED} className="num">
              {t}
            </text>
          </g>
        ))}
        {rubric.map((r) => {
          const x1 = pos(Math.max(0.5, r.from)) - x.bandwidth() / 2
          const x2 = pos(r.to) + x.bandwidth() / 2
          return (
            <g key={r.label}>
              <line x1={x1} x2={x2} y1={16} y2={16} stroke="#5d5850" strokeWidth={1} />
              <line x1={x1} x2={x1} y1={12} y2={20} stroke="#5d5850" />
              <line x1={x2} x2={x2} y1={12} y2={20} stroke="#5d5850" />
              {/* Labels near the chart edges anchor inward so they never clip on narrow screens. */}
              <text
                x={(x1 + x2) / 2 > width - 70 ? x2 : (x1 + x2) / 2 < 70 ? x1 : (x1 + x2) / 2}
                y={36}
                textAnchor={(x1 + x2) / 2 > width - 70 ? 'end' : (x1 + x2) / 2 < 70 ? 'start' : 'middle'}
                fontSize={11}
                fill="#c9c1b4"
                fontStyle="italic"
              >
                “{r.label}”
              </text>
            </g>
          )
        })}
        {distribution.map((d) => {
          const bx = x(d.rating)!
          const by = y(d.count)
          const label = `${fmtStars(d.rating)}: ${d.count} films (${pct(d.count / ratedFilms, 1)})`
          return (
            <g
              key={d.rating}
              role="button"
              tabIndex={d.count ? 0 : -1}
              aria-label={`${label}. Open films rated at least ${d.rating} stars in the explorer`}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-amber"
              onMouseMove={(e) => tip.show(<span className="num">{label}</span>, e)}
              onMouseLeave={tip.hide}
              onClick={() => d.count && setFilter({ status: 'rated', minRating: d.rating }, { reset: true, scroll: true })}
              onKeyDown={(e) => e.key === 'Enter' && d.count && setFilter({ status: 'rated', minRating: d.rating }, { reset: true, scroll: true })}
            >
              <rect x={bx} y={m.t} width={x.bandwidth()} height={h - m.b - m.t} fill="transparent" />
              <path
                d={roundedTop(bx, by, x.bandwidth(), h - m.b - by, 4)}
                fill={ratingColor(d.rating, mean, sd)}
                stroke="transparent"
                strokeWidth={2}
              />
              <text x={bx + x.bandwidth() / 2} y={h - m.b + 18} textAnchor="middle" fontSize={11} fill={TEXT_MUTED} className="num">
                {fmtStars(d.rating)}
              </text>
              {d.count > 0 && (
                <text x={bx + x.bandwidth() / 2} y={by - 6} textAnchor="middle" fontSize={11} fill="#c9c1b4" className="num">
                  {d.count}
                </text>
              )}
            </g>
          )
        })}
        <line x1={m.l} x2={width - m.r} y1={h - m.b} y2={h - m.b} stroke="#3a3632" />
        {[mean, median].map((v, i) => (
          <line key={i ? 'median' : 'mean'} x1={pos(v)} x2={pos(v)} y1={m.t - 6} y2={h - m.b} stroke="#efe8dc" strokeWidth={1} opacity={0.6} pointerEvents="none" />
        ))}
      </svg>
      <p className="mt-2 text-[12px] text-muted">
        Vertical lines: your mean <span className="num text-ink-2">{mean.toFixed(2)}★</span> and median <span className="num text-ink-2">{median}★</span>.
      </p>
    </div>
  )
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

// ─── Genre strip plot ───────────────────────────────────────────────────

export function GenreStrips() {
  const { data, film, openFilm, setFilter } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth()
  const rows = useMemo(() => (data.affinities.genre ?? []).filter((g) => g.n >= 4).sort((a, b) => b.shrunk - a.shrunk), [data.affinities])
  const { meanRating: mean, sdRating: sd } = data.totals
  const rowH = 30
  const labelW = width < 520 ? 104 : 150
  const m = { t: 26, r: 84, b: 28, l: labelW }
  const h = m.t + rows.length * rowH + m.b
  const x = scaleLinear().domain([0.5, 5]).range([m.l, width - m.r])

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={h} role="img" aria-label="Every rated film plotted by rating within each genre">
        {[1, 2, 3, 4, 5].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.t - 8} y2={h - m.b} stroke={AXIS} />
            <text x={x(t)} y={h - m.b + 18} textAnchor="middle" fontSize={11} fill={TEXT_MUTED} className="num">
              {t}★
            </text>
          </g>
        ))}
        <line x1={x(mean)} x2={x(mean)} y1={m.t - 14} y2={h - m.b} stroke="#efe8dc" strokeOpacity={0.45} />
        <text x={x(mean)} y={m.t - 16} textAnchor="middle" fontSize={10} fill="#c9c1b4" className="num">
          your mean {mean.toFixed(2)}
        </text>
        <text x={width - m.r + 30} y={m.t - 10} fontSize={10} fill={TEXT_MUTED}>
          shrunk
        </text>
        {rows.map((g, i) => {
          const cy = m.t + i * rowH + rowH / 2
          return (
            <g key={g.key}>
              <g
                role="button"
                tabIndex={0}
                aria-label={`${g.key}: ${g.n} films, shrunk average ${g.shrunk.toFixed(2)}. Show films in explorer`}
                className="cursor-pointer outline-none [&:focus-visible>text]:fill-amber"
                onClick={() => setFilter({ genre: g.key, status: 'rated' }, { reset: true, scroll: true })}
                onKeyDown={(e) => e.key === 'Enter' && setFilter({ genre: g.key, status: 'rated' }, { reset: true, scroll: true })}
              >
                <text x={m.l - 12} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill="#c9c1b4" className="hover:fill-amber">
                  {g.key}
                  <tspan fill={TEXT_MUTED} fontSize={10} className="num">
                    {' '}
                    {g.n}
                  </tspan>
                </text>
              </g>
              <line x1={m.l} x2={width - m.r} y1={cy} y2={cy} stroke={AXIS} strokeOpacity={0.5} />
              {g.filmIds.map((id) => {
                const f = film(id)
                if (!f || f.rating === null) return null
                const cx = x(f.rating) + hashJitter(id) * 18
                const yy = cy + hashJitter(id + 'y') * (rowH - 10)
                return (
                  <circle
                    key={id}
                    cx={cx}
                    cy={yy}
                    r={3.2}
                    fill={ratingColor(f.rating, mean, sd)}
                    fillOpacity={0.75}
                    className="cursor-pointer"
                    onMouseMove={(e) => tip.show(<FilmTip title={f.title} year={f.year} extra={`${fmtStars(f.rating)} · ${g.key}`} />, e)}
                    onMouseLeave={tip.hide}
                    onClick={() => openFilm(id)}
                  />
                )
              })}
              <path d={`M${x(g.shrunk)},${cy - 9}L${x(g.shrunk) + 5},${cy}L${x(g.shrunk)},${cy + 9}L${x(g.shrunk) - 5},${cy}Z`} fill={WARM} stroke="#0f0e0d" strokeWidth={2} pointerEvents="none" />
              <text x={width - m.r + 30} y={cy} dy="0.32em" fontSize={11} fill={g.delta >= 0 ? WARM : '#6da7ec'} className="num">
                {g.shrunk.toFixed(2)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="12" aria-hidden>
            <path d="M5,1L9,6L5,11L1,6Z" fill={WARM} />
          </svg>
          shrunk genre average
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COOL }} /> below your mean
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: NEUTRAL }} /> at your mean
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: WARM }} /> above your mean
        </span>
        <span>· one dot per film; a film appears in every genre it carries · click a genre to open its films</span>
      </div>
    </div>
  )
}

export function FilmTip({ title, year, extra }: { title: string; year: number | null; extra?: string }) {
  return (
    <span>
      <span className="display text-[17px]">{title}</span>
      {year && <span className="text-muted"> ({year})</span>}
      {extra && <span className="num mt-0.5 block text-[12px] text-ink-2">{extra}</span>}
    </span>
  )
}

// ─── Director consistency scatter ───────────────────────────────────────

export function DirectorScatter() {
  const { data, setFilter } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth()
  const rows = useMemo(() => (data.affinities.director ?? []).filter((d) => d.n >= 2), [data.affinities])
  const { meanRating: mean, sdRating: sd } = data.totals
  const h = 340
  const m = { t: 18, r: 18, b: 40, l: 44 }
  const maxSd = Math.max(1, ...rows.map((r) => r.sd))
  const x = scaleLinear().domain([Math.min(2.5, ...rows.map((r) => r.mean)) - 0.1, 5]).range([m.l, width - m.r])
  const y = scaleLinear().domain([0, maxSd * 1.05]).range([h - m.b, m.t])
  const rr = scaleSqrt().domain([2, Math.max(3, ...rows.map((r) => r.n))]).range([5, 14])
  const labelled = new Set(
    [...rows]
      .sort((a, b) => b.n - a.n || Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 7)
      .map((r) => r.key),
  )
  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={h} role="img" aria-label="Directors you've watched at least twice: average rating against consistency">
        {x.ticks(5).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.t} y2={h - m.b} stroke={AXIS} />
            <text x={x(t)} y={h - m.b + 16} textAnchor="middle" fontSize={11} fill={TEXT_MUTED} className="num">
              {t}★
            </text>
          </g>
        ))}
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={AXIS} />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={TEXT_MUTED} className="num">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={width - m.r} y={h - 6} textAnchor="end" fontSize={11} fill={TEXT_MUTED}>
          average rating →
        </text>
        <text x={m.l} y={m.t - 4} fontSize={11} fill={TEXT_MUTED}>
          ↑ spread (SD) — higher is more uneven
        </text>
        <line x1={x(mean)} x2={x(mean)} y1={m.t} y2={h - m.b} stroke="#efe8dc" strokeOpacity={0.4} />
        {rows.map((d) => (
          <g
            key={d.key}
            role="button"
            tabIndex={0}
            aria-label={`${d.key}: ${d.n} films, average ${d.mean.toFixed(2)}, spread ${d.sd}. Open in explorer`}
            className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-amber"
            onMouseMove={(e) => tip.show(<FilmTip title={d.key} year={null} extra={`${d.n} films · ${fmtRating(d.mean)} avg · SD ${d.sd} · shrunk ${fmtRating(d.shrunk)}`} />, e)}
            onMouseLeave={tip.hide}
            onClick={() => setFilter({ person: d.key, status: 'all' }, { reset: true, scroll: true })}
            onKeyDown={(e) => e.key === 'Enter' && setFilter({ person: d.key, status: 'all' }, { reset: true, scroll: true })}
          >
            <circle cx={x(d.mean)} cy={y(d.sd)} r={rr(d.n)} fill={ratingColor(d.mean, mean, sd)} fillOpacity={0.8} stroke="#0f0e0d" strokeWidth={2} />
            {labelled.has(d.key) && (
              <text x={x(d.mean) + rr(d.n) + 4} y={y(d.sd)} dy="0.32em" fontSize={11} fill="#c9c1b4" pointerEvents="none">
                {d.key}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-2 text-[12px] text-muted">Circle size = films watched. Bottom-right is the sweet spot: consistently high. Vertical line = your overall mean.</p>
    </div>
  )
}

// ─── Review length vs rating ────────────────────────────────────────────

export function LengthChart() {
  const { data } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth(320)
  const rows = data.critical.lengthVsRating
  const h = 200
  const m = { t: 16, r: 8, b: 30, l: 32 }
  const x = scaleBand<number>()
    .domain(rows.map((r) => r.rating))
    .range([m.l, width - m.r])
    .paddingInner(0.25)
  const y = scaleLinear()
    .domain([0, Math.max(...rows.map((r) => r.meanWords)) * 1.15])
    .nice()
    .range([h - m.b, m.t])
  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={h} role="img" aria-label="Average review length in words by star rating">
        {y.ticks(3).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={AXIS} />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={TEXT_MUTED} className="num">
              {t}
            </text>
          </g>
        ))}
        {rows.map((r) => (
          <g
            key={r.rating}
            tabIndex={0}
            role="img"
            aria-label={`${fmtStars(r.rating)}: ${r.meanWords} words on average across ${r.n} reviews`}
            onMouseMove={(e) => tip.show(<span className="num">{`${fmtStars(r.rating)} · ${r.meanWords} words avg · ${r.n} reviews`}</span>, e)}
            onMouseLeave={tip.hide}
          >
            <path d={roundedTop(x(r.rating)!, y(r.meanWords), x.bandwidth(), h - m.b - y(r.meanWords), 3)} fill="#c9c1b4" fillOpacity={r.n < 5 ? 0.35 : 0.75} />
            <text x={x(r.rating)! + x.bandwidth() / 2} y={h - m.b + 16} textAnchor="middle" fontSize={10} fill={TEXT_MUTED} className="num">
              {fmtStars(r.rating)}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[12px] text-muted">Faded bars: fewer than 5 reviews.</p>
    </div>
  )
}
