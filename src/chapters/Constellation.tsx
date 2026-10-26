import { useCallback, useMemo, useState } from 'react'
import type { AppFilm } from '../../shared/app-types.ts'
import { useData } from '../lib/data.tsx'
import { COOL, fmtRating, heat, NEUTRAL, WARM } from '../lib/format.ts'
import { Chapter, FilmChips, InfoTip, Reveal, Segmented } from '../ui/primitives.tsx'
import { StarMap, type ColorMode } from './constellation/StarMap.tsx'

const select = 'rounded-full border border-line-2 bg-night-2 px-3 py-1 text-[12px] text-ink-2 focus:border-amber focus:outline-none'

/** 06 — The Movie Constellation: an explainable similarity map of watched films. */
export function Constellation() {
  const { data } = useData()
  const films = useMemo(() => data.films.filter((f) => f.watched && f.constellation), [data.films])
  const clusters = data.constellation.clusters
  const [colorMode, setColorMode] = useState<ColorMode>('rating')
  const [genre, setGenre] = useState('')
  const [decade, setDecade] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [director, setDirector] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null)

  const genres = useMemo(() => [...new Set(films.flatMap((f) => f.genres))].sort(), [films])
  const decades = useMemo(() => [...new Set(films.map((f) => f.decade).filter((d): d is number => d !== null))].sort(), [films])
  const directors = useMemo(() => [...new Set(films.flatMap((f) => f.directors))].sort(), [films])

  const matches = useCallback(
    (f: AppFilm) =>
      (!genre || f.genres.includes(genre)) &&
      (!decade || f.decade === Number(decade)) &&
      (minRating === 0 || (f.rating ?? 0) >= minRating) &&
      (!director || f.directors.some((d) => d.toLowerCase().includes(director.toLowerCase()))),
    [genre, decade, minRating, director],
  )
  const highlight = useCallback(
    (f: AppFilm) => query.trim().length >= 2 && (f.title.toLowerCase().includes(query.toLowerCase()) || f.cast.some((c) => c.toLowerCase().includes(query.toLowerCase()))),
    [query],
  )
  const matched = films.filter(matches)
  const filtered = matched.length !== films.length
  const selectCluster = (id: number | null) => {
    setSelectedCluster(id)
    if (id !== null) setColorMode('cluster')
  }

  return (
    <Chapter
      id="constellation"
      number="06"
      title="The Movie Constellation"
      kicker="Your films as a map"
      intro={
        <>
          Every film you've watched with verified metadata is a star here. Films sit close together when they share concrete, recorded attributes: a director,
          a franchise, genres, an era, a production region. It is a map of your library's structure, not a verdict on which films "feel" alike.
        </>
      }
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented<ColorMode>
            label="Colour stars by"
            value={colorMode}
            onChange={setColorMode}
            options={[
              { value: 'rating', label: 'Colour: rating' },
              { value: 'decade', label: 'Colour: decade' },
              { value: 'cluster', label: 'Colour: cluster' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="cx-genre">Genre</label>
            <select id="cx-genre" className={select} value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">All genres</option>
              {genres.map((g) => <option key={g}>{g}</option>)}
            </select>
            <label className="sr-only" htmlFor="cx-decade">Decade</label>
            <select id="cx-decade" className={select} value={decade} onChange={(e) => setDecade(e.target.value)}>
              <option value="">All decades</option>
              {decades.map((d) => <option key={d} value={d}>{d}s</option>)}
            </select>
            <label className="sr-only" htmlFor="cx-rating">Minimum rating</label>
            <select id="cx-rating" className={select} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>Any rating</option>
              {[3, 3.5, 4, 4.5, 5].map((r) => <option key={r} value={r}>{r}★ +</option>)}
            </select>
            <label className="sr-only" htmlFor="cx-director">Director</label>
            <input id="cx-director" list="cx-directors" className={`${select} w-36`} placeholder="Director…" value={director} onChange={(e) => setDirector(e.target.value)} />
            <datalist id="cx-directors">{directors.map((d) => <option key={d} value={d} />)}</datalist>
            <label className="sr-only" htmlFor="cx-query">Highlight a film or actor</label>
            <input id="cx-query" className={`${select} w-40`} placeholder="Highlight title / actor…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {(filtered || query || selectedCluster !== null) && (
              <button type="button" className="chip" onClick={() => { setGenre(''); setDecade(''); setMinRating(0); setDirector(''); setQuery(''); setSelectedCluster(null) }}>
                Clear
              </button>
            )}
          </div>
        </div>

        <Reveal className="panel overflow-hidden p-2">
          <StarMap
            films={films}
            clusters={clusters}
            colorMode={colorMode}
            matches={matches}
            highlight={highlight}
            selectedCluster={selectedCluster}
            onSelectCluster={selectCluster}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-[12px] text-ink-2">
            <Legend mode={colorMode} decades={decades} mean={data.totals.meanRating} />
            <span className="text-muted">
              {filtered ? `${matched.length} of ${films.length} films match` : `${films.length} films`} · drag to pan · ctrl/⌘ + scroll to zoom · click a star for its dossier
            </span>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Reveal className="panel p-6">
            <h3 className="display mb-4 text-3xl">How this map is built</h3>
            <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-ink-2">
              {data.constellation.method.map((m) => <li key={m}>{m}</li>)}
            </ol>
            <p className="mt-4 border-l-2 border-amber/60 pl-3 text-[13px] text-ink-2">
              Distance here reflects shared <em>verified attributes only</em> — it says nothing about tone, quality or how a film feels. Two films by the same
              director will sit close even if you loved one and hated the other.
            </p>
          </Reveal>
          <Reveal className="panel p-6">
            <h3 className="label mb-3">
              Attribute weights
              <InfoTip>How much one shared attribute contributes to similarity. Higher weight = stronger pull between two films sharing it.</InfoTip>
            </h3>
            <table className="w-full text-[13px]">
              <tbody>
                {data.constellation.weights.map((w) => (
                  <tr key={w.feature} className="border-b hairline">
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-2">{w.feature}</th>
                    <td className="w-1/2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 rounded-full bg-amber/80" style={{ width: `${(w.weight / 1.4) * 100}%` }} />
                        <span className="num text-[11px] text-muted">{w.weight}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>

        <div>
          <h3 className="display mb-2 text-3xl">The clusters</h3>
          <p className="mb-6 max-w-3xl text-[14px] text-ink-2">
            Groups found by k-means on the attribute vectors, named after their most over-represented traits. Select one to light it up on the map.
          </p>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clusters.map((c) => {
              const active = selectedCluster === c.id
              return (
                <li key={c.id} className={`panel flex flex-col gap-3 p-5 transition ${active ? 'border-amber/70' : ''}`}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className="text-left"
                    onClick={() => {
                      selectCluster(active ? null : c.id)
                      document.getElementById('constellation')?.scrollIntoView({ block: 'start' })
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="display text-2xl leading-tight">{c.label}</span>
                      <span className="num text-amber">{fmtRating(c.meanRating)}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {c.n} films · {active ? 'shown on map' : 'show on map'}
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {c.traits.map((t) => (
                      <span key={t} className="rounded-full bg-night-3 px-2 py-0.5 text-[11px] text-ink-2">{t}</span>
                    ))}
                  </div>
                  <FilmChips ids={c.filmIds} max={6} />
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Chapter>
  )
}

function Legend({ mode, decades, mean }: { mode: ColorMode; decades: number[]; mean: number }) {
  if (mode === 'rating')
    return (
      <span className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COOL }} />below your {fmtRating(mean)} average</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NEUTRAL }} />near it</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: WARM }} />above it</span>
      </span>
    )
  if (mode === 'decade')
    return (
      <span className="flex items-center gap-1.5">
        <span>{decades[0]}s</span>
        {decades.map((d, i) => (
          <span key={d} className="h-2.5 w-4 rounded-[2px]" title={`${d}s`} style={{ background: heat(0.15 + (0.85 * i) / Math.max(decades.length - 1, 1)) }} />
        ))}
        <span>{decades.at(-1)}s</span>
      </span>
    )
  return (
    <span className="flex items-center gap-3">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: WARM }} />selected cluster</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NEUTRAL }} />other films</span>
      <span className="text-muted">(click a label or card)</span>
    </span>
  )
}
