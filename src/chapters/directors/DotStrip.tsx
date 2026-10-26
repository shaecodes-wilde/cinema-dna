import { scaleLinear } from 'd3'
import { useData } from '../../lib/data.tsx'
import { fmtStars, ratingColor } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { GRID } from '../dna/scales.ts'
import { onActivate, useWidth } from '../../lib/useSize.ts'

/** One person's films as dots on the 0.5–5★ scale; ties stack upward. Dots open the film. */
export function DotStrip({ filmIds, label }: { filmIds: string[]; label: string }) {
  const { film, openFilm, data } = useData()
  const tip = useTooltip()
  const [ref, width] = useWidth<HTMLDivElement>(280)
  const films = filmIds.map(film).filter((f) => f && f.rating !== null)
  const stacks = new Map<number, number>()
  const pts = films.map((f) => {
    const k = stacks.get(f!.rating!) ?? 0
    stacks.set(f!.rating!, k + 1)
    return { f: f!, k }
  })
  const maxStack = Math.max(1, ...stacks.values())
  const r = 5
  const h = 22 + Math.min(maxStack, 6) * (r * 2 + 2)
  const x = scaleLinear().domain([0.5, 5]).range([r + 2, width - r - 2])
  const mean = data.totals.meanRating
  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={h} role="group" aria-label={`${label}: ratings of ${films.length} films`}>
        <line x1={x(0.5)} x2={x(5)} y1={h - 16} y2={h - 16} stroke={GRID} />
        <line x1={x(mean)} x2={x(mean)} y1={4} y2={h - 12} stroke="#c9c1b4" strokeOpacity={0.45} />
        {[1, 2, 3, 4, 5].map((t) => (
          <text key={t} x={x(t)} y={h - 2} textAnchor="middle" className="fill-faint text-[9px]" style={{ fontFamily: 'var(--font-mono)' }}>
            {t}★
          </text>
        ))}
        {pts.map(({ f, k }) => {
          const open = () => openFilm(f.id)
          return (
            <circle
              key={f.id}
              cx={x(f.rating!)}
              cy={h - 16 - r - 2 - Math.min(k, 5) * (r * 2 + 2)}
              r={r}
              fill={ratingColor(f.rating, mean, data.totals.sdRating)}
              stroke="#161412"
              strokeWidth={2}
              role="button"
              tabIndex={0}
              aria-label={`${f.title}, ${fmtStars(f.rating)}`}
              onClick={open}
              onKeyDown={onActivate(open)}
              onMouseMove={(e) => tip.show(<span>{f.title} {f.year ? `(${f.year})` : ''} · <span className="num">{fmtStars(f.rating)}</span></span>, e)}
              onMouseLeave={tip.hide}
              className="cursor-pointer outline-none transition hover:stroke-ink focus-visible:stroke-amber"
            />
          )
        })}
      </svg>
    </div>
  )
}
