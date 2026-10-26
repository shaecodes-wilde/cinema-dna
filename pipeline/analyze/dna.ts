import type { DnaDimension } from '../../shared/app-types.ts'
import type { AnalysisContext } from './index.ts'
import type { FilmRecord } from './features.ts'
import { releaseLag } from './features.ts'
import { evenness, mean, proportionConfidence, round, shrink } from './stats.ts'

/**
 * Cinematic DNA: 12 transparent dimensions. Each score is a plain percentage or index
 * (definition shown in the UI) — not a black box. `affinity` is the shrunk rating lift
 * of films that carry the trait, so the radar can contrast "what you watch" with "what you love".
 */
export function buildDna(ctx: AnalysisContext): DnaDimension[] {
  const { watched, rated, base, dataset } = ctx
  const withMeta = watched.filter((r) => r.meta)
  const ratedMeta = rated.filter((r) => r.meta)
  const pct = (x: number) => Math.round(x * 100)

  const lift = (has: (r: FilmRecord) => boolean, k = 6) => {
    const vals = ratedMeta.filter(has).map((r) => r.rating!)
    return vals.length >= 3 ? round(shrink(vals, base.mean, k) - base.mean) : null
  }
  const top = (rs: FilmRecord[], n = 6) =>
    rs.filter((r) => r.rating !== null).sort((a, b) => b.rating! - a.rating! || (b.meta?.sitelinks ?? 0) - (a.meta?.sitelinks ?? 0)).slice(0, n).map((r) => r.film.id)
  const share = (pool: FilmRecord[], has: (r: FilmRecord) => boolean) => (pool.length ? pool.filter(has).length / pool.length : 0)
  const dims: DnaDimension[] = []
  const push = (d: Omit<DnaDimension, 'score'> & { score: number }) => dims.push({ ...d, score: Math.max(0, Math.min(100, Math.round(d.score))) })

  // 1. Generosity
  const ratings = rated.map((r) => r.rating!)
  const fourPlus = share(rated, (r) => r.rating! >= 4)
  const fives = rated.filter((r) => r.rating === 5)
  push({
    id: 'generosity', name: 'Generosity', axis: 'Generosity',
    score: ((base.mean - 0.5) / 4.5) * 100,
    headline: `Average ${base.mean.toFixed(2)}★ — but only ${fives.length} perfect scores`,
    definition: 'Where your average rating sits on the 0.5–5★ scale (0 = everything gets ½★, 100 = everything gets 5★).',
    value: `${base.mean.toFixed(2)}★ mean · ${pct(fourPlus)}% rated 4★+ · ${pct(fives.length / ratings.length)}% rated 5★`,
    n: ratings.length, confidence: proportionConfidence(ratings.length), evidence: 'ratings',
    filmIds: top(fives, 9),
    stats: [
      { label: 'Mean', value: `${base.mean.toFixed(2)}★` },
      { label: 'Std. dev.', value: base.sd.toFixed(2) },
      { label: '4★ or higher', value: `${pct(fourPlus)}%` },
      { label: '2★ or lower', value: `${pct(share(rated, (r) => r.rating! <= 2))}%` },
    ],
    affinity: null,
  })

  // 2. Opening-night energy (new releases)
  const firstDated = watched.filter((r) => releaseLag(r) !== null)
  const isFresh = (r: FilmRecord) => (releaseLag(r) ?? 99) <= 1
  const fresh = share(firstDated, isFresh)
  const theatreTagged = dataset.viewings.filter((v) => v.tags.some((t) => /cineplex|theat|cinema|imax/i.test(t))).length
  push({
    id: 'present', name: 'Opening-Night Energy', axis: 'New releases',
    score: fresh * 100,
    headline: `${pct(fresh)}% of first watches happen within a year of release`,
    definition: 'Share of films (with a trustworthy diary date) first watched in their release year or the following one.',
    value: `${firstDated.filter(isFresh).length} of ${firstDated.length} dated first viewings`,
    n: firstDated.length, confidence: proportionConfidence(firstDated.length), evidence: 'behaviour',
    filmIds: top(firstDated.filter(isFresh)),
    stats: [
      { label: 'Median release → watch gap', value: `${medianLag(firstDated)} yrs` },
      { label: 'Theatre-tagged diary entries', value: String(theatreTagged), hint: 'Only diary entries you tagged with a cinema/theatre/IMAX tag.' },
    ],
    affinity: lift(isFresh),
  })

  // 3. Genre range
  const genreCounts = new Map<string, number>()
  for (const r of withMeta) for (const g of r.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const even = evenness([...genreCounts.values(), ...new Array(Math.max(0, 18 - genreCounts.size)).fill(0)])
  const topGenres = [...genreCounts].sort((a, b) => b[1] - a[1])
  push({
    id: 'range', name: 'Genre Range', axis: 'Range',
    score: even * 100,
    headline: `${genreCounts.size} of 18 genres visited; ${topGenres.slice(0, 3).map(([g]) => g).join(', ')} dominate`,
    definition: 'Normalised Shannon entropy of your watched films across the 18 canonical genres (100 = perfectly even spread).',
    value: `Evenness ${even.toFixed(2)}`,
    n: withMeta.length, confidence: proportionConfidence(withMeta.length), evidence: 'metadata',
    filmIds: [],
    stats: topGenres.slice(0, 6).map(([g, n]) => ({ label: g, value: `${pct(n / withMeta.length)}%` })),
    affinity: null,
  })

  // 4. Time travel (older cinema)
  const yearsKnown = watched.filter((r) => r.film.year)
  const isOld = (r: FilmRecord) => (r.film.year ?? 9999) < 2000
  push({
    id: 'time', name: 'Time Travel', axis: 'Pre-2000',
    score: share(yearsKnown, isOld) * 100,
    headline: `${pct(share(yearsKnown, isOld))}% of your films predate 2000`,
    definition: 'Share of watched films released before 2000.',
    value: `${yearsKnown.filter(isOld).length} of ${yearsKnown.length} films`,
    n: yearsKnown.length, confidence: proportionConfidence(yearsKnown.length), evidence: 'metadata',
    filmIds: top(yearsKnown.filter(isOld)),
    stats: [
      { label: 'Median release year', value: String(medianOf(yearsKnown.map((r) => r.film.year!))) },
      { label: 'Oldest film', value: oldest(yearsKnown) },
    ],
    affinity: lift(isOld),
  })

  // 5. World cinema
  const isWorld = (r: FilmRecord) => r.englishLanguage === false || (r.region !== null && !['United States', 'Canada', 'UK & Ireland'].includes(r.region))
  const worldPool = withMeta.filter((r) => r.region !== null || r.englishLanguage !== null)
  push({
    id: 'world', name: 'World Cinema', axis: 'World',
    score: share(worldPool, isWorld) * 100,
    headline: `${pct(share(worldPool, isWorld))}% of films come from outside the English-speaking West`,
    definition: 'Share of films that are not in English, or whose primary production country is outside the US, Canada, UK and Ireland.',
    value: `${worldPool.filter(isWorld).length} of ${worldPool.length} films`,
    n: worldPool.length, confidence: proportionConfidence(worldPool.length), evidence: 'metadata',
    filmIds: top(worldPool.filter(isWorld)),
    stats: [{ label: 'Not in English', value: `${pct(share(worldPool, (r) => r.englishLanguage === false))}%` }],
    affinity: lift(isWorld, 5),
  })

  // 6. Franchise gravity
  const isFr = (r: FilmRecord) => !!r.franchise
  push({
    id: 'franchise', name: 'Franchise Gravity', axis: 'Franchise',
    score: share(withMeta, isFr) * 100,
    headline: `${pct(share(withMeta, isFr))}% of films belong to a series or franchise`,
    definition: 'Share of films that Wikidata records as part of a series or media franchise.',
    value: `${withMeta.filter(isFr).length} of ${withMeta.length} films`,
    n: withMeta.length, confidence: proportionConfidence(withMeta.length), evidence: 'metadata',
    filmIds: top(withMeta.filter(isFr)),
    stats: [],
    affinity: lift(isFr),
  })

  // 7. Awards radar
  const isPrestige = (r: FilmRecord) => r.prestige.length > 0
  push({
    id: 'prestige', name: 'Awards Radar', axis: 'Awards',
    score: share(withMeta, isPrestige) * 100,
    headline: `${pct(share(withMeta, isPrestige))}% of films were nominated by a major awards body or festival`,
    definition: 'Share of films with a recorded win or nomination at the Oscars, BAFTA, Golden Globes, Cannes, Venice, Berlin, Independent Spirit, Annie, César or Sundance.',
    value: `${withMeta.filter(isPrestige).length} of ${withMeta.length} films`,
    n: withMeta.length, confidence: proportionConfidence(withMeta.length), evidence: 'metadata',
    filmIds: top(withMeta.filter(isPrestige)),
    stats: [],
    affinity: lift(isPrestige),
  })

  // 8. Auteur loyalty
  const dirCount = new Map<string, number>()
  for (const r of watched) for (const d of r.directors) dirCount.set(d, (dirCount.get(d) ?? 0) + 1)
  const withDir = watched.filter((r) => r.directors.length)
  const isRepeat = (r: FilmRecord) => r.directors.some((d) => (dirCount.get(d) ?? 0) >= 2)
  const repeatDirs = [...dirCount].filter(([, n]) => n >= 2)
  push({
    id: 'auteur', name: 'Auteur Loyalty', axis: 'Auteurs',
    score: share(withDir, isRepeat) * 100,
    headline: `${repeatDirs.length} directors appear 2+ times; they account for ${pct(share(withDir, isRepeat))}% of your films`,
    definition: 'Share of films whose director appears at least twice in your watched library.',
    value: `${withDir.filter(isRepeat).length} of ${withDir.length} films`,
    n: withDir.length, confidence: proportionConfidence(withDir.length), evidence: 'metadata',
    filmIds: top(withDir.filter(isRepeat)),
    stats: repeatDirs.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, n]) => ({ label: d, value: `${n} films` })),
    affinity: lift(isRepeat),
  })

  // 9. Dark matter (horror / thriller / crime)
  const isDark = (r: FilmRecord) => r.genres.some((g) => ['Horror', 'Thriller', 'Crime'].includes(g))
  push({
    id: 'dark', name: 'Dark Matter', axis: 'Dark',
    score: share(withMeta, isDark) * 100,
    headline: `${pct(share(withMeta, isDark))}% of films are horror, thriller or crime`,
    definition: 'Share of films tagged Horror, Thriller or Crime.',
    value: `${withMeta.filter(isDark).length} of ${withMeta.length} films`,
    n: withMeta.length, confidence: proportionConfidence(withMeta.length), evidence: 'metadata',
    filmIds: top(withMeta.filter(isDark)),
    stats: ['Horror', 'Thriller', 'Crime'].map((g) => ({ label: g, value: `${pct(share(withMeta, (r) => r.genres.includes(g)))}%` })),
    affinity: lift(isDark),
  })

  // 10. Comfort loop (rewatching)
  const rewatchViews = dataset.viewings.filter((v) => v.rewatch)
  const rewatchedFilms = new Set(rewatchViews.map((v) => v.filmId))
  push({
    id: 'rewatch', name: 'Comfort Loop', axis: 'Rewatching',
    score: (rewatchViews.length / Math.max(dataset.viewings.length, 1)) * 100,
    headline: `${pct(rewatchViews.length / Math.max(dataset.viewings.length, 1))}% of diary entries are rewatches`,
    definition: 'Share of diary entries you flagged as a rewatch.',
    value: `${rewatchViews.length} of ${dataset.viewings.length} entries · ${rewatchedFilms.size} films`,
    n: dataset.viewings.length, confidence: proportionConfidence(dataset.viewings.length), evidence: 'behaviour',
    filmIds: top(watched.filter((r) => rewatchedFilms.has(r.film.id))),
    stats: [],
    affinity: lift((r) => rewatchedFilms.has(r.film.id), 4),
  })

  // 11. Critic's voice
  const reviews = dataset.reviews.filter((r) => r.text.trim())
  const reviewRate = reviews.length / Math.max(dataset.viewings.length, 1)
  push({
    id: 'critic', name: "Critic's Voice", axis: 'Reviewing',
    score: Math.min(1, reviewRate) * 100,
    headline: `You write something for ${pct(Math.min(1, reviewRate))}% of what you log — usually ${Math.round(ctx.language.meanWords)} words`,
    definition: 'Reviews written per diary entry (capped at 100).',
    value: `${reviews.length} reviews · mean ${ctx.language.meanWords} words · ${pct(ctx.language.shortShare)}% are 12 words or fewer`,
    n: reviews.length, confidence: proportionConfidence(reviews.length), evidence: 'review-text',
    filmIds: [...reviews].sort((a, b) => b.wordCount - a.wordCount).slice(0, 6).map((r) => r.filmId),
    stats: [{ label: 'Longest review', value: `${Math.max(...reviews.map((r) => r.wordCount))} words` }],
    affinity: null,
  })

  // 12. Off the beaten path (low notability)
  const isOffbeat = (r: FilmRecord) => r.notability === 'niche' || r.notability === 'mid'
  push({
    id: 'offbeat', name: 'Off the Beaten Path', axis: 'Offbeat',
    score: share(withMeta, isOffbeat) * 100,
    headline: `${pct(share(withMeta, isOffbeat))}% of films are covered by fewer than 35 Wikipedias`,
    definition: 'Share of films with modest global footprint (fewer than 35 Wikipedia language editions) — a rough notability proxy, not a quality judgement.',
    value: `${withMeta.filter(isOffbeat).length} of ${withMeta.length} films · median ${medianOf(withMeta.map((r) => r.meta!.sitelinks))} editions`,
    n: withMeta.length, confidence: proportionConfidence(withMeta.length), evidence: 'metadata',
    filmIds: top(withMeta.filter(isOffbeat)),
    stats: [],
    affinity: lift(isOffbeat),
  })

  return dims
}

function medianOf(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0
}
function medianLag(rs: FilmRecord[]): number {
  return medianOf(rs.map((r) => releaseLag(r)!).filter((x) => x !== null))
}
function oldest(rs: FilmRecord[]): string {
  const o = [...rs].sort((a, b) => a.film.year! - b.film.year!)[0]
  return o ? `${o.film.title} (${o.film.year})` : '—'
}
export { mean }
