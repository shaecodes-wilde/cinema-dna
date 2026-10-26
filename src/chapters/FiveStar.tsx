import { useMemo, useRef, useState } from 'react'
import type { AppFilm } from '../../shared/app-types.ts'
import { prefersReducedMotion, useData } from '../lib/data.tsx'
import { fmtDate, fmtStars } from '../lib/format.ts'
import { InsightCard } from '../ui/InsightCard.tsx'
import { Chapter, FilmChip, InfoTip, Poster, Reveal } from '../ui/primitives.tsx'
import { ArcDiagram, isCreative } from './fivestar/ArcDiagram.tsx'
import { FormulaChart } from './fivestar/FormulaChart.tsx'

/** 07 — My Five-Star Universe: the top shelf, what it shares, and how it connects. */
export function FiveStar() {
  const { data, film, openFilm, setFilter } = useData()
  const fs = data.fiveStar
  const films = useMemo(
    () =>
      fs.filmIds
        .map(film)
        .filter((f): f is AppFilm => !!f)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.viewingCount - a.viewingCount || (a.year ?? 0) - (b.year ?? 0)),
    [fs.filmIds, film],
  )
  const [selected, setSelected] = useState<string | null>(films.find((f) => f.rating === 5)?.id ?? films[0]?.id ?? null)
  const sel = selected ? film(selected) : undefined
  const detailRef = useRef<HTMLDivElement>(null)
  const pick = (id: string) => {
    setSelected(id)
    // On narrow screens the detail panel sits below the grid; bring it into view.
    if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }))
  }
  const formula = data.insights.find((i) => i.id === 'five-star-formula')
  const perfect = films.filter((f) => f.rating === 5)

  const shared = useMemo(() => {
    const count = (xs: string[]) => {
      const m = new Map<string, number>()
      xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1))
      return [...m].sort((a, b) => b[1] - a[1])
    }
    const meta = films.filter((f) => f.matched)
    const runtimes = meta.map((f) => f.runtime).filter((r): r is number => !!r).sort((a, b) => a - b)
    return {
      genres: count(meta.flatMap((f) => f.genres)).slice(0, 5),
      directors: count(films.flatMap((f) => f.directors)).filter(([, n]) => n >= 2),
      decades: count(films.map((f) => (f.decade ? `${f.decade}s` : '')).filter(Boolean)),
      medianRuntime: runtimes.length ? runtimes[Math.floor((runtimes.length - 1) / 2)] : null,
      allMedianRuntime: (() => {
        const rs = data.films.filter((f) => f.watched && f.runtime).map((f) => f.runtime!).sort((a, b) => a - b)
        return rs.length ? rs[Math.floor((rs.length - 1) / 2)] : null
      })(),
      awards: meta.filter((f) => f.prestige.length).length,
      rewatched: films.filter((f) => f.rewatchCount > 0).length,
      animated: meta.filter((f) => f.animated).length,
      metaN: meta.length,
    }
  }, [films, data.films])

  const selLinks = sel ? fs.links.filter((l) => l.a === sel.id || l.b === sel.id) : []
  const creativeLinks = fs.links.filter(isCreative).length

  return (
    <Chapter
      id="five-star"
      number="07"
      title="My Five-Star Universe"
      kicker="The top shelf"
      intro={
        <>
          {films.length} films have earned {fs.threshold}★ or more from you — {perfect.length} of them a perfect 5★. These are the films that define the top of
          your scale. Select one to read what you wrote and see how it connects to the others.
        </>
      }
    >
      <div className="space-y-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Reveal>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5" aria-label="Top-rated films">
              {films.map((f) => (
                <li key={f.id} className="flex flex-col gap-1.5">
                  <div className={`rounded-[4px] p-0.5 transition ${selected === f.id ? 'bg-amber' : 'bg-transparent'}`}>
                    <div className="[&>button]:w-full">
                      <Poster film={f} size="md" onClick={() => pick(f.id)} />
                    </div>
                  </div>
                  <div className="text-[11px] leading-tight text-muted">
                    <span className="num text-ink-2">{fmtStars(f.rating)}</span> · {f.directors[0] ?? f.year}
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <div ref={detailRef} aria-live="polite" className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
            {sel && (
              <div className="panel space-y-6 p-6">
                <div>
                  <div className="eyebrow mb-3">{fmtStars(sel.rating)} · {sel.year}</div>
                  <h3 className="display text-5xl leading-[0.95]">{sel.title}</h3>
                  <div className="mt-2 text-[13px] text-muted">
                    {[sel.directors.join(', '), sel.runtime ? `${sel.runtime} min` : null, sel.genres.slice(0, 3).join(' / ')].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {sel.reviews.filter((r) => r.text.trim()).length ? (
                  sel.reviews
                    .filter((r) => r.text.trim())
                    .slice(-2)
                    .map((r, i) => (
                      <blockquote key={i} className="relative pl-8">
                        <span aria-hidden className="display absolute -top-4 left-0 text-6xl text-amber/70">“</span>
                        <p className="display text-[26px] leading-[1.2] text-ink">{r.text}</p>
                        <footer className="mt-2 text-[12px] text-muted">
                          — you, {fmtDate(r.watched ?? r.date)}
                          {r.rewatch ? ' (rewatch)' : ''} · {fmtStars(r.rating)}
                        </footer>
                      </blockquote>
                    ))
                ) : (
                  <p className="text-[13px] italic text-muted">No written review for this one — the stars said it all.</p>
                )}
                {sel.ratingHistory.length > 0 && (
                  <div>
                    <div className="label mb-2">Rating history</div>
                    <ol className="flex flex-wrap items-center gap-2 text-[12px]">
                      {sel.ratingHistory.map((h, i) => (
                        <li key={i} className="flex items-center gap-2">
                          {i > 0 && <span aria-hidden className="text-faint">→</span>}
                          <span className="num text-ink">{fmtStars(h.rating)}</span>
                          <span className="text-muted">{h.source === 'current' ? 'current' : fmtDate(h.date, { month: 'short', year: 'numeric' })}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div>
                  <div className="label mb-2">Connected favourites ({selLinks.length})</div>
                  {selLinks.length ? (
                    <ul className="space-y-1.5">
                      {selLinks.map((l) => {
                        const other = l.a === sel.id ? l.b : l.a
                        return (
                          <li key={other} className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                            <FilmChip id={other} />
                            <span>{l.reasons.join(' · ')}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-muted">A loner — it shares no people, series or three-genre overlap with the rest of the shelf.</p>
                  )}
                </div>
                <button type="button" className="chip" onClick={() => openFilm(sel.id)}>
                  Full dossier →
                </button>
              </div>
            )}
          </div>
        </div>

        <Reveal className="panel p-6">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1.4fr] md:items-end">
            <h3 className="display text-3xl">How the favourites connect</h3>
            <p className="text-[14px] text-ink-2">
              Films ordered by release year. Bright, thicker arcs mark shared people or a shared series ({creativeLinks} links); faint thin arcs mark films that
              only share three or more genres. Hover an arc for the reason; select a film to trace its arcs.
            </p>
          </div>
          <ArcDiagram films={films} links={fs.links} selected={selected} onSelect={setSelected} />
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Reveal className="panel p-6">
            <h3 className="display mb-1 text-3xl">The formula</h3>
            <p className="mb-6 text-[13px] text-muted">
              How often each trait appears among your top films versus your 3.5★-and-below films
              <InfoTip>
                Sorted by the strength of the difference (a smoothed log-odds z-score; hover a row to see it). These traits travel with the films you love — they
                aren't causes.
              </InfoTip>
            </p>
            <FormulaChart traits={fs.traits} threshold={fs.threshold} />
          </Reveal>
          <Reveal className="panel space-y-5 p-6">
            <h3 className="display text-3xl">What they share</h3>
            <dl className="space-y-3 text-[13px]">
              <Row label="Most common genres">
                {shared.genres.map(([g, n]) => (
                  <button key={g} type="button" className="chip" onClick={() => setFilter({ genre: g, minRating: fs.threshold, status: 'rated' }, { reset: true, scroll: true })}>
                    {g} <span className="num text-muted">{n}</span>
                  </button>
                ))}
              </Row>
              {shared.directors.length > 0 && (
                <Row label="Directors with 2+">
                  {shared.directors.map(([d, n]) => (
                    <button key={d} type="button" className="chip" onClick={() => setFilter({ person: d }, { reset: true, scroll: true })}>
                      {d} <span className="num text-muted">{n}</span>
                    </button>
                  ))}
                </Row>
              )}
              <Row label="Decades">
                {shared.decades.map(([d, n]) => (
                  <span key={d} className="chip">{d} <span className="num text-muted">{n}</span></span>
                ))}
              </Row>
              <Row label="Median runtime">
                <span className="num text-ink">{shared.medianRuntime ?? '—'} min</span>
                <span className="text-muted">vs {shared.allMedianRuntime ?? '—'} min across everything you've watched</span>
              </Row>
              <Row label="Award-recognised">
                <span className="num text-ink">{shared.awards} of {shared.metaN}</span>
              </Row>
              <Row label="Animated">
                <span className="num text-ink">{shared.animated} of {shared.metaN}</span>
              </Row>
              <Row label="Rewatched">
                <span className="num text-ink">{shared.rewatched} of {films.length}</span>
              </Row>
            </dl>
          </Reveal>
        </div>

        {formula && (
          <Reveal>
            <InsightCard insight={formula} />
          </Reveal>
        )}
      </div>
    </Chapter>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-start gap-3 border-b hairline pb-3">
      <dt className="text-muted">{label}</dt>
      <dd className="flex flex-wrap items-center gap-1.5">{children}</dd>
    </div>
  )
}
