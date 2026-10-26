import { useMemo, useState } from 'react'
import { useData } from '../../lib/data.tsx'
import { fmtStars, ratingColor } from '../../lib/format.ts'
import { Segmented } from '../../ui/primitives.tsx'

/** Sortable list of films (rating / year / title); rows open the film drawer. */
export function FilmList({ ids, max = 40 }: { ids: string[]; max?: number }) {
  const { film, openFilm, data } = useData()
  const [sort, setSort] = useState<'rating' | 'year' | 'title'>('rating')
  const [all, setAll] = useState(false)
  const films = useMemo(() => {
    const fs = ids.map(film).filter((f) => !!f)
    return fs.sort((a, b) =>
      sort === 'rating' ? (b!.rating ?? 0) - (a!.rating ?? 0) || (b!.year ?? 0) - (a!.year ?? 0) : sort === 'year' ? (b!.year ?? 0) - (a!.year ?? 0) : a!.title.localeCompare(b!.title),
    )
  }, [ids, film, sort])
  const shown = all ? films : films.slice(0, max)
  return (
    <div className="space-y-3">
      <Segmented
        label="Sort films"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'rating', label: 'Rating' },
          { value: 'year', label: 'Year' },
          { value: 'title', label: 'A–Z' },
        ]}
      />
      <ul className="scroll-thin max-h-[420px] overflow-y-auto pr-1">
        {shown.map((f) => (
          <li key={f!.id}>
            <button
              type="button"
              onClick={() => openFilm(f!.id)}
              className="flex w-full items-center gap-3 border-b hairline py-2 text-left text-[13px] transition hover:bg-night-3"
            >
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: ratingColor(f!.rating, data.totals.meanRating, data.totals.sdRating) }} />
              <span className="min-w-0 flex-1 truncate text-ink">{f!.title}</span>
              <span className="num shrink-0 text-muted">{f!.year ?? ''}</span>
              <span className="num w-10 shrink-0 text-right text-ink-2">{fmtStars(f!.rating)}</span>
            </button>
          </li>
        ))}
      </ul>
      {films.length > max && (
        <button type="button" className="chip text-muted" onClick={() => setAll(!all)}>
          {all ? 'show fewer' : `show all ${films.length}`}
        </button>
      )}
    </div>
  )
}
