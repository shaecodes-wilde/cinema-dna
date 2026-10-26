import { scaleLinear } from 'd3'
import { useMemo } from 'react'
import { useData } from '../../lib/data.tsx'
import { COOL, WARM, fmtDate, fmtStars, ratingColor, signed } from '../../lib/format.ts'
import { InfoTip, useTooltip } from '../../ui/primitives.tsx'
import { FilmTip } from './Charts.tsx'
import { useWidth } from '../../lib/useSize.ts'

const AXIS = '#2a2724'
const MUTED = '#8d877d'

/** Dumbbell: what the taste model predicted (hollow) vs what you gave (filled). */
export function ExceptionsDumbbell({ ids, title }: { ids: string[]; title: string }) {
  const { film, openFilm, data } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth(400)
  const rows = ids.map(film).filter((f) => f && f.rating !== null && f.predicted !== null)
  const rowH = 28
  const labelW = Math.min(190, width * 0.42)
  const m = { t: 20, r: 16, b: 22, l: labelW }
  const h = m.t + rows.length * rowH + m.b
  const x = scaleLinear().domain([0.5, 5]).range([m.l, width - m.r])
  return (
    <div ref={ref}>
      <div className="label mb-2">{title}</div>
      <svg width={width} height={h} role="img" aria-label={title}>
        {[1, 2, 3, 4, 5].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.t - 6} y2={h - m.b} stroke={AXIS} />
            <text x={x(t)} y={h - m.b + 14} textAnchor="middle" fontSize={10} fill={MUTED} className="num">
              {t}★
            </text>
          </g>
        ))}
        {rows.map((f, i) => {
          const cy = m.t + i * rowH + rowH / 2
          const gap = f!.rating! - f!.predicted!
          return (
            <g
              key={f!.id}
              role="button"
              tabIndex={0}
              aria-label={`${f!.title}: you rated ${f!.rating}, model predicted ${f!.predicted}`}
              className="cursor-pointer outline-none [&:focus-visible>text]:fill-amber"
              onClick={() => openFilm(f!.id)}
              onKeyDown={(e) => e.key === 'Enter' && openFilm(f!.id)}
              onMouseMove={(e) => tip.show(<FilmTip title={f!.title} year={f!.year} extra={`you ${fmtStars(f!.rating)} · predicted ${f!.predicted!.toFixed(2)} · ${signed(gap, 1)}★`} />, e)}
              onMouseLeave={tip.hide}
            >
              <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="transparent" />
              <text x={m.l - 10} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill="#c9c1b4">
                {f!.title.length > 26 ? f!.title.slice(0, 25) + '…' : f!.title}
              </text>
              <line x1={x(f!.predicted!)} x2={x(f!.rating!)} y1={cy} y2={cy} stroke={gap >= 0 ? WARM : COOL} strokeWidth={2} strokeOpacity={0.6} />
              <circle cx={x(f!.predicted!)} cy={cy} r={4.5} fill="#0f0e0d" stroke="#c9c1b4" strokeWidth={1.5} />
              <circle cx={x(f!.rating!)} cy={cy} r={5.5} fill={ratingColor(f!.rating, data.totals.meanRating, data.totals.sdRating)} stroke="#0f0e0d" strokeWidth={2} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Rating revisions without a new viewing, and rating drift across diary rewatches. */
export function RatingMotion() {
  const { data, film, openFilm } = useData()
  const revisions = data.critical.revisions
  const drift = useMemo(
    () =>
      data.films
        .map((f) => {
          const diary = f.ratingHistory.filter((h) => h.source === 'diary').sort((a, b) => a.date.localeCompare(b.date))
          return diary.length >= 2 ? { f, first: diary[0].rating, last: diary.at(-1)!.rating, n: diary.length } : null
        })
        .filter((x): x is NonNullable<typeof x> => !!x && x.first !== x.last)
        .sort((a, b) => b.last - b.first - (a.last - a.first)),
    [data.films],
  )
  const Row = ({ id, from, to, note }: { id: string; from: number; to: number; note: string }) => {
    const f = film(id)
    if (!f) return null
    const up = to > from
    return (
      <li>
        <button type="button" onClick={() => openFilm(id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b hairline py-2 text-left text-[13px] transition hover:bg-night-3">
          <span className="truncate">
            <span className="text-ink">{f.title}</span> <span className="text-muted">· {note}</span>
          </span>
          <span className="num whitespace-nowrap">
            <span className="text-muted">{fmtStars(from)}</span>
            <span className="mx-1.5" style={{ color: up ? WARM : COOL }} aria-label={up ? 'raised to' : 'lowered to'}>
              {up ? '↗' : '↘'}
            </span>
            <span style={{ color: up ? WARM : '#6da7ec' }}>{fmtStars(to)}</span>
          </span>
        </button>
      </li>
    )
  }
  const ups = drift.filter((d) => d.last > d.first).length
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="label mb-1">
          On a rewatch
          <InfoTip>Films with two or more rated diary entries whose first and latest diary ratings differ.</InfoTip>
        </div>
        <p className="mb-3 text-[13px] text-ink-2">
          {ups} up, {drift.length - ups} down across {drift.length} films whose rating changed between diary entries.
        </p>
        <ul>
          {drift.map((d) => (
            <Row key={d.f.id} id={d.f.id} from={d.first} to={d.last} note={`${d.n} entries`} />
          ))}
        </ul>
      </div>
      <div>
        <div className="label mb-1">
          On reflection
          <InfoTip>Your current rating differs from your most recent diary rating, with no new viewing logged — you changed your mind later.</InfoTip>
        </div>
        <p className="mb-3 text-[13px] text-ink-2">
          {revisions.length} silent revisions; {revisions.filter((r) => r.to < r.from).length} downward.
        </p>
        <ul>
          {revisions.map((r) => (
            <Row key={r.filmId} id={r.filmId} from={r.from} to={r.to} note={`revised ${fmtDate(r.date)}`} />
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Honest summary of how well metadata predicts your ratings. */
export function ModelPanel() {
  const { data } = useData()
  const m = data.model
  if (!m.available) {
    return (
      <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">
        The taste model needs at least 20 rated films with some variety in your ratings ({m.n} so far), so predictions and the "films the model never saw
        coming" are switched off. Everything else on this page is computed directly from your ratings.
      </p>
    )
  }
  const gain = 1 - m.cvRmse / m.baselineRmse
  const weights = [...m.topPositive.slice(0, 6), ...m.topNegative.slice(0, 6)].sort((a, b) => b.weight - a.weight)
  const max = Math.max(...weights.map((w) => Math.abs(w.weight)))
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-5">
        <p className="text-[15px] leading-relaxed text-ink-2">
          A ridge regression over {m.features} film attributes, fit on {m.n} rated films and scored by 10-fold cross-validation. It predicts your stars{' '}
          {gain > 0.005 ? (
            <>
              <span className="text-ink">{Math.round(gain * 100)}% better</span> than always guessing your average —{' '}
              {gain < 0.15
                ? 'a modest signal, which is the honest answer: most of what makes you love a film is not in its metadata.'
                : 'a strong signal: the attributes of a film genuinely predict how you will rate it.'}
            </>
          ) : (
            <>
              <span className="text-ink">no better</span> than always guessing your average: your ratings aren't predictable from film metadata, so treat predictions as rough.
            </>
          )}
        </p>
        <dl className="grid grid-cols-2 gap-4">
          {[
            ['CV error (RMSE)', `${m.cvRmse.toFixed(2)}★`, 'Typical size of a prediction miss on films the model did not see.'],
            ['Baseline RMSE', `${m.baselineRmse.toFixed(2)}★`, 'Error from always predicting your mean rating.'],
            ['Correlation', `r = ${m.correlation.toFixed(2)}`, 'Correlation between cross-validated predictions and your actual ratings.'],
            ['Mean abs. error', `${m.cvMae.toFixed(2)}★`, 'Average absolute miss, cross-validated.'],
          ].map(([label, value, hint]) => (
            <div key={label} className="border-t hairline pt-3">
              <dt className="label">
                {label}
                <InfoTip>{hint}</InfoTip>
              </dt>
              <dd className="num mt-1 text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <div className="label mb-3">Strongest weights (stars, per attribute, holding the rest fixed)</div>
        <ul className="space-y-1.5">
          {weights.map((w) => (
            <li key={w.feature} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_52px] items-center gap-3 text-[13px]">
              <span className="truncate text-ink-2" title={w.feature}>
                {w.feature}
              </span>
              <span className="relative h-5" aria-hidden>
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
                <span
                  className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                  style={{
                    background: w.weight >= 0 ? WARM : COOL,
                    width: `${(Math.abs(w.weight) / max) * 50}%`,
                    left: w.weight >= 0 ? '50%' : `${50 - (Math.abs(w.weight) / max) * 50}%`,
                  }}
                />
              </span>
              <span className={`num text-right text-[12px] ${w.weight >= 0 ? 'text-amber' : 'text-[#6da7ec]'}`}>{signed(w.weight, 2)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-muted">Weights are associations in your history, not causes. Attributes overlap (long films are often awards films), so read them together.</p>
      </div>
    </div>
  )
}
