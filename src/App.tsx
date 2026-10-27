import { useEffect, useState } from 'react'
import { MIN_RATED_FILMS, type AppData } from '../shared/app-types.ts'
import { Constellation } from './chapters/Constellation.tsx'
import { Critic } from './chapters/Critic.tsx'
import { Directors } from './chapters/Directors.tsx'
import { Dna } from './chapters/Dna.tsx'
import { Explorer } from './chapters/Explorer.tsx'
import { FiveStar } from './chapters/FiveStar.tsx'
import { Genres } from './chapters/Genres.tsx'
import { Next } from './chapters/Next.tsx'
import { Opening } from './chapters/Opening.tsx'
import { Quality } from './chapters/Quality.tsx'
import { Report } from './chapters/Report.tsx'
import { Timeline } from './chapters/Timeline.tsx'
import { CHAPTERS } from './chapters/registry.ts'
import { DataProvider, scrollToSection, useAppData } from './lib/data.tsx'
import { FilmDrawer } from './ui/FilmDrawer.tsx'
import { ChapterBoundary } from './ui/ErrorBoundary.tsx'
import { TooltipProvider } from './ui/primitives.tsx'

export function App() {
  const state = useAppData()
  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="eyebrow animate-pulse">Threading the projector…</div>
      </div>
    )
  }
  if (state.status === 'missing') return <MissingData message={state.message} />
  if (state.data.totals.ratedFilms < MIN_RATED_FILMS) return <NotEnoughRatings data={state.data} />
  return <Dashboard data={state.data} />
}

function Dashboard({ data }: { data: AppData }) {
  // The data arrives after the browser's own #anchor jump, so honour deep links once mounted, and route
  // in-page anchor clicks through scrollToSection (lazily-mounted chapters shift positions while scrolling).
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) requestAnimationFrame(() => scrollToSection(id))
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
      const target = a?.getAttribute('href')?.slice(1)
      if (!target || !document.getElementById(target) || e.metaKey || e.ctrlKey || e.button !== 0) return
      e.preventDefault()
      history.replaceState(null, '', `#${target}`)
      scrollToSection(target)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  return (
    <DataProvider data={data}>
      <TooltipProvider>
        <a href="#dna" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-amber focus:px-3 focus:py-2 focus:text-night">
          Skip to the analysis
        </a>
        <Nav username={data.profile.username} />
        <main>
          <ChapterBoundary name="Opening">
            <Opening />
          </ChapterBoundary>
          <ChapterBoundary name="Taste DNA">
            <Dna />
          </ChapterBoundary>
          <ChapterBoundary name="Genre Universe">
            <Genres />
          </ChapterBoundary>
          <ChapterBoundary name="Timeline">
            <Timeline />
          </ChapterBoundary>
          <ChapterBoundary name="Director's Gallery">
            <Directors />
          </ChapterBoundary>
          <ChapterBoundary name="Constellation">
            <Constellation />
          </ChapterBoundary>
          <ChapterBoundary name="Five-Star Universe">
            <FiveStar />
          </ChapterBoundary>
          <ChapterBoundary name="Critical Analysis">
            <Critic />
          </ChapterBoundary>
          <ChapterBoundary name="Next favourite">
            <Next />
          </ChapterBoundary>
          <ChapterBoundary name="Identity report">
            <Report />
          </ChapterBoundary>
          <ChapterBoundary name="Film Explorer">
            <Explorer />
          </ChapterBoundary>
          <ChapterBoundary name="Data quality">
            <Quality />
          </ChapterBoundary>
        </main>
        <footer className="border-t hairline px-5 py-10 text-center text-[12px] text-muted md:px-16">
          CINEMA DNA · built locally from your Letterboxd export ({data.source.archive}) · film metadata from{' '}
          {data.source.metadataSources.includes('wikidata') && (
            <a className="underline decoration-line-2 underline-offset-4 hover:text-amber" href="https://www.wikidata.org" target="_blank" rel="noreferrer">
              Wikidata
            </a>
          )}
          {data.source.metadataSources.includes('tmdb') && ' and TMDB (this product uses the TMDB API but is not endorsed or certified by TMDB)'} · not affiliated with
          Letterboxd ·{' '}
          <a className="underline decoration-line-2 underline-offset-4 hover:text-amber" href="#quality">
            data quality &amp; provenance
          </a>
        </footer>
        <FilmDrawer />
      </TooltipProvider>
    </DataProvider>
  )
}

function Nav({ username }: { username: string }) {
  const [active, setActive] = useState<string>('opening')
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (vis) setActive(vis.target.id)
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    )
    els.forEach((e) => io.observe(e))
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return (
    <nav
      aria-label="Chapters"
      className={`fixed inset-x-0 top-0 z-30 border-b transition-all duration-500 ${scrolled ? 'border-line bg-night/85 backdrop-blur-md' : 'border-transparent bg-transparent'}`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5 md:px-10">
        <a href="#opening" className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tracking-[0.3em] text-ink">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-amber shadow-[0_0_12px_#e0a43a]" />
          CINEMA&nbsp;DNA
        </a>
        <ol className="scroll-thin -mb-px flex flex-1 items-center gap-1 overflow-x-auto">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-label={c.nav}
                aria-current={active === c.id ? 'true' : undefined}
                className={`flex items-baseline gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] transition ${active === c.id ? 'bg-night-3 text-ink' : 'text-muted hover:text-ink'}`}
              >
                <span className={`num text-[10px] ${active === c.id ? 'text-amber' : 'text-faint'}`}>{c.number}</span>
                <span className="hidden sm:inline">{c.nav}</span>
              </a>
            </li>
          ))}
        </ol>
        <span className="hidden shrink-0 text-[12px] text-muted lg:inline">@{username}</span>
      </div>
    </nav>
  )
}

function NotEnoughRatings({ data }: { data: AppData }) {
  const t = data.totals
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="eyebrow">CINEMA DNA · @{data.profile.username}</div>
      <h1 className="display text-6xl">Not enough ratings yet.</h1>
      <p className="text-lg leading-relaxed text-ink-2">{data.identity.intro[0]}</p>
      <p className="text-sm text-muted">
        Your export was read fine: {t.watchedFilms} watched films, {t.diaryViewings} diary entries, {t.watchlist} on your watchlist and {t.ratedFilms} rated.
      </p>
    </div>
  )
}

function MissingData({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="eyebrow">CINEMA DNA</div>
      <h1 className="display text-6xl">No analysis found yet.</h1>
      <p className="text-ink-2">
        The dashboard reads <code className="num text-amber">public/data/cinema-dna.json</code>, which is generated locally from your Letterboxd export ({message}).
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-ink-2">
        <li>
          Put your export zip in <code className="num">data/raw/</code>
        </li>
        <li>
          Run <code className="num text-amber">npm run refresh</code>
        </li>
        <li>Reload this page.</li>
      </ol>
    </div>
  )
}
