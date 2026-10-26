import { timeDays, timeMonths, timeWeek } from 'd3'
import { useMemo } from 'react'
import type { AppViewing } from '../../../shared/app-types.ts'
import { useData } from '../../lib/data.tsx'
import { fmtDate, fmtStars, heat } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

const DOW = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** GitHub-style calendar of dated diary viewings for one year. */
export function Calendar({
  year,
  viewings,
  selected,
  onSelect,
}: {
  year: number
  viewings: AppViewing[]
  selected: string | null
  onSelect: (day: string | null) => void
}) {
  const { film } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth<HTMLDivElement>()

  const byDay = useMemo(() => {
    const m = new Map<string, AppViewing[]>()
    for (const v of viewings) if (v.date?.startsWith(String(year))) m.set(v.date, [...(m.get(v.date) ?? []), v])
    return m
  }, [viewings, year])
  const max = Math.max(1, ...[...byDay.values()].map((v) => v.length))

  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  const days = timeDays(start, end)
  const left = 30
  const top = 18
  const cell = Math.max(8, Math.min(21, Math.floor((width - left) / 54)))
  const gap = 2
  const weekIndex = (d: Date) => timeWeek.count(timeWeek.floor(start), d)
  const svgW = left + 54 * cell
  const svgH = top + 7 * cell + 4

  return (
    <div ref={ref} className="w-full overflow-x-auto scroll-thin">
      <svg width={svgW} height={svgH} role="group" aria-label={`Diary viewings per day in ${year}`}>
        {timeMonths(start, end).map((m) => (
          <text key={m.getMonth()} x={left + weekIndex(m) * cell} y={11} className="fill-muted text-[10px]">
            {m.toLocaleDateString('en-CA', { month: 'short' })}
          </text>
        ))}
        {DOW.map((d, i) => (
          <text key={i} x={0} y={top + i * cell + cell - 3} className="fill-faint text-[9px]">
            {d}
          </text>
        ))}
        {days.map((d) => {
          const key = iso(d)
          const vs = byDay.get(key) ?? []
          const x = left + weekIndex(d) * cell
          const y = top + d.getDay() * cell
          const label = `${fmtDate(key)}: ${vs.length} ${vs.length === 1 ? 'viewing' : 'viewings'}`
          const interactive = vs.length > 0
          return (
            <rect
              key={key}
              x={x}
              y={y}
              width={cell - gap}
              height={cell - gap}
              rx={2}
              fill={heat(vs.length ? 0.25 + (0.75 * vs.length) / max : 0)}
              stroke={selected === key ? '#efe8dc' : 'none'}
              strokeWidth={selected === key ? 1.5 : 0}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : undefined}
              aria-label={interactive ? label : undefined}
              aria-pressed={interactive ? selected === key : undefined}
              className={interactive ? 'cursor-pointer outline-none focus-visible:stroke-amber' : ''}
              onMouseMove={(e) =>
                tip.show(
                  <div>
                    <div className="mb-1 text-muted">{fmtDate(key, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    {vs.length ? (
                      vs.map((v) => (
                        <div key={v.id} className="flex justify-between gap-4">
                          <span>
                            {film(v.filmId)?.title}
                            {v.rewatch ? ' ↻' : ''}
                          </span>
                          <span className="num text-ink-2">{fmtStars(v.rating)}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted">nothing logged</span>
                    )}
                  </div>,
                  e,
                )
              }
              onMouseLeave={tip.hide}
              onClick={() => interactive && onSelect(selected === key ? null : key)}
              onKeyDown={(e) => {
                if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onSelect(selected === key ? null : key)
                }
              }}
            />
          )
        })}
      </svg>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted" aria-hidden>
        <span>Fewer</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: heat(t) }} />
        ))}
        <span>More ({max} max in a day)</span>
      </div>
    </div>
  )
}
