import { scaleLinear, select, zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppFilm, Cluster } from '../../../shared/app-types.ts'
import { useData, useReducedMotion } from '../../lib/data.tsx'
import { fmtStars, heat, NEUTRAL, ratingColor, WARM } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'
import { useWidth } from '../../lib/useSize.ts'

export type ColorMode = 'rating' | 'decade' | 'cluster'

export interface StarMapProps {
  films: AppFilm[]
  clusters: Cluster[]
  colorMode: ColorMode
  matches: (f: AppFilm) => boolean
  highlight: (f: AppFilm) => boolean
  selectedCluster: number | null
  onSelectCluster: (id: number | null) => void
}

/** Zoomable SVG map of films positioned by their UMAP coordinates. */
export function StarMap({ films, clusters, colorMode, matches, highlight, selectedCluster, onSelectCluster }: StarMapProps) {
  const { data, openFilm } = useData()
  const tip = useTooltip()
  const reduced = useReducedMotion()
  const [ref, width] = useWidth<HTMLDivElement>()
  const height = Math.min(680, Math.max(380, Math.round(width * 0.62)))
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [hover, setHover] = useState<string | null>(null)
  const pad = 28

  const x = scaleLinear().domain([0, 1]).range([pad, width - pad])
  const y = scaleLinear().domain([0, 1]).range([height - pad, pad])
  const decades = useMemo(() => [...new Set(films.map((f) => f.decade).filter((d): d is number => d !== null))].sort(), [films])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .filter((e: Event) => (e.type === 'wheel' ? (e as WheelEvent).ctrlKey || (e as WheelEvent).metaKey : !(e as MouseEvent).button))
      .on('zoom', (e) => setTransform(e.transform))
    zoomRef.current = z
    select(svg).call(z)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [width, height])

  const zoomBy = (k: number) => {
    if (!svgRef.current || !zoomRef.current) return
    const s = select(svgRef.current)
    ;(reduced ? s : s.transition().duration(450)).call(zoomRef.current.scaleBy as never, k)
  }
  const reset = () => {
    if (!svgRef.current || !zoomRef.current) return
    const s = select(svgRef.current)
    ;(reduced ? s : s.transition().duration(450)).call(zoomRef.current.transform as never, zoomIdentity)
  }

  const colorOf = (f: AppFilm): string => {
    if (colorMode === 'rating') return ratingColor(f.rating, data.totals.meanRating, data.totals.sdRating)
    if (colorMode === 'decade') {
      if (f.decade === null) return '#3a3632'
      return heat(0.15 + (0.85 * decades.indexOf(f.decade)) / Math.max(decades.length - 1, 1))
    }
    return selectedCluster === null ? '#a39d92' : f.constellation!.cluster === selectedCluster ? WARM : NEUTRAL
  }

  // Cluster labels at screen-space centroids, nudged apart vertically.
  const labels = useMemo(() => {
    const raw = clusters.map((c) => {
      const pts = films.filter((f) => f.constellation!.cluster === c.id)
      const cx = pts.reduce((a, f) => a + transform.applyX(x(f.constellation!.x)), 0) / Math.max(pts.length, 1)
      const cy = pts.reduce((a, f) => a + transform.applyY(y(f.constellation!.y)), 0) / Math.max(pts.length, 1)
      const text = c.label
      return { id: c.id, text, x: cx, y: cy, w: text.length * 6.4 + 16, h: 20 }
    })
    raw.sort((a, b) => a.y - b.y)
    for (let iter = 0; iter < 30; iter++) {
      let moved = false
      for (let i = 0; i < raw.length; i++)
        for (let j = i + 1; j < raw.length; j++) {
          const a = raw[i], b = raw[j]
          if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < a.h + 2) {
            const push = (a.h + 2 - Math.abs(a.y - b.y)) / 2 + 0.5
            if (a.y <= b.y) { a.y -= push; b.y += push } else { a.y += push; b.y -= push }
            moved = true
          }
        }
      if (!moved) break
    }
    return raw.map((l) => ({ ...l, x: Math.min(Math.max(l.x, l.w / 2 + 4), width - l.w / 2 - 4), y: Math.min(Math.max(l.y, 14), height - 14) }))
  }, [clusters, films, transform, width, height, x, y])

  const r = 5 / Math.sqrt(transform.k) + 1.5
  const ordered = useMemo(() => [...films].sort((a, b) => Number(matches(a)) - Number(matches(b)) || Number(highlight(a)) - Number(highlight(b))), [films, matches, highlight])

  return (
    <div ref={ref} className="relative w-full">
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        <button type="button" className="chip" aria-label="Zoom in" onClick={() => zoomBy(1.6)}>+</button>
        <button type="button" className="chip" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6)}>−</button>
        <button type="button" className="chip" onClick={reset}>Reset view</button>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block touch-none select-none rounded-[3px] bg-[radial-gradient(ellipse_at_center,#191613_0%,#0f0e0d_70%)]"
        role="img"
        aria-label={`Similarity map of ${films.length} films. Drag to pan; ctrl or ⌘ + scroll, or the buttons, to zoom. A keyboard-friendly list of clusters follows the map.`}
      >
        {/* faint star dust */}
        {Array.from({ length: 70 }, (_, i) => (
          <circle key={`d${i}`} cx={((i * 97) % 100) / 100 * width} cy={((i * 57) % 100) / 100 * height} r={0.6} fill="#efe8dc" opacity={0.08} />
        ))}
        {ordered.map((f) => {
          const m = matches(f)
          const hi = highlight(f)
          const inCluster = colorMode !== 'cluster' || selectedCluster === null || f.constellation!.cluster === selectedCluster
          const cx = transform.applyX(x(f.constellation!.x))
          const cy = transform.applyY(y(f.constellation!.y))
          if (cx < -10 || cx > width + 10 || cy < -10 || cy > height + 10) return null
          const on = hover === f.id
          return (
            <g key={f.id}>
              {hi && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#efe8dc" strokeWidth={1.5} opacity={0.9} />}
              <circle
                cx={cx}
                cy={cy}
                r={on ? r + 3 : r}
                fill={colorOf(f)}
                stroke="#0f0e0d"
                strokeWidth={2}
                opacity={m && inCluster ? 1 : 0.12}
                className="cursor-pointer"
                onMouseMove={(e) => {
                  setHover(f.id)
                  tip.show(
                    <div>
                      <div className="font-medium">
                        {f.title} <span className="text-muted">({f.year ?? '?'})</span>
                      </div>
                      <div className="text-ink-2">{[f.directors[0], fmtStars(f.rating)].filter(Boolean).join(' · ')}</div>
                      <div className="text-muted">{f.genres.slice(0, 4).join(' / ')}</div>
                      <div className="mt-1 text-[11px] text-faint">cluster: {clusters.find((c) => c.id === f.constellation!.cluster)?.label}</div>
                    </div>,
                    e,
                  )
                }}
                onMouseLeave={() => {
                  setHover(null)
                  tip.hide()
                }}
                onClick={() => openFilm(f.id)}
              />
              {(hi || (transform.k >= 3 && m)) && (
                <text x={cx + r + 4} y={cy + 3} className="pointer-events-none fill-ink-2 text-[10px]">
                  {f.title}
                </text>
              )}
            </g>
          )
        })}
        {labels.map((l) => {
          const active = selectedCluster === l.id
          return (
            <g key={l.id} className="cursor-pointer" onClick={() => onSelectCluster(active ? null : l.id)}>
              <rect x={l.x - l.w / 2} y={l.y - l.h / 2} width={l.w} height={l.h} rx={10} fill="#0f0e0d" fillOpacity={0.82} stroke={active ? WARM : '#3a3632'} />
              <text x={l.x} y={l.y + 3.5} textAnchor="middle" className={`text-[10.5px] ${active ? 'fill-amber' : 'fill-ink-2'}`}>
                {l.text}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
