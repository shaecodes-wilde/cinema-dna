import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppData, AppFilm } from '../../shared/app-types.ts'

/**
 * Explorer filters are global so any chart can "drill down": clicking a genre, director or
 * decade anywhere sets a filter here and scrolls to the film explorer.
 */
export interface ExplorerFilter {
  query: string
  genre: string | null
  person: string | null
  decade: number | null
  status: 'all' | 'watched' | 'watchlist' | 'rated' | 'reviewed' | 'rewatched' | 'liked'
  minRating: number
  watchedYear: number | null
}

export const EMPTY_FILTER: ExplorerFilter = {
  query: '',
  genre: null,
  person: null,
  decade: null,
  status: 'watched',
  minRating: 0,
  watchedYear: null,
}

interface Ctx {
  data: AppData
  film: (id: string) => AppFilm | undefined
  openFilm: (id: string | null) => void
  openFilmId: string | null
  filter: ExplorerFilter
  setFilter: (f: Partial<ExplorerFilter>, opts?: { reset?: boolean; scroll?: boolean }) => void
}

const DataContext = createContext<Ctx | null>(null)

export function useData(): Ctx {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData outside provider')
  return ctx
}

export function DataProvider({ data, children }: { data: AppData; children: ReactNode }) {
  const index = useMemo(() => new Map(data.films.map((f) => [f.id, f])), [data])
  const [openFilmId, setOpen] = useState<string | null>(null)
  const [filter, setFilterState] = useState<ExplorerFilter>(EMPTY_FILTER)

  const setFilter = useCallback<Ctx['setFilter']>((f, opts) => {
    setFilterState((prev) => ({ ...(opts?.reset ? EMPTY_FILTER : prev), ...f }))
    if (opts?.scroll) {
      setOpen(null)
      requestAnimationFrame(() => scrollToSection('explorer'))
    }
  }, [])

  const value = useMemo<Ctx>(
    () => ({ data, film: (id) => index.get(id), openFilm: setOpen, openFilmId, filter, setFilter }),
    [data, index, openFilmId, filter, setFilter],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/**
 * Jump to a section and keep it in place while lazily-mounted chapters above it grow
 * (placeholders → full charts). Stops as soon as the user scrolls on their own.
 */
export function scrollToSection(id: string): void {
  const el = () => document.getElementById(id)
  const go = () => el()?.scrollIntoView({ behavior: 'instant', block: 'start' })
  let cancelled = false
  const cancel = () => (cancelled = true)
  const opts = { once: true, passive: true } as const
  window.addEventListener('wheel', cancel, opts)
  window.addEventListener('touchstart', cancel, opts)
  window.addEventListener('keydown', cancel, opts)
  go()
  let tries = 0
  const settle = () => {
    const target = el()
    if (cancelled || !target) return
    const top = target.getBoundingClientRect().top
    if (top < 0 || top > 160) go()
    if (++tries < 10) setTimeout(settle, 150)
  }
  setTimeout(settle, 100)
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export type LoadState = { status: 'loading' } | { status: 'missing'; message: string } | { status: 'ready'; data: AppData }

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Only checks the bundle's outer shape; detailed schema validation is deferred. */
export function isAppData(x: unknown): x is AppData {
  return isObject(x)
    && typeof x.generatedAt === 'string'
    && isObject(x.profile) && typeof x.profile.username === 'string'
    && isObject(x.source) && Array.isArray(x.source.metadataSources)
    && isObject(x.totals) && typeof x.totals.ratedFilms === 'number' && typeof x.totals.watchedFilms === 'number'
    && isObject(x.identity) && Array.isArray(x.identity.intro)
    && ['films', 'insights', 'dna', 'genrePairs', 'recommendations'].every((key) => Array.isArray(x[key]))
    && isObject(x.model)
    && isObject(x.report) && Array.isArray(x.report.sections)
    && isObject(x.quality) && isObject(x.quality.audit) && isObject(x.quality.metadata) && Array.isArray(x.quality.notes)
}

export function useAppData(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/cinema-dna.json`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // Dev servers answer a missing file with index.html; treat anything non-JSON as "not generated yet".
        if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error('public/data/cinema-dna.json not found')
        const data: unknown = await res.json()
        if (!isAppData(data)) throw new Error('public/data/cinema-dna.json is not a CINEMA DNA bundle; rerun npm run analyze')
        setState({ status: 'ready', data })
      })
      .catch((err: Error) => setState({ status: 'missing', message: err.message }))
  }, [])
  return state
}
