import { useMemo, useState } from 'react'
import { useData } from '../lib/data.tsx'
import { fmtDate, fmtRating } from '../lib/format.ts'
import { InsightCard } from '../ui/InsightCard.tsx'
import { Chapter, FilmChips, InfoTip, Poster, Reveal, Segmented, Stat } from '../ui/primitives.tsx'
import { Calendar } from './timeline/Calendar.tsx'
import { GenreDrift } from './timeline/GenreDrift.tsx'
import { LagScatter } from './timeline/LagScatter.tsx'
import { Monthly } from './timeline/Monthly.tsx'

/** 04 — My Cinema Timeline: when you watched, distinct from when the films were made. */
export function Timeline() {
  const { data, film, setFilter } = useData()
  const tl = data.timeline
  const dated = useMemo(() => data.viewings.filter((v) => v.date && (v.quality === 'live' || v.quality === 'delayed')), [data.viewings])
  const retro = data.viewings.filter((v) => v.quality === 'backfilled' || v.quality === 'approximate')
  const years = useMemo(() => [...new Set(dated.map((v) => Number(v.date!.slice(0, 4))))].sort(), [dated])
  const [year, setYear] = useState<number>(years.at(-1) ?? new Date().getFullYear())
  const [day, setDay] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)

  const busiest = [...tl.months].sort((a, b) => b.viewings - a.viewings)[0]
  const insights = data.insights.filter((i) => i.category === 'evolution' || i.category === 'rewatch')

  const selection = day ?? month
  const selectedViewings = selection ? dated.filter((v) => v.date!.startsWith(selection)) : []
  const selectedFilmIds = [...new Set(selectedViewings.map((v) => v.filmId))]

  return (
    <Chapter
      id="timeline"
      number="04"
      title="My Cinema Timeline"
      kicker="When you watched"
      intro={
        <>
          Two clocks run through your diary: the date you watched a film, and the year it was released. This chapter keeps them apart. Only diary entries
          with a trustworthy watch date are plotted; the {retro.length} entries dated before you joined Letterboxd are counted separately.
        </>
      }
    >
      <div className="space-y-16">
        <Reveal className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <Stat value={dated.length} label="Dated viewings" hint={`${fmtDate(dated.map((v) => v.date!).sort()[0], { month: 'short', year: 'numeric' })} onward`} />
          <Stat
            value={retro.length}
            label={
              <>
                Backfilled entries
                <InfoTip>
                  Diary entries whose watch date falls before your account was created were logged from memory (one is set to 1 January, a placeholder). They
                  count as films you watched, but they're left out of the calendar and monthly charts.
                </InfoTip>
              </>
            }
            hint="excluded from timeline charts"
          />
          <Stat value={busiest ? busiest.viewings : '—'} label="Busiest month" hint={busiest ? new Date(`${busiest.month}-15`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) : undefined} />
          <Stat
            value={`${Math.round((dated.filter((v) => v.rewatch).length / Math.max(dated.length, 1)) * 100)}%`}
            label="Rewatch share"
            hint={`${dated.filter((v) => v.rewatch).length} rewatches`}
          />
        </Reveal>

        <Reveal className="panel p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="display text-3xl">Every day in the dark</h3>
            <Segmented
              label="Calendar year"
              value={String(year)}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={(v) => {
                setYear(Number(v))
                setDay(null)
              }}
            />
          </div>
          <Calendar
            year={year}
            viewings={dated}
            selected={day}
            onSelect={(d) => {
              setDay(d)
              setMonth(null)
            }}
          />
        </Reveal>

        <Reveal className="panel p-6">
          <h3 className="display mb-5 text-3xl">Month by month</h3>
          <Monthly
            months={tl.months}
            mean={data.totals.meanRating}
            selected={month}
            onSelect={(m) => {
              setMonth(m)
              setDay(null)
            }}
          />
        </Reveal>

        <div aria-live="polite">
          {selection && (
            <div className="panel border-amber/40 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="label text-amber">
                  {day ? fmtDate(day, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : new Date(`${month}-15`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })} ·{' '}
                  {selectedViewings.length} {selectedViewings.length === 1 ? 'viewing' : 'viewings'}
                </div>
                <button type="button" className="chip" onClick={() => { setDay(null); setMonth(null) }}>
                  Clear
                </button>
              </div>
              <FilmChips ids={selectedFilmIds} max={24} />
            </div>
          )}
        </div>

        <div>
          <h3 className="display mb-6 text-3xl">Year by year</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tl.years.map((y, i) => (
              <Reveal key={y.year} delay={i * 0.06} className="panel flex flex-col gap-4 p-5">
                <div className="flex items-baseline justify-between">
                  <span className="display text-5xl text-ink">{y.year}</span>
                  <span className="num text-amber">{fmtRating(y.meanRating)}</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <dt className="text-muted">Viewings</dt>
                    <dd className="num text-lg text-ink">{y.viewings}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">
                      Avg release year
                      <InfoTip>The mean release year of the films you watched that year — how far back you reached.</InfoTip>
                    </dt>
                    <dd className="num text-lg text-ink">{y.meanReleaseYear ? Math.round(y.meanReleaseYear) : '—'}</dd>
                  </div>
                </dl>
                <div>
                  <div className="label mb-2">Top-rated that year</div>
                  <div className="grid grid-cols-3 gap-2 [&>button]:!w-full">
                    {y.topFilmIds.slice(0, 3).map((id) => {
                      const f = film(id)
                      return f ? <Poster key={id} film={f} size="sm" /> : null
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-auto self-start text-[12px] text-muted underline decoration-line-2 underline-offset-4 hover:text-amber"
                  onClick={() => setFilter({ watchedYear: y.year, status: 'watched' }, { reset: true, scroll: true })}
                >
                  open {y.year} in explorer →
                </button>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="panel p-6">
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1.4fr] md:items-end">
            <h3 className="display text-3xl">Release year vs. watch date</h3>
            <p className="text-[14px] text-ink-2">
              Each dot is one viewing. Horizontal position is when you watched; vertical position is when the film came out. Dots hugging the amber diagonal
              are films caught on release; dots far below it are trips into film history.
            </p>
          </div>
          <LagScatter />
        </Reveal>

        <Reveal className="panel p-6">
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1.4fr] md:items-end">
            <h3 className="display text-3xl">How your genre mix moved</h3>
            <p className="text-[14px] text-ink-2">
              Share of each year's films carrying a genre. Films carry several genres, so columns don't sum to 100%. Click a genre to see its films; the{' '}
              <a href="#genres" className="underline decoration-line-2 underline-offset-4 hover:text-amber">Genre Universe</a> shows how you rate them.
            </p>
          </div>
          <GenreDrift years={tl.years} />
        </Reveal>

        {insights.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-3">
            {insights.map((i) => (
              <Reveal key={i.id}>
                <InsightCard insight={i} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </Chapter>
  )
}
