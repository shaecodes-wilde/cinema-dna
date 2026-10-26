import { scalePoint } from 'd3'
import { useMemo, useState } from 'react'
import type { AppData, AppFilm } from '../../../shared/app-types.ts'
import { useData } from '../../lib/data.tsx'
import { WARM } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

type Link = AppData['fiveStar']['links'][number]
/** A link is "creative" when it names shared people or a series, not just overlapping genres. */
export const isCreative = (l: Link) => l.reasons.some((r) => !r.includes(' / '))

/** Films on a baseline ordered by release year; arcs connect favourites that share people, series or genres. */
export function ArcDiagram({ films, links, selected, onSelect }: { films: AppFilm[]; links: Link[]; selected: string | null; onSelect: (id: string) => void }) {
  const { film } = useData()
  const tip = useTooltip()
  const [ref, measured] = useWidth<HTMLDivElement>()
  const width = Math.max(measured, 680) // scrolls horizontally on phones
  const [hoverLink, setHoverLink] = useState<number | null>(null)
  const ordered = useMemo(() => [...films].sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.title.localeCompare(b.title)), [films])
  const x = scalePoint<string>().domain(ordered.map((f) => f.id)).range([24, width - 96])
  const base = 210
  const height = base + 120

  return (
    <div ref={ref} className="w-full overflow-x-auto scroll-thin">
      <svg width={width} height={height} role="img" aria-label={`Arc diagram of ${links.length} connections between your top-rated films`}>
        {links.map((l, i) => {
          const xa = x(l.a)!, xb = x(l.b)!
          const r = Math.abs(xb - xa) / 2
          const creative = isCreative(l)
          const touches = selected !== null && (l.a === selected || l.b === selected)
          const active = touches || hoverLink === i
          return (
            <path
              key={i}
              d={`M ${Math.min(xa, xb)} ${base} A ${r} ${Math.min(r, base - 10)} 0 0 1 ${Math.max(xa, xb)} ${base}`}
              fill="none"
              stroke={active ? WARM : creative ? '#c9c1b4' : '#5d5850'}
              strokeOpacity={active ? 1 : selected ? 0.18 : creative ? 0.65 : 0.35}
              strokeWidth={active ? 2.5 : creative ? 2 : 1}
              className="cursor-pointer"
              onMouseMove={(e) => {
                setHoverLink(i)
                tip.show(
                  <div>
                    <div className="font-medium">{film(l.a)?.title} ↔ {film(l.b)?.title}</div>
                    <div className="text-ink-2">{l.reasons.join(' · ')}</div>
                  </div>,
                  e,
                )
              }}
              onMouseLeave={() => {
                setHoverLink(null)
                tip.hide()
              }}
            />
          )
        })}
        <line x1={16} x2={width - 16} y1={base} y2={base} stroke="#2a2724" />
        {ordered.map((f) => {
          const cx = x(f.id)!
          const on = selected === f.id
          return (
            <g
              key={f.id}
              role="button"
              tabIndex={0}
              aria-label={`${f.title} (${f.year}), ${links.filter((l) => l.a === f.id || l.b === f.id).length} connections`}
              aria-pressed={on}
              className="cursor-pointer outline-none"
              onClick={() => onSelect(f.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(f.id)
                }
              }}
            >
              <circle cx={cx} cy={base} r={(f.rating === 5 ? 6 : 4) + (on ? 2 : 0)} fill={WARM} stroke={on ? '#efe8dc' : '#0f0e0d'} strokeWidth={2} />
              <text transform={`translate(${cx + 3},${base + 14}) rotate(50)`} className={`text-[10px] ${on ? 'fill-amber' : 'fill-ink-2'}`}>
                {f.title.length > 22 ? `${f.title.slice(0, 21)}…` : f.title}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
