import type { AppData } from '../../../shared/app-types.ts'
import { useData } from '../../lib/data.tsx'
import { heat, pct } from '../../lib/format.ts'
import { useTooltip } from '../../ui/primitives.tsx'

/** Share of each year's films carrying a genre (a film can carry several genres). */
export function GenreDrift({ years }: { years: AppData['timeline']['years'] }) {
  const { setFilter } = useData()
  const tip = useTooltip()
  const genres = [...new Set(years.flatMap((y) => Object.keys(y.genreShares)))]
    .map((g) => ({ g, total: years.reduce((a, y) => a + (y.genreShares[g] ?? 0), 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((x) => x.g)
  const max = Math.max(...years.flatMap((y) => Object.values(y.genreShares)))

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-[12px]">
        <caption className="sr-only">Genre share of films watched each year</caption>
        <thead>
          <tr>
            <th className="label text-left font-normal">Genre</th>
            {years.map((y) => (
              <th key={y.year} className="num text-center font-normal text-muted">
                {y.year}
              </th>
            ))}
            <th className="label text-right font-normal">Shift</th>
          </tr>
        </thead>
        <tbody>
          {genres.map((g) => {
            const first = years[0].genreShares[g] ?? 0
            const last = years.at(-1)!.genreShares[g] ?? 0
            const shift = last - first
            return (
              <tr key={g}>
                <th scope="row" className="pr-3 text-left font-normal">
                  <button type="button" className="text-ink-2 transition hover:text-amber" onClick={() => setFilter({ genre: g, status: 'watched' }, { reset: true, scroll: true })}>
                    {g}
                  </button>
                </th>
                {years.map((y) => {
                  const s = y.genreShares[g] ?? 0
                  return (
                    <td
                      key={y.year}
                      className="num h-8 rounded-[2px] text-center"
                      style={{ background: heat(s / max), color: s / max > 0.55 ? '#1a1408' : '#c9c1b4' }}
                      onMouseMove={(e) => tip.show(<span>{g} · {y.year}: {pct(s)} of the films you watched that year</span>, e)}
                      onMouseLeave={tip.hide}
                    >
                      {pct(s)}
                    </td>
                  )
                })}
                <td className={`num pl-2 text-right ${Math.abs(shift) < 0.05 ? 'text-muted' : 'text-ink'}`}>
                  {shift > 0 ? '▲' : shift < 0 ? '▼' : ''} {Math.round(Math.abs(shift) * 100)} pts
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
