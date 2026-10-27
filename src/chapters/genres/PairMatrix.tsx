import type { GenrePair } from '../../../shared/app-types.ts'
import { fmtRating, signed } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { deltaColor } from '../dna/scales.ts'
import { onActivate, useWidth } from '../../lib/useSize.ts'

/**
 * Genre overlap matrix. Cell colour = shrunk joint-tag mean minus your average, faded for small
 * samples; cells with <3 films are left empty. Pair-specific saturation at 0.35 keeps smaller lifts
 * visible. A small "n" in each cell is the non-colour encoding of sample size.
 */
export function PairMatrix({
  genres,
  pairs,
  selected,
  onSelect,
}: {
  genres: string[]
  pairs: GenrePair[]
  selected: GenrePair | null
  onSelect: (p: GenrePair) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>(640)
  const tip = useTooltip()
  const labelW = Math.max(100, Math.min(118, width * 0.24))
  const n = genres.length
  const cell = Math.max(18, Math.min(44, (width - labelW - 70) / Math.max(n - 1, 1)))
  const height = (n - 1) * cell + 92
  const byKey = new Map(pairs.map((p) => [[p.a, p.b].sort().join('|'), p]))
  const showN = cell >= 30

  return (
    <div ref={ref} className="w-full overflow-x-auto scroll-thin">
      <svg width={labelW + (n - 1) * cell + 70} height={height} role="grid" aria-label="Genre overlap matrix">
        {genres.slice(1).map((row, i) => (
          <g key={row} role="row" transform={`translate(0,${i * cell})`}>
            <text x={labelW - 8} y={cell / 2 + 4} textAnchor="end" className="fill-ink-2 text-[11px]">
              {row}
            </text>
            {genres.slice(0, i + 1).map((col, j) => {
              const p = byKey.get([row, col].sort().join('|'))
              const sel = selected && p && selected.a === p.a && selected.b === p.b
              const cx = labelW + j * cell
              if (!p)
                return <rect key={col} role="gridcell" aria-label={`${row} and ${col}: fewer than 3 films`} x={cx + 1} y={1} width={cell - 2} height={cell - 2} fill="#141210" stroke="#1e1b18" />
              const select = () => onSelect(p)
              return (
                <g
                  key={col}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={`${p.a} and ${p.b}: ${p.n} films, average ${fmtRating(p.mean)}, ${signed(p.synergy)} stars vs your average`}
                  onClick={select}
                  onKeyDown={onActivate(select)}
                  onMouseMove={(e) =>
                    tip.show(
                      <div className="space-y-1">
                        <div className="font-medium">
                          {p.a} × {p.b}
                        </div>
                        <div className="num">
                          {p.n} films · {fmtRating(p.mean)} raw · {fmtRating(p.shrunk)} shrunk
                        </div>
                        <div className="num">{signed(p.synergy)}★ vs your average</div>
                      </div>,
                      e,
                    )
                  }
                  onMouseLeave={tip.hide}
                  className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-amber"
                >
                  <rect x={cx + 1} y={1} width={cell - 2} height={cell - 2} rx={2} fill={deltaColor(p.synergy, 0.35)} fillOpacity={(0.25 + Math.min(0.75, Math.abs(p.synergy) * 3)) * (0.35 + 0.65 * Math.min(1, p.n / 12))} stroke={sel ? '#efe8dc' : 'transparent'} strokeWidth={2} />
                  {showN && (
                    <text x={cx + cell / 2} y={cell / 2 + 4} textAnchor="middle" className="pointer-events-none fill-ink text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {p.n}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
        {genres.slice(0, -1).map((col, j) => (
          <text
            key={col}
            transform={`translate(${labelW + j * cell + cell / 2 + 4},${(n - 1) * cell + 8}) rotate(45)`}
            className="fill-ink-2 text-[11px]"
          >
            {col}
          </text>
        ))}
      </svg>
    </div>
  )
}
