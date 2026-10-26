import { useMemo, useState } from 'react'
import type { Recommendation } from '../../shared/app-types.ts'
import { useData } from '../lib/data.tsx'
import { Chapter, Empty, InfoTip, Reveal, Segmented } from '../ui/primitives.tsx'
import { RecCard } from './next/RecCard.tsx'

type Source = 'both' | 'watchlist' | 'discovery'
type Runtime = 'any' | 'short' | 'standard' | 'long' | 'epic'
type Familiarity = 'any' | 'familiar' | 'stretch' | 'new'

const RUNTIMES: Record<Runtime, { label: string; test: (m: number | null) => boolean }> = {
  any: { label: 'Any length', test: () => true },
  short: { label: 'Under 100 min', test: (m) => m !== null && m < 100 },
  standard: { label: '100–129 min', test: (m) => m !== null && m >= 100 && m < 130 },
  long: { label: '130–159 min', test: (m) => m !== null && m >= 130 && m < 160 },
  epic: { label: '160+ min', test: (m) => m !== null && m >= 160 },
}
const FAMILIARITY: Record<Familiarity, { label: string; test: (n: number) => boolean }> = {
  any: { label: 'Any', test: () => true },
  familiar: { label: 'Familiar ground', test: (n) => n < 0.4 },
  stretch: { label: 'A stretch', test: (n) => n >= 0.4 && n < 0.6 },
  new: { label: 'New territory', test: (n) => n >= 0.6 },
}

const PAGE = 24

/** Adventurousness re-ranks: predicted rating plus a bonus (or penalty) for novelty. */
export const rankScore = (r: Recommendation, adventure: number) => r.predicted + adventure * (r.novelty - 0.5) * 1.2

