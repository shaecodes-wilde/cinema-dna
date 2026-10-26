import type { Stat } from '../../../shared/app-types.ts'
import { COOL, WARM } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'

/** Dumbbell chart: share of top-tier films vs ≤3.5★ films carrying each trait. */
export function FormulaChart({ traits, threshold }: { traits: Stat[]; threshold: number }) {
  const tip = useTooltip()
  const rows = traits
    .map((t) => {
      const m = t.value.match(/(\d+)% of top vs (\d+)%/)
      return m ? { label: t.label, top: Number(m[1]) / 100, rest: Number(m[2]) / 100, hint: t.hint } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: WARM }} />rated {threshold}★ or higher</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COOL }} />rated 3.5★ or lower</span>
      </div>
      <ul className="space-y-3" aria-label="Share of films with each trait, top-rated versus the rest">
        {rows.map((r) => {
          const lo = Math.min(r.top, r.rest), hi = Math.max(r.top, r.rest)
          return (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(120px,190px)_1fr_auto] items-center gap-3"
              aria-label={`${r.label}: ${Math.round(r.top * 100)}% of top films vs ${Math.round(r.rest * 100)}% of the rest`}
              onMouseMove={(e) =>
                tip.show(
                  <div>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-ink-2">{Math.round(r.top * 100)}% of your top films vs {Math.round(r.rest * 100)}% of 3.5★-or-lower films</div>
                    {r.hint && <div className="text-muted">{r.hint} (|z| ≥ 2 ≈ a reliable difference)</div>}
                  </div>,
                  e,
                )
              }
              onMouseLeave={tip.hide}
            >
              <span className="text-[13px] text-ink-2">{r.label}</span>
              <span className="relative block h-4" aria-hidden>
                <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <span className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`, background: r.top >= r.rest ? WARM : COOL, opacity: 0.5 }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-night" style={{ left: `${r.rest * 100}%`, background: COOL }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-night" style={{ left: `${r.top * 100}%`, background: WARM }} />
              </span>
              <span className="num w-20 text-right text-[12px] text-ink">
                {Math.round(r.top * 100)}% <span className="text-muted">/ {Math.round(r.rest * 100)}%</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
