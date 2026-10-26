import { useState } from 'react'
import type { Insight } from '../../shared/app-types.ts'
import { ConfidenceBadge, FilmChips } from './primitives.tsx'

const CATEGORY_LABEL: Record<Insight['category'], string> = {
  'hidden-favourite': 'Hidden favourite',
  contradiction: 'Contradiction',
  formula: 'Formula',
  disappointment: 'Disappointment',
  evolution: 'Evolution',
  loyalty: 'Loyalty',
  rewatch: 'Rewatching',
  'underrated-corner': 'Underrated corner',
  intersection: 'Intersection',
  watchlist: 'Watchlist',
  generosity: 'Generosity',
  defining: 'Defining films',
  language: 'Review language',
  exception: 'Exceptions',
}

/** Finding → click to reveal the evidence (stats + the films behind it). */
export function InsightCard({ insight, defaultOpen = false, compact = false }: { insight: Insight; defaultOpen?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <article className="panel group flex flex-col p-6 transition hover:border-line-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="label text-amber">{CATEGORY_LABEL[insight.category]}</span>
        <ConfidenceBadge level={insight.confidence} n={insight.n} evidence={compact ? undefined : insight.evidence} speculative={insight.speculative} />
      </div>
      <h3 className="display mb-3 text-[28px] leading-[1.05]">{insight.title}</h3>
      <p className="text-[15px] leading-relaxed text-ink-2">{insight.finding}</p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="mt-5 inline-flex items-center gap-2 self-start text-[12px] uppercase tracking-[0.18em] text-muted transition hover:text-amber"
      >
        <span aria-hidden className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        {open ? 'Hide evidence' : 'Show evidence'}
      </button>
      {open && (
        <div className="mt-5 space-y-5 border-t hairline pt-5">
          <p className="text-[14px] italic leading-relaxed text-ink-2">
            <span className="label not-italic mr-2">Why it matters</span>
            {insight.explanation}
          </p>
          {insight.stats.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {insight.stats.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-3 border-b hairline py-1.5 text-[13px]" title={s.hint}>
                  <dt className="truncate text-muted">{s.label}</dt>
                  <dd className="num shrink-0 text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {insight.filmIds.length > 0 && <FilmChips ids={insight.filmIds} max={10} />}
        </div>
      )}
    </article>
  )
}
