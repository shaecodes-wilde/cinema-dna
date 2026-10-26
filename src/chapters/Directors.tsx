import { useMemo, useState } from 'react'
import type { AffinityRow } from '../../shared/app-types.ts'
import { useData } from '../lib/data.tsx'
import { fmtRating, fmtStars, signed } from '../lib/format.ts'
import { InsightCard } from '../ui/InsightCard.tsx'
import { Chapter, ConfidenceBadge, InfoTip, Poster, Reveal, Segmented } from '../ui/primitives.tsx'
import { deltaColor } from './dna/scales.ts'
import { DotStrip } from './directors/DotStrip.tsx'
import { LoyaltyMap } from './directors/LoyaltyMap.tsx'
import { FilmList } from './genres/FilmList.tsx'

type Role = 'director' | 'writer' | 'cinematographer' | 'composer' | 'cast'
const ROLES: { value: Role; label: string; noun: string }[] = [
  { value: 'director', label: 'Directors', noun: 'directors' },
  { value: 'writer', label: 'Writers', noun: 'writers' },
  { value: 'cinematographer', label: 'Cinematographers', noun: 'cinematographers' },
  { value: 'composer', label: 'Composers', noun: 'composers' },
  { value: 'cast', label: 'Cast', noun: 'actors' },
]
type Sort = 'affinity' | 'films' | 'consistency'
const PAGE = 18

