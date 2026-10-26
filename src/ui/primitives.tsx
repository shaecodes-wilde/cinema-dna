import { motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { AppFilm, Confidence, EvidenceKind } from '../../shared/app-types.ts'
import { useData, useReducedMotion } from '../lib/data.tsx'
import { fmtStars, posterTone, ratingColor } from '../lib/format.ts'

// ─── Chapter shell ─────────────────────────────────────────────────────────

/** A numbered chapter. Children mount when the chapter approaches the viewport (keeps first paint fast). */
export function Chapter({
  id,
  number,
  title,
  kicker,
  intro,
  children,
}: {
  id: string
  number: string
  title: string
  kicker: string
  intro?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  // Deep links (#chapter) mount immediately so the browser can scroll to real content.
  const [visible, setVisible] = useState(() => window.location.hash === `#${id}`)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '900px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [id])
  return (
    <section id={id} ref={ref} aria-labelledby={`${id}-title`} className="relative border-t hairline px-5 py-24 md:px-10 lg:px-16">
      <header className="mx-auto mb-14 grid max-w-7xl gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-end">
        <div>
          <div className="eyebrow mb-5 flex items-center gap-3">
            <span className="num text-amber">{number}</span>
            <span className="h-px w-10 bg-amber/60" />
            <span>{kicker}</span>
          </div>
          <h2 id={`${id}-title`} className="display text-5xl leading-[0.95] md:text-7xl">
            {title}
          </h2>
        </div>
        {intro && <div className="max-w-2xl text-[17px] leading-relaxed text-ink-2">{intro}</div>}
      </header>
      <div className="mx-auto max-w-7xl">{visible ? children : <div className="h-[60vh]" aria-hidden />}</div>
    </section>
  )
}

/** Fade/slide-in on first view; static when reduced motion is requested. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ─── Tooltip (one floating layer for the whole app) ───────────────────────

interface TipState {
  x: number
  y: number
  content: ReactNode
}
const TipContext = createContext<{ show: (content: ReactNode, e: { clientX: number; clientY: number }) => void; hide: () => void } | null>(null)

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = useCallback((content: ReactNode, e: { clientX: number; clientY: number }) => setTip({ x: e.clientX, y: e.clientY, content }), [])
  const hide = useCallback(() => setTip(null), [])
  return (
    <TipContext.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[60] max-w-xs rounded-[3px] border border-line-2 bg-night/95 px-3 py-2 text-[13px] leading-snug text-ink shadow-2xl backdrop-blur"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 300),
            top: tip.y + 16 > window.innerHeight - 140 ? tip.y - 120 : tip.y + 16,
          }}
        >
          {tip.content}
        </div>
      )}
    </TipContext.Provider>
  )
}

export function useTooltip() {
  const ctx = useContext(TipContext)
  if (!ctx) throw new Error('useTooltip outside provider')
  return ctx
}

/** Small "?" affordance that explains a metric on hover/focus. */
export function InfoTip({ children, label = 'What does this mean?' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-2 text-[10px] text-muted transition hover:border-amber hover:text-amber"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-6 left-1/2 z-50 w-64 -translate-x-1/2 rounded-[3px] border border-line-2 bg-night px-3 py-2 text-left text-[12px] normal-case leading-snug tracking-normal text-ink-2 shadow-2xl"
        >
          {children}
        </span>
      )}
    </span>
  )
}

// ─── Small atoms ───────────────────────────────────────────────────────────

const CONF_STYLE: Record<Confidence, string> = {
  high: 'border-amber/70 text-amber',
  medium: 'border-ink-2/40 text-ink-2',
  low: 'border-line-2 text-muted',
}

export function ConfidenceBadge({ level, n, evidence, speculative }: { level: Confidence; n?: number; evidence?: EvidenceKind; speculative?: boolean }) {
  const dots = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] ${CONF_STYLE[level]}`}>
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < dots ? 'bg-current' : 'bg-line-2'}`} />
        ))}
      </span>
      <span>
        {level} confidence{n !== undefined ? ` · n=${n}` : ''}
        {evidence ? ` · ${evidence}` : ''}
        {speculative ? ' · interpretive' : ''}
      </span>
    </span>
  )
}

