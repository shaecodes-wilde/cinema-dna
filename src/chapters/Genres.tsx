import { useMemo, useState } from 'react'
import type { GenrePair } from '../../shared/app-types.ts'
import { useData } from '../lib/data.tsx'
import { fmtRating, pct, signed } from '../lib/format.ts'
import { InsightCard } from '../ui/InsightCard.tsx'
import { Chapter, ConfidenceBadge, InfoTip, Reveal, Segmented } from '../ui/primitives.tsx'
import { deltaColor } from './dna/scales.ts'
import { FilmList } from './genres/FilmList.tsx'
import { GenreEvolution } from './genres/GenreEvolution.tsx'
import { GenreScatter } from './genres/GenreScatter.tsx'
import { PairMatrix } from './genres/PairMatrix.tsx'

/** 03 — Genre Universe: exposure vs. love, intersections, and how the mix has shifted. */
export function Genres() {
  const { data, setFilter } = useData()
  const [level, setLevel] = useState<'genre' | 'subgenre'>('genre')
  const [minN, setMinN] = useState(3)
  const [selected, setSelected] = useState<string | null>(null)
  const [pair, setPair] = useState<GenrePair | null>(null)

  const rows = useMemo(() => (data.affinities[level] ?? []).filter((r) => r.n >= minN), [data.affinities, level, minN])
  const sel = rows.find((r) => r.key === selected) ?? null
  const maxN = Math.max(3, ...(data.affinities[level] ?? []).map((r) => r.n))

  const matrixGenres = useMemo(
    () => (data.affinities.genre ?? []).filter((g) => g.n >= 5).sort((a, b) => b.n - a.n).map((g) => g.key),
    [data.affinities],
  )
  const evoGenres = useMemo(() => (data.affinities.genre ?? []).filter((g) => g.n >= 10).sort((a, b) => b.n - a.n).map((g) => g.key), [data.affinities])
  const topPairs = data.genrePairs.filter((p) => p.n >= 5).slice(0, 3)
  const worstPairs = [...data.genrePairs].filter((p) => p.n >= 5).sort((a, b) => a.synergy - b.synergy).slice(0, 2)

  const cards = data.insights.filter(
    (i) => i.id === 'genre-agnostic' || i.id.startsWith('contradiction-') || i.id.startsWith('disappoint-genre') || i.id.startsWith('disappoint-subgenre') || i.id.startsWith('hidden-subgenre'),
  )

  const genreRows = data.affinities.genre ?? []
  const spread = genreRows.filter((g) => g.n >= 10)
  const lo = [...spread].sort((a, b) => a.shrunk - b.shrunk)[0]
  const hi = [...spread].sort((a, b) => b.shrunk - a.shrunk)[0]

  return (
    <Chapter
      id="genres"
      number="03"
      title="Genre Universe"
      kicker="Habit vs. love"
      intro={
        <>
          Every genre you watch, placed by how much of your viewing it fills and how you actually rate it.
          {lo && hi && (
            <>
              {' '}
              Among genres with 10+ films the shrunk averages run from <span className="text-ink">{lo.key}</span> ({fmtRating(lo.shrunk)}) to{' '}
              <span className="text-ink">{hi.key}</span> ({fmtRating(hi.shrunk)}) — a narrow band. The overlaps below show which genre combinations you rate highest.
            </>
          )}
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Segmented
          label="Level"
          value={level}
          onChange={(v) => {
            setLevel(v)
            setSelected(null)
            setMinN(3)
          }}
          options={[
            { value: 'genre', label: 'Genres' },
            { value: 'subgenre', label: 'Sub-genres' },
          ]}
        />
        <label className="flex items-center gap-3 text-[12px] text-ink-2">
          <span className="label">Min. films</span>
          <input type="range" min={1} max={Math.min(20, maxN)} value={minN} onChange={(e) => setMinN(Number(e.target.value))} className="w-36 accent-[#e0a43a]" aria-valuetext={`${minN} films`} />
          <span className="num w-6 text-ink">{minN}</span>
        </label>
        <span className="text-[12px] text-muted">
          {rows.length} {level === 'genre' ? 'genres' : 'sub-genres'} shown
          <InfoTip>
            The y-axis is a <em>shrunk</em> average: each group is pulled toward your overall mean by a few imaginary average films, so a genre with 2 films can't top the
            chart on luck. Vertical whiskers are 90% intervals; colour shows lift above (amber) or below (blue) your average; dot size is the number of films.
          </InfoTip>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Reveal>
          <div className="panel p-3 md:p-5">
            <GenreScatter rows={rows} baseline={data.totals.meanRating} selected={selected} onSelect={(k) => setSelected(k === selected ? null : k)} labelAll={level === 'genre'} />
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t hairline pt-3 text-[12px] text-ink-2">
              <Legend color={deltaColor(0.4)} label="rated above your average" />
              <Legend color={deltaColor(0)} label="about average" />
              <Legend color={deltaColor(-0.4)} label="below your average" />
              <span className="text-muted">size = films · whisker = 90% interval</span>
            </div>
          </div>
        </Reveal>
        <div>
          {sel ? (
            <div className="panel space-y-4 p-5" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="label mb-1">{level === 'genre' ? 'Genre' : 'Sub-genre'}</div>
                  <h3 className="display text-4xl leading-none">{sel.label}</h3>
                </div>
                <button type="button" className="chip" onClick={() => setSelected(null)} aria-label="Clear selection">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Mini value={String(sel.n)} label="films" />
                <Mini value={fmtRating(sel.shrunk)} label="shrunk avg" />
                <Mini value={`${signed(sel.delta)}★`} label="vs you" color={deltaColor(sel.delta)} />
              </div>
              <div className="num text-[12px] text-muted">
                raw {fmtRating(sel.mean)} · SD {sel.sd.toFixed(2)} · {pct(sel.topShare)} at 4.5★+ · {pct(sel.share)} of your ratings
              </div>
              <ConfidenceBadge level={sel.confidence} n={sel.n} />
              <FilmList ids={sel.filmIds} max={25} />
              {level === 'genre' && (
                <button type="button" className="chip" onClick={() => setFilter({ genre: sel.key, status: 'watched' }, { reset: true, scroll: true })}>
                  Open {sel.label} in the explorer →
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-[3px] border border-dashed border-line-2 p-6 text-[14px] leading-relaxed text-muted">
              Click any bubble to see the films behind it — ranked, sortable and one click from their full dossier.
            </div>
          )}
        </div>
      </div>

      {/* Intersections */}
      <div className="mt-20 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <div className="label mb-2">Genre intersections</div>
          <h3 className="display mb-3 text-4xl">Where two genres overlap</h3>
          <p className="mb-5 max-w-2xl text-[14px] text-ink-2">
            Each cell is a pair of genres. Amber means films carrying both rate above your overall average; blue means below.
            Numbers are film counts; empty cells have fewer than 3 films.
            <InfoTip>
              Shrunk average of films with both genres minus your overall average, the same measure as the genre bars. Each genre's own average includes these films, so this
              shows which overlaps you rate highly, not whether combining them adds anything.
            </InfoTip>
          </p>
          <div className="panel p-4">
            <PairMatrix genres={matrixGenres} pairs={data.genrePairs} selected={pair} onSelect={setPair} />
          </div>
        </div>
        <div className="space-y-4 lg:pt-28">
          {pair ? (
            <div className="panel space-y-4 p-5" aria-live="polite">
              <div className="label">Pair</div>
              <h4 className="display text-3xl">
                {pair.a} × {pair.b}
              </h4>
              <div className="num text-[13px] text-ink-2">
                {pair.n} films · {fmtRating(pair.mean)} raw · {fmtRating(pair.shrunk)} shrunk ·{' '}
                <span style={{ color: deltaColor(pair.synergy, 0.35) }}>{signed(pair.synergy)}★ vs your average</span>
              </div>
              <FilmList ids={pair.filmIds} max={15} />
            </div>
          ) : (
            <>
              <PairList title="Highest-rated overlaps" pairs={topPairs} onSelect={setPair} />
              <PairList title="Lowest-rated overlaps" pairs={worstPairs} onSelect={setPair} />
            </>
          )}
        </div>
      </div>

      {/* Evolution */}
      {data.timeline.years.length >= 2 && (
        <div className="mt-20">
          <div className="label mb-2">Shifting tastes</div>
          <h3 className="display mb-3 text-4xl">The genre mix, year by year</h3>
          <p className="mb-5 max-w-2xl text-[14px] text-ink-2">
            Share of the films you watched each calendar year (by diary date, not release date) that carry each genre. A film can count toward several genres. Click a panel to
            inspect that genre above.
          </p>
          <GenreEvolution
            years={data.timeline.years}
            genres={evoGenres}
            selected={level === 'genre' ? selected : null}
            onSelect={(g) => {
              setLevel('genre')
              setSelected(g)
              setMinN(1)
              document.getElementById('genres')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-20">
          <div className="label mb-5">Outliers & contradictions</div>
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((i, k) => (
              <Reveal key={i.id} delay={(k % 2) * 0.06}>
                <InsightCard insight={i} />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </Chapter>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function Mini({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-[3px] border border-line bg-night p-2">
      <div className="num text-xl" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="label mt-1 text-[10px]">{label}</div>
    </div>
  )
}

function PairList({ title, pairs, onSelect }: { title: string; pairs: GenrePair[]; onSelect: (p: GenrePair) => void }) {
  if (!pairs.length) return null
  return (
    <div className="panel p-5">
      <div className="label mb-3">{title}</div>
      <ul className="space-y-1">
        {pairs.map((p) => (
          <li key={`${p.a}|${p.b}`}>
            <button type="button" onClick={() => onSelect(p)} className="flex w-full items-baseline justify-between gap-3 border-b hairline py-2 text-left text-[14px] hover:text-amber">
              <span>
                {p.a} × {p.b} <span className="num text-[11px] text-muted">n={p.n}</span>
              </span>
              <span className="num" style={{ color: deltaColor(p.synergy, 0.35) }} aria-label={`${signed(p.synergy)} stars vs your average`}>
                {signed(p.synergy)}★ vs avg
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