/** 05 — Director's Gallery (and the other creative roles). */
export function Directors() {
  const { data, setFilter, film } = useData()
  const [role, setRole] = useState<Role>('director')
  const [sort, setSort] = useState<Sort>('affinity')
  const [includeSingles, setIncludeSingles] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const base = data.totals.meanRating
  const allRows = useMemo(() => data.affinities[role] ?? [], [data.affinities, role])
  const rows = useMemo(() => {
    const min = role === 'director' && includeSingles ? 1 : role === 'cast' ? 3 : 2
    const rs = allRows.filter((r) => r.n >= min)
    return rs.sort((a, b) =>
      sort === 'affinity' ? b.shrunk - a.shrunk || b.n - a.n : sort === 'films' ? b.n - a.n || b.shrunk - a.shrunk : a.sd - b.sd || b.n - a.n,
    )
  }, [allRows, role, includeSingles, sort])
  const mapRows = useMemo(() => allRows.filter((r) => r.n >= (role === 'cast' ? 3 : 2)), [allRows, role])
  const sel = allRows.find((r) => r.key === selected) ?? null
  const noun = ROLES.find((r) => r.value === role)!.noun
  const loyalty = data.insights.find((i) => i.id === 'director-loyalty')
  const crew = data.insights.find((i) => i.id === 'below-the-line')
  const multi = (data.affinities.director ?? []).filter((d) => d.n >= 2)

  const pick = (key: string) => {
    setSelected(key === selected ? null : key)
    if (key !== selected) requestAnimationFrame(() => document.getElementById('person-spotlight')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  return (
    <Chapter
      id="directors"
      number="05"
      title="Director's Gallery"
      kicker="Loyalty vs. love"
      intro={
        <>
          The filmmakers you keep returning to, and the ones who actually deliver. {multi.length} directors appear at least twice in your library. Each card shows every rated
          film as a dot on the star scale, against the vertical line of your {fmtRating(base)} average.
        </>
      }
    >
      {loyalty && (
        <Reveal>
          <div className="mb-12 max-w-4xl">
            <InsightCard insight={loyalty} />
          </div>
        </Reveal>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Segmented
          label="Creative role"
          value={role}
          onChange={(v) => {
            setRole(v)
            setSelected(null)
            setLimit(PAGE)
          }}
          options={ROLES.map(({ value, label }) => ({ value, label }))}
        />
        <Segmented
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'affinity', label: 'Most loved' },
            { value: 'films', label: 'Most watched' },
            { value: 'consistency', label: 'Most consistent' },
          ]}
        />
        {role === 'director' && (
          <label className="flex items-center gap-2 text-[12px] text-ink-2">
            <input type="checkbox" checked={includeSingles} onChange={(e) => setIncludeSingles(e.target.checked)} className="accent-[#e0a43a]" />
            include one-film directors
          </label>
        )}
        <span className="text-[12px] text-muted">
          {rows.length} {noun}
          <InfoTip>
            "Shrunk" averages pull each person toward your overall mean by 3 imaginary average films, so one great film can't crown someone. SD (standard deviation) measures
            consistency: under ~0.4★ means you rate their films very similarly; above ~0.7★ means a mixed record.
          </InfoTip>
        </span>
      </div>

      {mapRows.length >= 3 && (
        <Reveal>
          <div className="panel mb-10 p-4">
            <div className="label mb-2 px-2">Loyalty vs. love · {noun} with {role === 'cast' ? 3 : 2}+ films</div>
            <LoyaltyMap rows={mapRows} baseline={base} selected={selected} onSelect={pick} noun={noun} />
          </div>
        </Reveal>
      )}

      {sel && (
        <div id="person-spotlight" className="panel mb-10 grid grid-cols-1 gap-8 p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-live="polite">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="label mb-1">{ROLES.find((r) => r.value === role)!.label.replace(/s$/, '')}</div>
                <h3 className="display text-5xl leading-none">{sel.key}</h3>
              </div>
              <button type="button" className="chip" onClick={() => setSelected(null)} aria-label="Close spotlight">
                ✕
              </button>
            </div>
            <div className="num text-[13px] text-ink-2">
              {sel.n} rated films · raw {fmtRating(sel.mean)} · shrunk {fmtRating(sel.shrunk)} · <span style={{ color: deltaColor(sel.delta) }}>{signed(sel.delta)}★</span> vs you · SD{' '}
              {sel.sd.toFixed(2)}
            </div>
            <ConfidenceBadge level={sel.confidence} n={sel.n} />
            <DotStrip filmIds={sel.filmIds} label={sel.key} />
            <button type="button" className="chip" onClick={() => setFilter({ person: sel.key, status: 'all' }, { reset: true, scroll: true })}>
              Open {sel.key} in the explorer →
            </button>
          </div>
          <div className="space-y-5">
            <div className="scroll-thin flex gap-3 overflow-x-auto pb-2">
              {sel.filmIds.slice(0, 8).map((id) => {
                const f = film(id)
                return f ? <Poster key={id} film={f} size="sm" /> : null
              })}
            </div>
            <FilmList ids={sel.filmIds} max={12} />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.slice(0, limit).map((r, i) => (
          <PersonCard key={r.key} row={r} rank={i + 1} selected={selected === r.key} onSelect={() => pick(r.key)} />
        ))}
      </div>
      {rows.length > limit && (
        <div className="mt-6 text-center">
          <button type="button" className="chip" onClick={() => setLimit(limit + PAGE * 2)}>
            Show more {noun} ({rows.length - limit} left)
          </button>
        </div>
      )}

      {crew && role !== 'director' && role !== 'cast' && (
        <div className="mt-12 max-w-4xl">
          <InsightCard insight={crew} />
        </div>
      )}
    </Chapter>
  )
}

function PersonCard({ row, rank, selected, onSelect }: { row: AffinityRow; rank: number; selected: boolean; onSelect: () => void }) {
  const { film } = useData()
  const best = row.filmIds.map(film).find((f) => f && f.rating !== null)
  const consistency = row.n < 2 ? 'single film' : row.sd <= 0.4 ? 'consistent' : row.sd >= 0.7 ? 'uneven' : 'mixed'
  return (
    <article className={`panel flex flex-col gap-3 p-5 transition ${selected ? 'border-amber/70' : 'hover:border-line-2'}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="num text-[11px] text-faint">#{rank}</div>
          <h3 className="display truncate text-[28px] leading-tight hover:text-amber">{row.key}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-2xl leading-none" style={{ color: deltaColor(row.delta) }}>
            {signed(row.delta)}
          </div>
          <div className="label mt-1 text-[10px]">vs you</div>
        </div>
      </button>
      <div className="num flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span>
          <span className="text-ink">{row.n}</span> films
        </span>
        <span>
          avg <span className="text-ink">{fmtRating(row.mean)}</span>
        </span>
        <span>
          SD <span className="text-ink">{row.sd.toFixed(2)}</span> · {consistency}
        </span>
      </div>
      <DotStrip filmIds={row.filmIds} label={row.key} />
      {best && (
        <div className="truncate text-[12px] text-muted">
          Top: <span className="text-ink-2">{best.title}</span> <span className="num">{fmtStars(best.rating)}</span>
        </div>
      )}
    </article>
  )
}