export function Stat({ value, label, hint, accent }: { value: ReactNode; label: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`num text-4xl leading-none md:text-5xl ${accent ? 'text-amber' : 'text-ink'}`}>{value}</div>
      <div className="label">{label}</div>
      {hint && <div className="text-[12px] text-muted">{hint}</div>}
    </div>
  )
}

/** Clickable film reference used everywhere: opens the film drawer. */
export function FilmChip({ id, showRating = true, className = '' }: { id: string; showRating?: boolean; className?: string }) {
  const { film, openFilm, data } = useData()
  const f = film(id)
  if (!f) return null
  return (
    <button type="button" onClick={() => openFilm(id)} className={`chip ${className}`} title={`${f.title}${f.year ? ` (${f.year})` : ''}`}>
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: ratingColor(f.rating, data.totals.meanRating, data.totals.sdRating) }}
      />
      <span className="max-w-[18ch] truncate">{f.title}</span>
      {showRating && f.rating !== null && <span className="num text-[11px] text-muted">{fmtStars(f.rating)}</span>}
    </button>
  )
}

export function FilmChips({ ids, max = 8 }: { ids: string[]; max?: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? ids : ids.slice(0, max)
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((id) => (
        <FilmChip key={id} id={id} />
      ))}
      {ids.length > max && (
        <button type="button" className="chip text-muted" onClick={() => setAll(!all)}>
          {all ? 'show less' : `+${ids.length - max} more`}
        </button>
      )}
    </div>
  )
}

/**
 * Poster: the real poster when TMDB enrichment supplied one, otherwise a typographic
 * title card (no unlicensed imagery).
 */
export function Poster({
  film,
  size = 'md',
  onClick,
  interactive = true,
}: {
  film: AppFilm
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  /** false renders a plain figure (e.g. inside the film's own dossier) */
  interactive?: boolean
}) {
  const { openFilm } = useData()
  const tone = posterTone(film.id)
  const w = size === 'sm' ? 'w-24' : size === 'lg' ? 'w-56' : 'w-36'
  const Tag = interactive ? 'button' : 'div'
  const titleSize = size === 'sm' ? 'text-[13px] line-clamp-4' : size === 'lg' ? 'text-3xl line-clamp-5' : 'text-xl line-clamp-5'
  return (
    <Tag
      {...(interactive ? { type: 'button' as const, onClick: onClick ?? (() => openFilm(film.id)) } : { role: 'img' })}
      className={`group relative block aspect-[2/3] ${w} shrink-0 overflow-hidden rounded-[3px] text-left shadow-[0_20px_40px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/5 ${interactive ? 'transition duration-500 ease-[var(--ease-cine)] hover:-translate-y-1 hover:ring-amber/60' : ''}`}
      style={{ background: tone.bg, color: tone.ink }}
      aria-label={`${film.title}${film.year ? `, ${film.year}` : ''}${film.rating ? `, rated ${film.rating} stars` : ''}`}
    >
      {film.poster ? (
        <img src={film.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="grain absolute inset-0 flex flex-col justify-between p-3">
          <span className={`${size === 'sm' ? 'text-[8px] tracking-[0.15em]' : 'text-[9px] tracking-[0.25em]'} line-clamp-2 uppercase opacity-60`}>{film.directors[0] ?? (film.year ?? '')}</span>
          <span className={`display ${titleSize} break-words leading-[0.95] [hyphens:auto]`} lang="en">{film.title}</span>
          <span className="flex items-end justify-between text-[10px] uppercase tracking-[0.2em] opacity-70">
            <span>{film.year ?? ''}</span>
            {film.rating !== null && <span className="num text-[11px] tracking-normal">{fmtStars(film.rating)}</span>}
          </span>
        </span>
      )}
    </Tag>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} aria-pressed={value === o.value} className="chip" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="panel p-8 text-center text-sm text-muted">{children}</div>
}
