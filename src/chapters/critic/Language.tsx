import { scaleLinear } from 'd3'
import { useMemo, useState } from 'react'
import { useData } from '../../lib/data.tsx'
import { COOL, WARM, fmtRating, pct, signed } from '../../lib/format.ts'
import { FilmChip, InfoTip, useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

const AXIS = '#2a2724'
const MUTED = '#8d877d'

/** What your reviews talk about, and how the stars move when they do. */
export function LanguageLift() {
  const { data } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth()
  const cats = useMemo(() => [...data.critical.language].sort((a, b) => (b.lift ?? -9) - (a.lift ?? -9)), [data.critical.language])
  const withLift = cats.filter((c) => c.lift !== null)
  const thin = cats.filter((c) => c.lift === null)
  const [selected, setSelected] = useState<string | null>(withLift[0]?.id ?? null)
  const sel = cats.find((c) => c.id === selected)
  const rowH = 30
  const labelW = width < 520 ? 130 : 190
  const m = { t: 22, r: 70, b: 24, l: labelW }
  const h = m.t + withLift.length * rowH + m.b
  const maxAbs = Math.max(0.3, ...withLift.map((c) => Math.abs(c.lift!)))
  const x = scaleLinear().domain([-maxAbs, maxAbs]).range([m.l, width - m.r]).nice()

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div ref={ref}>
        <svg width={width} height={h} role="img" aria-label="Rating lift when a review mentions each theme">
          {x.ticks(5).map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.t - 6} y2={h - m.b} stroke={t === 0 ? '#5d5850' : AXIS} />
              <text x={x(t)} y={h - m.b + 16} textAnchor="middle" fontSize={10} fill={MUTED} className="num">
                {signed(t, 1)}★
              </text>
            </g>
          ))}
          {withLift.map((c, i) => {
            const cy = m.t + i * rowH + rowH / 2
            const x0 = x(0)
            const x1 = x(c.lift!)
            const active = c.id === selected
            return (
              <g
                key={c.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={`${c.label}: mentioned in ${c.reviews} reviews; films average ${c.meanWhenMentioned} when mentioned vs ${c.meanOtherwise} otherwise. Show examples`}
                className="cursor-pointer outline-none"
                onClick={() => setSelected(c.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(c.id)}
                onMouseMove={(e) =>
                  tip.show(
                    <span className="num text-[12px]">
                      {c.label}
                      <br />
                      {c.reviews} reviews ({pct(c.share)}) · {fmtRating(c.meanWhenMentioned)} vs {fmtRating(c.meanOtherwise)}
                    </span>,
                    e,
                  )
                }
                onMouseLeave={tip.hide}
              >
                <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill={active ? '#1e1b18' : 'transparent'} />
                <text x={m.l - 10} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill={active ? '#efe8dc' : '#c9c1b4'}>
                  {c.label}
                </text>
                <rect
                  x={Math.min(x0, x1)}
                  y={cy - 6}
                  width={Math.max(2, Math.abs(x1 - x0))}
                  height={12}
                  rx={3}
                  fill={c.lift! >= 0 ? WARM : COOL}
                  fillOpacity={c.reviews < 10 ? 0.45 : 0.9}
                />
                <text x={width - m.r + 8} y={cy} dy="0.32em" fontSize={11} fill="#c9c1b4" className="num">
                  {signed(c.lift)} <tspan fill={MUTED}>n={c.reviews}</tspan>
                </text>
              </g>
            )
          })}
        </svg>
        <p className="mt-2 text-[12px] text-muted">
          Lift = average rating of reviews mentioning the theme minus the average of those that don't. Faded bars: fewer than 10 reviews.
          {thin.length > 0 && ` Too rare to measure: ${thin.map((c) => `${c.label.toLowerCase()} (${c.reviews})`).join(', ')}.`}
        </p>
      </div>
      <div className="panel p-5">
        {sel ? (
          <>
            <div className="label mb-1">In your words · {sel.label}</div>
            <p className="mb-4 text-[12px] text-muted">
              Matched terms: {sel.terms.slice(0, 10).map((t) => t.replace('*', '…')).join(', ')}
              {sel.terms.length > 10 ? '…' : ''}
            </p>
            <ul className="space-y-4">
              {sel.examples.map((ex, i) => (
                <li key={i}>
                  <p className="display text-[21px] leading-snug">“{ex.snippet}”</p>
                  <div className="mt-1.5">
                    <FilmChip id={ex.filmId} />
                  </div>
                </li>
              ))}
              {sel.examples.length === 0 && <li className="text-sm text-muted">No examples.</li>}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">Select a theme.</p>
        )}
      </div>
    </div>
  )
}

/** Words that separate your ≥4★ reviews from your ≤3★ reviews. */
export function DistinctiveWords() {
  const { data } = useData()
  const { high, low } = data.critical.distinctiveWords
  const max = Math.max(...high.map((w) => w.score), ...low.map((w) => -w.score), 1)
  const col = (title: string, words: typeof high, color: string, sign: 1 | -1) => (
    <div>
      <div className="label mb-3">{title}</div>
      <ul className="space-y-1.5">
        {words.slice(0, 12).map((w) => (
          <li key={w.word} className="grid grid-cols-[96px_1fr_44px] items-center gap-3 text-[13px]" title={`log-odds z = ${w.score}; appears in ${w.count} reviews of this group`}>
            <span className="truncate text-ink">{w.word}</span>
            <span className="h-2 rounded-full" style={{ width: `${((sign * w.score) / max) * 100}%`, background: color, opacity: 0.85 }} />
            <span className="num text-right text-[11px] text-muted">×{w.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        {col('Your 4★+ vocabulary', high, WARM, 1)}
        {col('Your 3★-and-under vocabulary', low, COOL, -1)}
      </div>
      <p className="mt-4 text-[12px] text-muted">
        Ranked by a smoothed log-odds z-score
        <InfoTip>
          For each word, the log-odds of appearing in a high-rated review versus a low-rated one, with a small prior so rare words don't dominate (Monroe et al., 2008). Bars show the strength of the
          association; ×n is how many reviews in that group use the word.
        </InfoTip>
      </p>
    </div>
  )
}
