import { useMemo, useState } from 'react'
import { EMPTY_FILTER, useData, type ExplorerFilter } from '../lib/data.tsx'
import { fmtDate, fmtStars, ratingColor } from '../lib/format.ts'
import { Chapter, Empty } from '../ui/primitives.tsx'
import { STATUS_LABEL, applyFilter, sortFilms, toCsv, watchYears, type SortKey } from './explorer/filtering.ts'

const PAGE = 40

const COLUMNS: { key: SortKey; label: string; className?: string; numeric?: boolean }[] = [
  { key: 'title', label: 'Film' },
  { key: 'rating', label: 'Rating', numeric: true },
  { key: 'predicted', label: 'Model', numeric: true, className: 'hidden md:table-cell' },
  { key: 'firstWatched', label: 'First watched', className: 'hidden sm:table-cell' },
  { key: 'viewings', label: 'Views', numeric: true, className: 'hidden md:table-cell' },
  { key: 'runtime', label: 'Runtime', numeric: true, className: 'hidden lg:table-cell' },
  { key: 'director', label: 'Director', className: 'hidden lg:table-cell' },
]

/** ∞ — Film Explorer. Filters live in global context so every chart can drill down here. */
export function Explorer() {
  const { data, filter, setFilter, openFilm } = useData()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rating', dir: -1 })
  const [page, setPage] = useState(0)
  // Reset to the first page whenever the filter changes (including drill-downs from other chapters).
  const [seenFilter, setSeenFilter] = useState(filter)
  if (seenFilter !== filter) {
    setSeenFilter(filter)
    setPage(0)
  }
  const years = useMemo(() => watchYears(data.viewings), [data.viewings])
  const { meanRating: mean, sdRating: sd } = data.totals

  const options = useMemo(() => {
    const genres = [...new Set(data.films.flatMap((f) => f.genres))].sort()
    const decades = [...new Set(data.films.map((f) => f.decade).filter((d): d is number => d !== null))].sort((a, b) => b - a)
    const counts = new Map<string, number>()
    for (const f of data.films) for (const p of new Set([...f.directors, ...f.writers, ...f.cast, ...f.cinematographers, ...f.composers])) counts.set(p, (counts.get(p) ?? 0) + 1)
    const people = [...counts].filter(([, n]) => n >= 2).map(([p]) => p).sort()
    const watchedYears = [...new Set([...years.values()].flatMap((s) => [...s]))].sort((a, b) => b - a)
    return { genres, decades, people, watchedYears }
  }, [data.films, years])

  const rows = useMemo(() => sortFilms(applyFilter(data.films, filter, years), sort.key, sort.dir), [data.films, filter, years, sort])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE)

  const update = (f: Partial<ExplorerFilter>) => setFilter(f)
  const active: { label: string; clear: Partial<ExplorerFilter> }[] = [
    ...(filter.query ? [{ label: `“${filter.query}”`, clear: { query: '' } }] : []),
    ...(filter.status !== EMPTY_FILTER.status ? [{ label: STATUS_LABEL[filter.status], clear: { status: EMPTY_FILTER.status } }] : []),
    ...(filter.genre ? [{ label: filter.genre, clear: { genre: null } }] : []),
    ...(filter.person ? [{ label: filter.person, clear: { person: null } }] : []),
    ...(filter.decade !== null ? [{ label: `${filter.decade}s`, clear: { decade: null } }] : []),
    ...(filter.minRating > 0 ? [{ label: `≥ ${fmtStars(filter.minRating)}`, clear: { minRating: 0 } }] : []),
    ...(filter.watchedYear !== null ? [{ label: `watched in ${filter.watchedYear}`, clear: { watchedYear: null } }] : []),
  ]

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `cinema-dna-films-${rows.length}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'title' || key === 'director' ? 1 : -1 }))
  const field = 'rounded-[3px] border border-line-2 bg-night-2 px-2.5 py-1.5 text-[13px] text-ink focus:border-amber w-full'

  return (
    <Chapter
      id="explorer"
      number="∞"
      title="Film Explorer"
      kicker="Every record, searchable"
      intro={<>Every film in your export — watched, watchlisted or listed — with the numbers behind every chart. Click a genre, director or bar anywhere above and it lands here, filtered.</>}
    >
      <div className="panel mb-6 space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="label">Search title, director or cast</span>
            <input type="search" className={field} value={filter.query} placeholder="e.g. Varda, Paddington…" onChange={(e) => update({ query: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Status</span>
            <select className={field} value={filter.status} onChange={(e) => update({ status: e.target.value as ExplorerFilter['status'] })}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Minimum rating</span>
            <select className={field} value={filter.minRating} onChange={(e) => update({ minRating: Number(e.target.value) })}>
              <option value={0}>Any</option>
              {[1, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => (
                <option key={r} value={r}>
                  {fmtStars(r)} or higher
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Genre</span>
            <select className={field} value={filter.genre ?? ''} onChange={(e) => update({ genre: e.target.value || null })}>
              <option value="">Any</option>
              {options.genres.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Person</span>
            <input
              className={field}
              list="explorer-people"
              value={filter.person ?? ''}
              placeholder="Any director, writer, actor…"
              onChange={(e) => update({ person: e.target.value || null })}
            />
            <datalist id="explorer-people">
              {options.people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Release decade</span>
            <select className={field} value={filter.decade ?? ''} onChange={(e) => update({ decade: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any</option>
              {options.decades.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Watched in</span>
            <select className={field} value={filter.watchedYear ?? ''} onChange={(e) => update({ watchedYear: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any year</option>
              {options.watchedYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[13px] text-ink" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'film' : 'films'}
          </span>
          {active.map((a) => (
            <button key={a.label} type="button" className="chip" aria-pressed="true" onClick={() => update(a.clear)} aria-label={`Remove filter ${a.label}`}>
              {a.label} <span aria-hidden>✕</span>
            </button>
          ))}
          {active.length > 0 && (
            <button type="button" className="text-[12px] text-muted underline decoration-line-2 underline-offset-4 hover:text-amber" onClick={() => setFilter({}, { reset: true })}>
              clear all
            </button>
          )}
          <button type="button" className="chip ml-auto" onClick={exportCsv} disabled={!rows.length}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty>No films match. Try clearing a filter.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line-2 text-left">
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    className={`py-2 pr-4 font-normal ${c.numeric ? 'text-right' : ''} ${c.className ?? ''}`}
                  >
                    <button type="button" className={`label transition hover:text-amber ${sort.key === c.key ? 'text-amber' : ''}`} onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span aria-hidden className="ml-1">
                        {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr
                  key={f.id}
                  tabIndex={0}
                  onClick={() => openFilm(f.id)}
                  onKeyDown={(e) => e.key === 'Enter' && openFilm(f.id)}
                  className="cursor-pointer border-b hairline transition hover:bg-night-3 focus:bg-night-3 focus:outline-none"
                  aria-label={`${f.title}${f.year ? ` (${f.year})` : ''} — open details`}
                >
                  <td className="py-2.5 pr-4">
                    <span className="text-ink">{f.title}</span>
                    {f.year && <span className="text-muted"> ({f.year})</span>}
                    <span className="ml-2 inline-flex gap-1 align-middle text-[11px] text-muted">
                      {f.liked && <span title="Liked">♥</span>}
                      {f.favorite && <span title="Profile favourite" className="text-amber">★</span>}
                      {f.rewatchCount > 0 && <span title="Rewatched">↻</span>}
                      {f.inWatchlist && !f.watched && <span title="On watchlist">◷</span>}
                      {!f.matched && <span title="No metadata match">∅</span>}
                    </span>
                    <div className="truncate text-[11px] text-faint">{f.genres.slice(0, 3).join(' · ')}</div>
                  </td>
                  <td className="num py-2.5 pr-4 text-right">
                    {f.rating !== null ? (
                      <span className="rounded-[2px] px-1.5 py-0.5 text-night" style={{ background: ratingColor(f.rating, mean, sd) }}>
                        {fmtStars(f.rating)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="num hidden py-2.5 pr-4 text-right text-ink-2 md:table-cell">{f.predicted !== null ? f.predicted.toFixed(1) : '—'}</td>
                  <td className="hidden py-2.5 pr-4 text-ink-2 sm:table-cell">{f.firstWatched ? fmtDate(f.firstWatched) : '—'}</td>
                  <td className="num hidden py-2.5 pr-4 text-right text-ink-2 md:table-cell">{f.viewingCount || '—'}</td>
                  <td className="num hidden py-2.5 pr-4 text-right text-ink-2 lg:table-cell">{f.runtime ? `${f.runtime}′` : '—'}</td>
                  <td className="hidden max-w-[200px] truncate py-2.5 pr-4 text-ink-2 lg:table-cell">{f.directors.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <nav aria-label="Explorer pages" className="mt-5 flex items-center justify-between text-[13px]">
              <button type="button" className="chip" disabled={current === 0} onClick={() => setPage(current - 1)}>
                ← Previous
              </button>
              <span className="num text-muted">
                {current * PAGE + 1}–{Math.min(rows.length, (current + 1) * PAGE)} of {rows.length}
              </span>
              <button type="button" className="chip" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next →
              </button>
            </nav>
          )}
          <p className="mt-4 text-[11px] text-faint">♥ liked · ★ profile favourite · ↻ rewatched · ◷ on watchlist · ∅ no metadata match · Model = cross-validated taste-model prediction</p>
        </div>
      )}
    </Chapter>
  )
}
