import type { Recommendation } from '../../../shared/app-types.ts'
import { useData } from '../../lib/data.tsx'
import { fmtRating, ratingColor } from '../../lib/format.ts'
import { FilmChip } from '../../ui/primitives.tsx'

export function RecCard({ rec, rank, score }: { rec: Recommendation; rank: number; score: number }) {
  const { data, openFilm } = useData()
  const meta = [rec.year, rec.runtime ? `${rec.runtime} min` : null, rec.directors.slice(0, 2).join(' & ') || null].filter(Boolean).join(' · ')
  const title = (
    <span className="display text-[28px] leading-[1.02] text-ink transition group-hover/title:text-amber">
      {rec.title}
    </span>
  )
  return (
    <article className="panel flex flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="num text-[11px] text-faint">#{rank}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${rec.source === 'watchlist' ? 'border-amber/60 text-amber' : 'border-line-2 text-ink-2'}`}
            >
              {rec.source === 'watchlist' ? 'On your watchlist' : 'New discovery'}
            </span>
          </div>
          {rec.filmId ? (
            <button type="button" className="group/title text-left" onClick={() => openFilm(rec.filmId!)}>
              {title}
            </button>
          ) : rec.wikidataId ? (
            <a className="group/title" href={`https://www.wikidata.org/wiki/${rec.wikidataId}`} target="_blank" rel="noreferrer" title="Open the Wikidata record">
              {title}
            </a>
          ) : (
            title
          )}
          <div className="mt-1 text-[13px] text-muted">{meta}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-3xl leading-none" style={{ color: ratingColor(rec.predicted, data.totals.meanRating, data.totals.sdRating) }}>
            {fmtRating(rec.predicted, 1)}
          </div>
          <div className="label mt-1 text-[9px]">predicted</div>
          <div className="mt-2 flex items-center justify-end gap-1.5" title={`Novelty ${Math.round(rec.novelty * 100)}/100 — how far this sits from what you usually watch`}>
            <span className="text-[10px] text-muted">novelty</span>
            <span className="h-1 w-12 overflow-hidden rounded-full bg-line-2" aria-hidden>
              <span className="block h-full bg-ink-2" style={{ width: `${rec.novelty * 100}%` }} />
            </span>
          </div>
          {Math.abs(score - rec.predicted) > 0.005 && <div className="num mt-1 text-[10px] text-faint">rank score {score.toFixed(2)}</div>}
        </div>
      </header>

      {rec.uncertain && (
        <div className="rounded-[3px] border border-ember/50 bg-ember/10 px-3 py-2 text-[12px] text-ink-2" role="note">
          <span className="font-semibold text-ember">Uncertain · </span>
          {rec.uncertainty.join('; ')}
        </div>
      )}

      {rec.reasons.length > 0 && (
        <ul className="space-y-1.5 text-[13px] leading-snug text-ink-2">
          {rec.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className={r.startsWith('Caveat') ? 'text-[#6da7ec]' : 'text-amber'}>
                {r.startsWith('Caveat') ? '–' : '+'}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {rec.becauseFilmIds.length > 0 && (
        <div>
          <div className="label mb-1.5">Because you liked</div>
          <div className="flex flex-wrap gap-1.5">
            {rec.becauseFilmIds.map((id) => (
              <FilmChip key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      <footer className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t hairline pt-3 text-[11px] text-muted">
        {rec.genres.slice(0, 4).join(' / ')}
        {rec.moods.length > 0 && <span className="text-faint">· {rec.moods.slice(0, 3).join(' · ')}</span>}
        {rec.source === 'discovery' && rec.via.length > 0 && <span className="w-full text-faint">Found via: {rec.via.slice(0, 3).join('; ')}</span>}
      </footer>
    </article>
  )
}
