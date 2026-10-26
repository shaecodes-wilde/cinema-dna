import { useMemo, useState } from 'react'
import type { AffinityRow } from '../../shared/app-types.ts'
import { useData } from '../lib/data.tsx'
import { fmtRating, signed } from '../lib/format.ts'
import { InsightCard } from '../ui/InsightCard.tsx'
import { Chapter, ConfidenceBadge, FilmChips, InfoTip, Reveal, Segmented } from '../ui/primitives.tsx'
import { AffinityBars, kindLabel } from './dna/AffinityBars.tsx'
import { Radar } from './dna/Radar.tsx'
import { deltaColor } from './dna/scales.ts'

const INFLUENCE_KINDS = ['genre', 'subgenre', 'director', 'writer', 'cinematographer', 'composer', 'region', 'prestige'] as const
const MIN_N: Record<string, number> = { genre: 5, subgenre: 4, region: 5, prestige: 5, director: 2, writer: 2, cinematographer: 2, composer: 3 }

/** 02 — Taste DNA: a two-layer radar (exposure vs. rating lift) plus the strongest influences. */
export function Dna() {
  const { data } = useData()
  const dims = data.dna
  const [selected, setSelected] = useState<string>(() => [...dims].filter((d) => d.affinity !== null).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))[0]?.id ?? dims[0]?.id)
  const dim = dims.find((d) => d.id === selected) ?? dims[0]
  const [direction, setDirection] = useState<'pull' | 'drag'>('pull')
  const [row, setRow] = useState<AffinityRow | null>(null)

  const influences = useMemo(() => {
    const rows = INFLUENCE_KINDS.flatMap((k) => (data.affinities[k] ?? []).filter((r) => r.n >= (MIN_N[k] ?? 3) && r.key !== 'No major-award recognition'))
    return direction === 'pull'
      ? rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 14)
      : rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 14)
  }, [data.affinities, direction])

  const cards = data.insights.filter((i) => ['formula', 'intersection', 'hidden-favourite', 'underrated-corner'].includes(i.category))
  const loved = [...dims].filter((d) => d.affinity !== null).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))

  return (
    <Chapter
      id="dna"
      number="02"
      title="Your Taste DNA"
      kicker="The fingerprint"
      intro={
        <>
          Twelve measurable traits. The pale shape is <em>what you watch</em> — how much of your viewing carries each trait. The coloured dots on the outer ring are{' '}
          <em>what you love</em>: how far films with that trait lift (amber) or sink (blue) your rating against your own {fmtRating(data.totals.meanRating)} average.
          {loved[0] && (
            <>
              {' '}
              The biggest gap between habit and love: <span className="text-ink">{loved[0].name.toLowerCase()}</span> is only {loved[0].score}% of your viewing but
              lifts your rating {signed(loved[0].affinity)}★.
            </>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <Reveal>
          <div className="panel p-4 md:p-6">
            <Radar dims={dims} selected={selected} onSelect={setSelected} />
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t hairline pt-4 text-[12px] text-ink-2">
              <span className="flex items-center gap-2">
                <svg width="22" height="12" aria-hidden>
                  <rect x="1" y="1" width="20" height="10" fill="rgba(239,232,220,0.08)" stroke="#c9c1b4" strokeWidth="2" />
                </svg>
                Exposure (0–100)
              </span>
              <span className="flex items-center gap-2">
                <svg width="12" height="12" aria-hidden>
                  <circle cx="6" cy="6" r="5" fill={deltaColor(0.4)} />
                </svg>
                Lifts your rating (outward)
              </span>
              <span className="flex items-center gap-2">
                <svg width="12" height="12" aria-hidden>
                  <circle cx="6" cy="6" r="5" fill={deltaColor(-0.4)} />
                </svg>
                Lowers it (inward)
              </span>
              <span className="text-muted">
                Ring = your average
                <InfoTip>
                  Rating lift is the shrunk average of films with the trait minus your overall mean. Shrinkage pulls small groups toward your mean so a handful of films can't
                  dominate. Dimensions without a lift (e.g. Generosity) describe behaviour rather than a film trait.
                </InfoTip>
              </span>
            </div>
          </div>
        </Reveal>

        {dim && (
          <Reveal delay={0.1}>
            <article className="panel space-y-5 p-6" aria-live="polite">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="label mb-2">Dimension</div>
                  <h3 className="display text-4xl leading-none">{dim.name}</h3>
                </div>
                <div className="text-right">
                  <div className="num text-5xl leading-none text-ink">{dim.score}</div>
                  <div className="label mt-1">/ 100</div>
                </div>
              </div>
              <p className="text-lg leading-snug text-ink">{dim.headline}.</p>
              <p className="text-[14px] leading-relaxed text-ink-2">{dim.definition}</p>
              <div className="flex flex-wrap items-center gap-2">
                <ConfidenceBadge level={dim.confidence} n={dim.n} evidence={dim.evidence} />
                {dim.affinity !== null && (
                  <span className="num rounded-full border border-line-2 px-2.5 py-0.5 text-[12px]" style={{ color: deltaColor(dim.affinity) }}>
                    {signed(dim.affinity)}★ lift
                  </span>
                )}
              </div>
              <div className="num text-[13px] text-muted">{dim.value}</div>
              {dim.stats.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  {dim.stats.map((s) => (
                    <div key={s.label} className="flex items-baseline justify-between gap-3 border-b hairline py-1.5 text-[13px]" title={s.hint}>
                      <dt className="truncate text-muted">{s.label}</dt>
                      <dd className="num shrink-0">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {dim.filmIds.length > 0 && (
                <div>
                  <div className="label mb-2">Evidence</div>
                  <FilmChips ids={dim.filmIds} max={8} />
                </div>
              )}
            </article>
          </Reveal>
        )}
      </div>

      {/* Dimension index */}
      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Choose a dimension">
        {dims.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={selected === d.id}
            onClick={() => setSelected(d.id)}
            className={`group rounded-[3px] border p-3 text-left transition ${selected === d.id ? 'border-amber/70 bg-night-3' : 'border-line bg-night-2 hover:border-line-2'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12px] text-ink-2">{d.name}</span>
              <span className="num text-[13px] text-ink">{d.score}</span>
            </div>
            <div className="mt-2 h-[3px] w-full rounded-full bg-line">
              <div className="h-full rounded-full bg-ink-2" style={{ width: `${d.score}%` }} />
            </div>
            <div className="num mt-1.5 text-[11px]" style={{ color: d.affinity === null ? '#5d5850' : deltaColor(d.affinity) }}>
              {d.affinity === null ? 'behaviour' : `${signed(d.affinity)}★`}
            </div>
          </button>
        ))}
      </div>

      {/* Strongest influences */}
      <div className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label mb-2">Strongest influences</div>
              <h3 className="display text-4xl">{direction === 'pull' ? 'What pulls your stars up' : 'What drags them down'}</h3>
            </div>
            <Segmented
              label="Direction"
              value={direction}
              onChange={(v) => {
                setDirection(v)
                setRow(null)
              }}
              options={[
                { value: 'pull', label: 'Lifts' },
                { value: 'drag', label: 'Drags' },
              ]}
            />
          </div>
          <p className="mb-4 max-w-2xl text-[13px] text-muted">
            Genres, people, regions and awards, ranked by shrunk rating lift. Dot = estimate (bigger = more confident); line = 90% interval
            <InfoTip>
              The interval is the range the true lift plausibly sits in given how many films you've seen. If it crosses the "you" line, the evidence for a real effect is weak.
            </InfoTip>
            . Minimum sample: 5 films for genres/regions/awards, 2 for people. Click a row for its films.
          </p>
          <div className="panel p-4">
            <AffinityBars rows={influences} baseline={data.totals.meanRating} onSelect={(r) => setRow(r)} selectedKey={row ? `${row.kind}:${row.key}` : null} />
          </div>
        </div>
        <div className="lg:pt-24">
          {row ? (
            <div className="panel space-y-4 p-6" aria-live="polite">
              <div className="label">{kindLabel(row.kind)}</div>
              <h4 className="display text-3xl">{row.label}</h4>
              <div className="num text-[13px] text-ink-2">
                {row.n} films · raw {fmtRating(row.mean)} · shrunk {fmtRating(row.shrunk)} · {signed(row.delta)}★ vs you · SD {row.sd.toFixed(2)}
              </div>
              <ConfidenceBadge level={row.confidence} n={row.n} />
              <FilmChips ids={row.filmIds} max={12} />
            </div>
          ) : (
            <div className="rounded-[3px] border border-dashed border-line-2 p-6 text-[14px] text-muted">Select a row to see the films behind it.</div>
          )}
        </div>
      </div>

      {cards.length > 0 && (
        <div className="mt-20">
          <div className="label mb-5">Patterns behind the fingerprint</div>
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((i, k) => (
              <Reveal key={i.id} delay={(k % 2) * 0.06}>
                <InsightCard insight={i} />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </Chapter>
  )
}