/** 09 — Discover Your Next Favourite. */
export function Next() {
  const { data } = useData()
  const recs = data.recommendations
  const [source, setSource] = useState<Source>('both')
  const [mood, setMood] = useState<string | null>(null)
  const [genre, setGenre] = useState('')
  const [runtime, setRuntime] = useState<Runtime>('any')
  const [decade, setDecade] = useState('')
  const [familiarity, setFamiliarity] = useState<Familiarity>('any')
  const [adventure, setAdventure] = useState(0)
  const [hideUncertain, setHideUncertain] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const options = useMemo(() => {
    const count = (xs: string[]) => {
      const m = new Map<string, number>()
      xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1))
      return [...m].sort((a, b) => b[1] - a[1])
    }
    return {
      moods: count(recs.flatMap((r) => r.moods)),
      genres: count(recs.flatMap((r) => r.genres)),
      decades: [...new Set(recs.map((r) => r.decade).filter((d): d is number => d !== null))].sort((a, b) => b - a),
    }
  }, [recs])

  const ranked = useMemo(
    () =>
      recs
        .filter((r) => source === 'both' || r.source === source)
        .filter((r) => !mood || r.moods.includes(mood))
        .filter((r) => !genre || r.genres.includes(genre))
        .filter((r) => RUNTIMES[runtime].test(r.runtime))
        .filter((r) => !decade || r.decade === Number(decade))
        .filter((r) => FAMILIARITY[familiarity].test(r.novelty))
        .filter((r) => !hideUncertain || !r.uncertain)
        .map((r) => ({ r, score: rankScore(r, adventure) }))
        .sort((a, b) => b.score - a.score),
    [recs, source, mood, genre, runtime, decade, familiarity, hideUncertain, adventure],
  )
  const wlCount = recs.filter((r) => r.source === 'watchlist').length
  const reset = () => {
    setSource('both')
    setMood(null)
    setGenre('')
    setRuntime('any')
    setDecade('')
    setFamiliarity('any')
    setAdventure(0)
    setHideUncertain(false)
    setShown(PAGE)
  }
  const selectCls = 'rounded-[3px] border border-line-2 bg-night-2 px-2.5 py-1.5 text-[13px] text-ink focus:border-amber'

  return (
    <Chapter
      id="next"
      number="09"
      title="Your Next Favourite"
      kicker="Recommendation engine"
      intro={
        <>
          {recs.length} real films scored by your taste model: {wlCount} unwatched titles from your watchlist, plus {recs.length - wlCount} discoveries pulled from Wikidata through the people whose
          work you rate above your average and the major-award canon. Anything you've already watched is excluded. Every pick explains itself.
        </>
      }
    >
      <Reveal>
        <div className="panel mb-10 space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Segmented<Source>
              label="Source"
              value={source}
              onChange={(v) => {
                setSource(v)
                setShown(PAGE)
              }}
              options={[
                { value: 'both', label: 'Everything' },
                { value: 'watchlist', label: 'From my watchlist' },
                { value: 'discovery', label: 'New discoveries' },
              ]}
            />
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={hideUncertain} onChange={(e) => setHideUncertain(e.target.checked)} className="accent-[#e0a43a]" />
              Hide uncertain matches
            </label>
          </div>
          <div role="group" aria-label="Mood" className="flex flex-wrap items-center gap-1.5">
            <span className="label mr-2">Mood</span>
            {options.moods.map(([m, n]) => (
              <button key={m} type="button" className="chip" aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)}>
                {m} <span className="num text-[10px] opacity-60">{n}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="label">Genre</span>
              <select className={selectCls} value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Any genre</option>
                {options.genres.map(([g, n]) => (
                  <option key={g} value={g}>
                    {g} ({n})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Runtime</span>
              <select className={selectCls} value={runtime} onChange={(e) => setRuntime(e.target.value as Runtime)}>
                {Object.entries(RUNTIMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Decade</span>
              <select className={selectCls} value={decade} onChange={(e) => setDecade(e.target.value)}>
                <option value="">Any decade</option>
                {options.decades.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">
                Familiarity
                <InfoTip>Based on each film's novelty score: how rarely its genres, decade, region and language appear in what you've already watched.</InfoTip>
              </span>
              <select className={selectCls} value={familiarity} onChange={(e) => setFamiliarity(e.target.value as Familiarity)}>
                {Object.entries(FAMILIARITY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid items-center gap-3 md:grid-cols-[auto_1fr_auto]">
            <label htmlFor="adventure" className="label">
              Adventurousness
              <InfoTip>
                Ranking score = predicted rating + adventurousness × (novelty − 0.5) × 1.2. At 0 the list is pure taste-model prediction; pushing right rewards films far from your usual territory, pushing
                left favours familiar ground.
              </InfoTip>
            </label>
            <div className="flex items-center gap-3 text-[12px] text-muted">
              <span>Comfort</span>
              <input
                id="adventure"
                type="range"
                min={-1}
                max={1}
                step={0.1}
                value={adventure}
                onChange={(e) => setAdventure(Number(e.target.value))}
                className="w-full accent-[#e0a43a]"
                aria-valuetext={adventure === 0 ? 'neutral' : adventure > 0 ? `adventurous ${adventure}` : `comfort ${-adventure}`}
              />
              <span>Adventure</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-[13px] text-ink-2">{adventure > 0 ? '+' : ''}{adventure.toFixed(1)}</span>
              <button type="button" className="chip" onClick={reset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mb-5 flex items-baseline justify-between">
        <p className="text-[13px] text-muted" aria-live="polite">
          {ranked.length} films match · showing {Math.min(shown, ranked.length)}
        </p>
        <p className="hidden text-[12px] text-faint md:block">Predicted ratings are cross-validated estimates (typical miss ±{data.model.cvMae.toFixed(1)}★).</p>
      </div>
      {ranked.length === 0 ? (
        <Empty>No films match these filters.</Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ranked.slice(0, shown).map(({ r, score }, i) => (
            <RecCard key={r.key} rec={r} rank={i + 1} score={score} />
          ))}
        </div>
      )}
      {shown < ranked.length && (
        <div className="mt-8 text-center">
          <button type="button" className="chip px-5 py-2" onClick={() => setShown(shown + PAGE)}>
            Show {Math.min(PAGE, ranked.length - shown)} more
          </button>
        </div>
      )}
    </Chapter>
  )
}
