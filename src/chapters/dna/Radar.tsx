import { motion } from 'motion/react'
import type { DnaDimension } from '../../../shared/app-types.ts'
import { useReducedMotion } from '../../lib/data.tsx'
import { signed } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { AXIS_INK, deltaColor, GRID } from './scales.ts'
import { onActivate, useWidth } from '../../lib/useSize.ts'

/**
 * Two-layer fingerprint. Inner polygon = what you watch (score 0–100 on each axis).
 * Outer ring = what you love: a dot per dimension placed outside (+) or inside (−) a zero
 * circle by its rating lift, coloured on the diverging scale and labelled with the value.
 */
export function Radar({ dims, selected, onSelect }: { dims: DnaDimension[]; selected: string | null; onSelect: (id: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>(560)
  const tip = useTooltip()
  const reduced = useReducedMotion()
  // Labels need ~90px of horizontal room on each side; the plot shrinks to make space.
  const narrow = width < 460
  const labelPad = narrow ? 92 : 96
  const R = Math.max(62, Math.min(230, (width / 2 - labelPad) / 1.5))
  const ringZero = R * 1.2
  const ringK = R * 0.28 // px per star of lift
  const labelR = R * 1.48
  const height = Math.round(2 * (labelR + 34))
  const cx = width / 2
  const cy = height / 2
  const n = dims.length
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pt = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r] as const
  const poly = dims.map((d, i) => pt(i, (d.score / 100) * R).join(',')).join(' ')

  return (
    <div ref={ref} className="flex w-full justify-center">
      <svg width={width} height={height} role="group" aria-label="Taste DNA radar: inner shape is exposure, outer dots are rating lift">
        {/* grid */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={dims.map((_, i) => pt(i, R * f).join(',')).join(' ')} fill="none" stroke={GRID} strokeWidth={1} />
        ))}
        {[25, 50, 75, 100].map((v) => (
          <text key={v} x={cx + 3} y={cy - (R * v) / 100 - 3} className="fill-faint text-[9px]" style={{ fontFamily: 'var(--font-mono)' }}>
            {v}
          </text>
        ))}
        <circle cx={cx} cy={cy} r={ringZero} fill="none" stroke="#3a3632" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={ringZero + ringK * 0.5} fill="none" stroke={GRID} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={ringZero - ringK * 0.5} fill="none" stroke={GRID} strokeWidth={1} />
        {dims.map((_, i) => {
          const [x, y] = pt(i, ringZero + ringK * 0.6)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} strokeWidth={1} />
        })}

        {/* exposure polygon */}
        <motion.polygon
          points={poly}
          fill="rgba(239,232,220,0.08)"
          stroke="#c9c1b4"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={reduced ? false : { opacity: 0, scale: 0.2 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
        {dims.map((d, i) => {
          const [x, y] = pt(i, (d.score / 100) * R)
          return <circle key={d.id} cx={x} cy={y} r={selected === d.id ? 5 : 3.5} fill={selected === d.id ? '#e0a43a' : '#efe8dc'} stroke="#0f0e0d" strokeWidth={2} />
        })}

        {/* affinity ring */}
        {dims.map((d, i) => {
          if (d.affinity === null) return null
          const a = Math.max(-0.65, Math.min(0.65, d.affinity))
          const [x0, y0] = pt(i, ringZero)
          const [x, y] = pt(i, ringZero + a * ringK)
          return (
            <motion.g
              key={`a-${d.id}`}
              initial={reduced ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 + i * 0.05, duration: 0.6 }}
            >
              <line x1={x0} y1={y0} x2={x} y2={y} stroke={deltaColor(d.affinity)} strokeWidth={2} strokeLinecap="round" />
              <circle cx={x} cy={y} r={5} fill={deltaColor(d.affinity)} stroke="#0f0e0d" strokeWidth={2} />
            </motion.g>
          )
        })}

        {/* axis labels + hit areas */}
        {dims.map((d, i) => {
          const [lx, ly] = pt(i, labelR)
          const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'
          const a0 = angle(i) - Math.PI / n
          const a1 = angle(i) + Math.PI / n
          const outer = labelR - 18
          const wedge = `M${cx},${cy} L${cx + Math.cos(a0) * outer},${cy + Math.sin(a0) * outer} A${outer},${outer} 0 0 1 ${cx + Math.cos(a1) * outer},${cy + Math.sin(a1) * outer} Z`
          const sel = selected === d.id
          const select = () => onSelect(d.id)
          return (
            <g
              key={`l-${d.id}`}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={`${d.name}: score ${d.score} of 100${d.affinity !== null ? `, rating lift ${signed(d.affinity)} stars` : ''}`}
              onClick={select}
              onKeyDown={onActivate(select)}
              onMouseMove={(e) =>
                tip.show(
                  <div className="space-y-1">
                    <div className="font-medium">{d.name}</div>
                    <div className="num">exposure {d.score}/100</div>
                    <div className="num">{d.affinity === null ? 'no rating-lift measure' : `rating lift ${signed(d.affinity)}★`}</div>
                    <div className="text-muted">{d.headline}</div>
                  </div>,
                  e,
                )
              }
              onMouseLeave={tip.hide}
              className="cursor-pointer outline-none [&:focus-visible>path]:fill-[#e0a43a14]"
            >
              <path d={wedge} fill={sel ? 'rgba(224,164,58,0.035)' : 'transparent'} className="transition-colors hover:fill-[#ffffff08]" />
              <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className={`${narrow ? 'text-[9.5px] tracking-[0.06em]' : 'text-[11px] tracking-[0.12em]'} uppercase ${sel ? 'fill-amber' : 'fill-ink-2'}`}>
                {d.axis}
              </text>
              <text x={lx} y={ly + 14} textAnchor={anchor} dominantBaseline="middle" className={narrow ? 'text-[9.5px]' : 'text-[11px]'} style={{ fontFamily: 'var(--font-mono)' }} fill={AXIS_INK}>
                {d.score}
                {d.affinity !== null ? ` · ${signed(d.affinity, 2)}★` : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
