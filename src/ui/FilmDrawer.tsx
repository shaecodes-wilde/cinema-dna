import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { useData, useReducedMotion } from '../lib/data.tsx'
import { fmtDate, fmtRating, fmtStars, ratingColor, signed } from '../lib/format.ts'
import { FilmChip, Poster } from './primitives.tsx'

/** Global side panel with everything known about one film. Opened from any chart or chip. */
export function FilmDrawer() {
  const { openFilmId, openFilm, film, data, setFilter } = useData()
  const f = openFilmId ? film(openFilmId) : undefined
  const reduced = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!f) return
    returnFocus.current = document.activeElement
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openFilm(null)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      ;(returnFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true }) // don't undo drill-down scrolls
    }
  }, [f, openFilm])

  const viewings = useMemo(() => (f ? data.viewings.filter((v) => v.filmId === f.id).sort((a, b) => (a.date ?? a.logged).localeCompare(b.date ?? b.logged)) : []), [f, data.viewings])
  const neighbours = useMemo(() => {
    if (!f?.constellation) return []
    const { x, y } = f.constellation
    return data.films
      .filter((o) => o.id !== f.id && o.constellation)
      .map((o) => ({ o, d: Math.hypot(o.constellation!.x - x, o.constellation!.y - y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
      .map((n) => n.o.id)
  }, [f, data.films])

  const { meanRating: mean, sdRating: sd } = data.totals
  const meta: [string, string[], 'person' | 'genre' | null][] = f
    ? [
        ['Directed by', f.directors, 'person'],
        ['Written by', f.writers, 'person'],
        ['Cinematography', f.cinematographers, 'person'],
        ['Music', f.composers, 'person'],
        ['Cast', f.cast.slice(0, 8), 'person'],
        ['Genres', f.genres, 'genre'],
        ['Sub-genres', f.subgenres, null],
        ['Countries', f.countries, null],
        ['Languages', f.languages, null],
        ['Recognition', f.prestige, null],
      ]
    : []

  return (
    <AnimatePresence>
      {f && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => openFilm(null)}
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${f.title} details`}
            className="scroll-thin fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-line bg-night-2 shadow-2xl"
            initial={reduced ? { opacity: 0 } : { x: '100%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b hairline bg-night-2/95 px-6 py-3 backdrop-blur">
              <span className="eyebrow">Film dossier</span>
              <button ref={closeRef} type="button" onClick={() => openFilm(null)} className="chip" aria-label="Close film details">
                Close ✕
              </button>
            </div>
            <div className="space-y-8 p-6">
              <div className="flex gap-5">
                <Poster film={f} size="md" interactive={false} />
                <div className="min-w-0 space-y-3">
                  <h2 className="display text-4xl leading-[0.95]">{f.title}</h2>
                  <div className="text-sm text-muted">
                    {[f.year, f.runtime ? `${f.runtime} min` : null, f.franchise].filter(Boolean).join(' · ')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {f.rating !== null && (
                      <span className="num rounded-[3px] px-2 py-1 text-lg text-night" style={{ background: ratingColor(f.rating, mean, sd) }}>
                        {fmtStars(f.rating)}
                      </span>
                    )}
                    {f.liked && <span className="chip">♥ liked</span>}
                    {f.favorite && <span className="chip border-amber text-amber">profile favourite</span>}
                    {f.inWatchlist && !f.watched && <span className="chip">on watchlist</span>}
                    {f.rewatchCount > 0 && <span className="chip">{f.rewatchCount}× rewatched</span>}
                  </div>
                  {f.rating !== null && f.predicted !== null && (
                    <p className="text-[13px] text-muted">
                      Taste model expected <span className="num text-ink-2">{fmtRating(f.predicted, 1)}</span> — you were{' '}
                      <span className="num" style={{ color: f.rating >= f.predicted ? '#e0a43a' : '#6da7ec' }}>
                        {signed(f.rating - f.predicted, 1)}★
                      </span>{' '}
                      {f.rating >= f.predicted ? 'warmer' : 'cooler'}.
                    </p>
                  )}
                </div>
              </div>

              {viewings.length > 0 && (
                <section>
                  <h3 className="label mb-3">Diary</h3>
                  <ol className="space-y-1.5">
                    {viewings.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 border-b hairline py-1.5 text-[13px]">
                        <span className="text-ink-2">
                          {fmtDate(v.date)}
                          {v.rewatch && <span className="ml-2 text-amber">↻ rewatch</span>}
                          {v.quality === 'backfilled' || v.quality === 'approximate' ? (
                            <span className="ml-2 text-muted" title="Logged retroactively; the date may be approximate">· backfilled</span>
                          ) : null}
                          {v.tags.length > 0 && <span className="ml-2 text-muted">#{v.tags.join(' #')}</span>}
                        </span>
                        <span className="num text-ink">{fmtStars(v.rating)}</span>
                      </li>
                    ))}
                  </ol>
                  {f.ratingHistory.some((h) => h.source === 'current') && viewings.at(-1)?.rating !== f.rating && (
                    <p className="mt-2 text-[12px] text-muted">Current rating {fmtStars(f.rating)} differs from the last diary rating — revised later.</p>
                  )}
                </section>
              )}
              {f.watched && viewings.length === 0 && (
                <p className="text-[13px] text-muted">Marked as watched{f.watchedAddedDate ? ` on ${fmtDate(f.watchedAddedDate)}` : ''} without a dated diary entry.</p>
              )}

              {f.reviews.length > 0 && (
                <section>
                  <h3 className="label mb-3">Your words</h3>
                  <div className="space-y-4">
                    {f.reviews.map((r, i) => (
                      <blockquote key={i} className="border-l-2 border-amber/60 pl-4">
                        <p className="display text-[22px] leading-snug text-ink">“{r.text}”</p>
                        <footer className="mt-1 text-[12px] text-muted">
                          {fmtDate(r.watched ?? r.date)} · {fmtStars(r.rating)}
                          {r.rewatch ? ' · rewatch' : ''}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </section>
              )}

              {f.matched ? (
                <section>
                  <h3 className="label mb-3">
                    Credits & metadata{' '}
                    <span className="normal-case tracking-normal text-faint">
                      · Wikidata {f.wikidataId} · {f.matchConfidence} confidence match
                    </span>
                  </h3>
                  <dl className="space-y-2 text-[13px]">
                    {meta
                      .filter(([, v]) => v.length)
                      .map(([label, values, kind]) => (
                        <div key={label} className="grid grid-cols-[120px_1fr] gap-3">
                          <dt className="text-muted">{label}</dt>
                          <dd className="flex flex-wrap gap-y-1">
                            {values.map((v) =>
                              kind ? (
                                <button
                                  key={v}
                                  type="button"
                                  className="text-ink-2 underline decoration-line-2 underline-offset-4 transition hover:text-amber hover:decoration-amber"
                                  onClick={() => setFilter(kind === 'genre' ? { genre: v } : { person: v }, { reset: true, scroll: true })}
                                >
                                  {v}
                                </button>
                              ) : (
                                <span key={v} className="text-ink-2">
                                  {v}
                                </span>
                              ),
                            ).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, <span key={`s${i}`} className="mr-1.5 text-faint">,</span>, el] : [el]), [])}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </section>
              ) : (
                <p className="rounded-[3px] border border-dashed border-line-2 p-3 text-[13px] text-muted">
                  No confident metadata match for this title, so it's excluded from genre, people and similarity analysis.
                </p>
              )}

              {f.lists.length > 0 && (
                <section>
                  <h3 className="label mb-3">In your lists</h3>
                  <ul className="space-y-1 text-[13px] text-ink-2">
                    {f.lists.map((l) => (
                      <li key={l.name}>
                        #{l.position} in <span className="text-ink">{l.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {neighbours.length > 0 && (
                <section>
                  <h3 className="label mb-3">Nearest in your constellation</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {neighbours.map((id) => (
                      <FilmChip key={id} id={id} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
