import { motion } from 'motion/react'
import { useMemo } from 'react'
import { useData, useReducedMotion } from '../lib/data.tsx'
import { fmtDate, fmtRating, fmtStars, pct, plural } from '../lib/format.ts'
import { InfoTip, Poster, Reveal, Stat } from '../ui/primitives.tsx'

/** 01 — The Opening Sequence: title card, editorial intro, totals as a credits roll. */
export function Opening() {
  const { data, film, setFilter } = useData()
  const reduced = useReducedMotion()
  const t = data.totals
  const words = data.identity.title.split(' ')

  const decades = useMemo(() => {
    const rows = data.affinities.decade ?? []
    const byCount = [...rows].sort((a, b) => b.n - a.n)[0]
    const byLove = [...rows].filter((r) => r.n >= 5).sort((a, b) => b.shrunk - a.shrunk)[0]
    return { byCount, byLove }
  }, [data.affinities])

  const shelf = useMemo(
    () =>
      [...data.films]
        .filter((f) => f.rating !== null && f.rating >= 4.5)
        .sort((a, b) => b.rating! - a.rating! || b.viewingCount - a.viewingCount)
        .slice(0, 14),
    [data.films],
  )
  const favorites = data.profile.favoriteFilmIds.map(film).filter((f) => !!f)

  return (
    <section id="opening" aria-label="Opening" className="relative overflow-hidden">
      {/* Title card */}
      <div className="grain relative flex min-h-[100svh] flex-col justify-end px-5 pb-16 pt-28 md:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-[20%] top-[-30%] h-[80vh] w-[80vh] rounded-full bg-amber/10 blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[60vh] w-[60vh] rounded-full bg-cool/10 blur-[140px]" />
          <Sprockets />
        </div>
        <div className="relative mx-auto w-full max-w-7xl">
          <motion.div
            className="eyebrow mb-8 flex flex-wrap items-center gap-3"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            <span>Cinema DNA</span>
            <span className="h-px w-8 bg-amber/60" />
            <span className="text-ink-2">
              @{data.profile.username} · {data.profile.location || 'somewhere in the dark'} · since {fmtDate(data.profile.joined, { year: 'numeric', month: 'long' })}
            </span>
          </motion.div>
          <h1 className="display max-w-6xl text-[clamp(56px,11vw,176px)] leading-[0.86]">
            {words.map((w, i) => (
              <motion.span
                key={i}
                className={`mr-[0.22em] inline-block ${i === words.length - 1 ? 'italic text-amber' : ''}`}
                initial={reduced ? false : { opacity: 0, y: '0.4em', filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.4, delay: 0.3 + i * 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="mt-8 max-w-2xl text-xl leading-relaxed text-ink-2 md:text-2xl"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.3 }}
          >
            {data.identity.subtitle}
          </motion.p>
          <motion.a
            href="#opening-intro"
            className="mt-14 inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.3em] text-muted transition hover:text-amber"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2, duration: 1 }}
          >
            <span className="h-10 w-px bg-gradient-to-b from-transparent to-amber" />
            Roll film
          </motion.a>
        </div>
      </div>

      {/* Editorial intro */}
      <div id="opening-intro" className="border-t hairline px-5 py-24 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-6">
            {data.identity.intro.map((p, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <p className={i === 0 ? 'display text-3xl leading-[1.2] text-ink md:text-[40px]' : 'max-w-2xl text-lg leading-relaxed text-ink-2'}>{p}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <aside className="panel space-y-5 p-6">
              <div className="label">Standout signals</div>
              <dl className="space-y-4">
                {data.identity.standouts.map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-4 border-b hairline pb-3">
                    <dt className="text-sm text-ink-2">
                      {s.label}
                      {s.hint && <div className="text-[12px] text-muted">{s.hint}</div>}
                    </dt>
                    <dd className="num text-2xl text-amber">{s.value}</dd>
                  </div>
                ))}
              </dl>
              {favorites.length > 0 && (
                <div>
                  <div className="label mb-3">Pinned to your profile</div>
                  <div className="flex flex-wrap gap-2">
                    {favorites.map((f) => (
                      <Poster key={f!.id} film={f!} size="sm" />
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </Reveal>
        </div>
      </div>

      {/* Credits roll of totals */}
      <div className="border-t hairline px-5 py-20 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
          <Reveal>
            <Stat value={t.watchedFilms} label="Films watched" hint={`${t.ratedFilms} rated`} />
          </Reveal>
          <Reveal delay={0.05}>
            <Stat value={t.diaryViewings} label="Diary entries" hint={`${fmtDate(t.firstLog, { year: 'numeric', month: 'short' })} → ${fmtDate(t.lastLog, { year: 'numeric', month: 'short' })}`} />
          </Reveal>
          <Reveal delay={0.1}>
            <Stat
              value={t.hoursWatched !== null ? t.hoursWatched.toLocaleString('en-US') : '—'}
              label={
                <>
                  Hours in the dark
                  <InfoTip>Runtime × diary viewings (films without a diary entry count once). Runtime is known for {pct(t.hoursCoverage)} of watched films, so this is a lower bound.</InfoTip>
                </>
              }
              hint={t.hoursWatched ? `≈ ${Math.round(t.hoursWatched / 24)} days` : 'needs film metadata'}
            />
          </Reveal>
          <Reveal delay={0.15}>
            <Stat value={fmtRating(t.meanRating)} label="Average rating" hint={`median ${fmtStars(t.medianRating)} · SD ${t.sdRating.toFixed(2)}`} accent />
          </Reveal>
          <Reveal>
            <Stat value={t.rewatchViewings} label="Rewatches" hint={`${pct(t.rewatchViewings / Math.max(t.diaryViewings, 1))} of entries`} />
          </Reveal>
          <Reveal delay={0.05}>
            <Stat value={t.reviews} label="Reviews written" hint={`${t.reviewedFilms} films`} />
          </Reveal>
          <Reveal delay={0.1}>
            <Stat
              value={decades.byCount ? decades.byCount.key : '—'}
              label="Most-watched decade"
              hint={decades.byCount ? `${plural(decades.byCount.n, 'film')} · ${pct(decades.byCount.share)}` : undefined}
            />
          </Reveal>
          <Reveal delay={0.15}>
            <Stat
              value={decades.byLove ? decades.byLove.key : '—'}
              label={
                <>
                  Best-rated decade
                  <InfoTip>Highest shrunk average among decades with at least 5 rated films. Shrinkage pulls small samples toward your overall mean.</InfoTip>
                </>
              }
              hint={decades.byLove ? `${fmtRating(decades.byLove.shrunk)} shrunk · n=${decades.byLove.n}` : undefined}
            />
          </Reveal>
        </div>
      </div>

      {/* The top shelf, drifting like a film strip */}
      <div className="relative border-t hairline py-14">
        <div className="mx-auto mb-6 flex max-w-7xl items-baseline justify-between px-5 md:px-10 lg:px-16">
          <div className="label">Your 4.5★ and 5★ shelf</div>
          <button type="button" className="text-[12px] text-muted underline decoration-line-2 underline-offset-4 hover:text-amber" onClick={() => setFilter({ minRating: 4.5, status: 'rated' }, { reset: true, scroll: true })}>
            open in explorer →
          </button>
        </div>
        <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
          <div className={`flex w-max gap-4 px-5 ${reduced ? '' : 'animate-[marquee_80s_linear_infinite] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]'}`}>
            {[...shelf, ...(reduced ? [] : shelf)].map((f, i) => (
              <div key={`${f.id}-${i}`} aria-hidden={i >= shelf.length ? true : undefined}>
                <Poster film={f} size="md" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </section>
  )
}

/** Faint film-strip perforations along the title card's edges. */
function Sprockets() {
  const holes = Array.from({ length: 40 })
  return (
    <>
      {['top-3', 'bottom-3'].map((pos) => (
        <div key={pos} className={`absolute inset-x-0 ${pos} flex justify-between px-4 opacity-[0.07]`}>
          {holes.map((_, i) => (
            <span key={i} className="h-3 w-5 rounded-[2px] bg-ink" />
          ))}
        </div>
      ))}
    </>
  )
}
