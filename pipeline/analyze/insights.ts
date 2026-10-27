import type { AffinityRow, AppData, Confidence, Insight, Stat } from '../../shared/app-types.ts'
import type { FilmRecord } from './features.ts'
import { releaseLag } from './features.ts'
import type { AnalysisContext } from './index.ts'
import { tokenize } from './language.ts'
import { confidenceFor, logOddsZ, mean, median, proportionConfidence, round, shrink } from './stats.ts'

/**
 * Phase-3 investigations. Every insight is computed from the data with explicit thresholds;
 * if the data can't support a pattern, the insight is simply not emitted.
 */
export function buildInsights(ctx: AnalysisContext): { insights: Insight[]; fiveStar: AppData['fiveStar'] } {
  const { rated, watched, base, affinities, byId } = ctx
  const insights: Insight[] = []
  const add = (i: Insight | null | undefined) => i && insights.push(i)
  const title = (id: string) => byId.get(id)?.film.title ?? id
  const titled = (ids: string[], n = 3) => ids.slice(0, n).map(title).join(', ')
  const star = (x: number) => `${x.toFixed(x % 0.5 === 0 && x % 1 !== 0 ? 1 : x % 1 === 0 ? 0 : 2)}★`
  const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}★`
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const fmtRow = (r: AffinityRow): Stat[] => [
    { label: 'Films', value: String(r.n) },
    { label: 'Raw mean', value: star(r.mean) },
    { label: 'Shrunk vs. you', value: signed(r.delta), hint: 'Empirical-Bayes estimate minus your overall mean' },
    { label: '90% interval', value: `${r.ci[0].toFixed(2)}–${r.ci[1].toFixed(2)}★` },
  ]
  const kindName: Record<string, string> = {
    genre: 'genre', subgenre: 'sub-genre', decade: 'decade', runtime: 'runtime band', region: 'region', country: 'country',
    notability: 'notability tier', prestige: 'awards body', franchise: 'franchise', director: 'director', writer: 'writer',
    cast: 'actor', cinematographer: 'cinematographer', composer: 'composer', language: 'language',
  }

  // ── 11 · Critical generosity ───────────────────────────────────────────
  const ratings = rated.map((r) => r.rating!)
  const threeOrLess = ratings.filter((x) => x <= 3).length / ratings.length
  const fives = rated.filter((r) => r.rating === 5)
  const revisions = ctx.dataset.audit.conflicts.filter((c) => c.kind === 'rating-mismatch')
  const downs = revisions.filter((c) => {
    const m = c.detail.match(/latest diary rating ([\d.]+)★, current rating ([\d.]+)★/)
    return m && Number(m[2]) < Number(m[1])
  })
  const generous = base.mean >= 3.25
  const fivesRare = fives.length / Math.max(ratings.length, 1) <= 0.08
  if (ratings.length) add({
    id: 'generosity',
    category: 'generosity',
    title: generous ? (fivesRare ? 'A generous grader who rations perfection' : 'A generous grader') : base.mean >= 2.75 ? 'A measured grader' : 'A tough grader',
    finding: generous
      ? `Your average is ${star(base.mean)} (median ${star(median(ratings))}), so a 3★ from you is a below-average grade — ${pct(threeOrLess)} of your films sit at 3★ or lower. ${fivesRare ? 'Yet only' : 'And'} ${fives.length} of ${ratings.length} films (${pct(fives.length / ratings.length)}) have earned 5★.`
      : `Your average is ${star(base.mean)} (median ${star(median(ratings))}): ${pct(threeOrLess)} of your films sit at 3★ or lower, and ${fives.length} of ${ratings.length} (${pct(fives.length / ratings.length)}) have earned 5★.`,
    explanation: generous
      ? `Your stars are compressed into the upper-middle of the scale. Read your 3★ as "fine" and your 4★ as a genuine recommendation${fivesRare ? '; 5★ is a rare, deliberate act' : ''}.`
      : base.mean >= 2.75
        ? 'You use the middle of the scale honestly: a 3★ from you is an ordinary grade, and anything at 4★ or above stands out.'
        : 'You grade hard. Most films land low on your scale, so even a 3★ is a recommendation and a 4★ is high praise.',
    stats: [
      { label: 'Mean', value: star(base.mean) },
      { label: 'Std. dev.', value: base.sd.toFixed(2) },
      { label: '5★ films', value: String(fives.length) },
      { label: 'Ratings revised later', value: `${revisions.length} (${downs.length} downward)` },
    ],
    filmIds: fives.map((r) => r.film.id),
    n: ratings.length,
    confidence: proportionConfidence(ratings.length),
    evidence: 'ratings',
  })

  // ── 7 · Rewatch patterns + rating drift ────────────────────────────────
  const drift = watched
    .filter((r) => r.viewings.filter((v) => v.rating !== null).length >= 2)
    .map((r) => {
      const vs = r.viewings.filter((v) => v.rating !== null)
      return { r, first: vs[0].rating!, last: vs.at(-1)!.rating! }
    })
  const ups = drift.filter((d) => d.last > d.first)
  const flat = drift.filter((d) => d.last === d.first)
  const dropped = drift.filter((d) => d.last < d.first)
  const rewatched = watched.filter((r) => r.viewings.some((v) => v.rewatch))
  const rewatchedMean = mean(rewatched.filter((r) => r.rating !== null).map((r) => r.rating!))
  if (drift.length >= 4) {
    const warm = ups.length > dropped.length
    const cool = dropped.length > ups.length
    const revDown = revisions.length >= 2 && downs.length > revisions.length / 2
    add({
      id: 'rewatch-drift',
      category: 'rewatch',
      title: warm && revDown ? 'Rewatches warm you up; hindsight cools you down' : warm ? 'Rewatches warm you up' : cool ? 'Rewatches cool you down' : 'How your ratings move on a second look',
      finding: `Of ${drift.length} films you've rated more than once in your diary, ${ups.length} went up on the later viewing, ${flat.length} held and ${dropped.length} went down. ${revisions.length ? `Meanwhile, the ${revisions.length} ratings you changed without logging a new viewing moved ${downs.length === revisions.length ? 'only downward' : `downward ${downs.length} times`}.` : ''}`,
      explanation: warm
        ? 'Selection plays a role — you rewatch what you already liked — but a second viewing tends to raise your rating.' + (revDown ? ' Changing a rating without a rewatch tends to lower it.' : '')
        : cool ? 'Selection plays a role, but a second viewing tends to lower your rating.' : 'Rewatches move your ratings both ways about equally.',
      stats: [
        { label: 'Up on rewatch', value: String(ups.length) },
        { label: 'Unchanged', value: String(flat.length) },
        { label: 'Down on rewatch', value: String(dropped.length) },
        { label: 'Avg rating of rewatched films', value: star(rewatchedMean) },
      ],
      filmIds: [...ups, ...dropped].map((d) => d.r.film.id),
      n: drift.length,
      confidence: drift.length >= 15 ? 'medium' : 'low',
      evidence: 'ratings',
    })
  }
  if (rewatched.length >= 3) {
    const comfort = rewatched.filter((r) => r.viewings.length >= 3)
    add({
      id: 'rewatch-comfort',
      category: 'rewatch',
      title: 'What you return to',
      finding: `${rewatched.length} films carry a rewatch in your diary, averaging ${star(rewatchedMean)} — ${signed(rewatchedMean - base.mean)} versus your baseline. ${comfort.length ? `You've logged ${titled(comfort.map((r) => r.film.id), 4)} three or more times.` : ''}`,
      explanation: rewatchedMean - base.mean >= 0.1
        ? 'Your rewatches are not comfort-food filler; they are almost entirely your top-tier films. Returning is how you confirm a favourite.'
        : 'Your rewatches average about the same as, or below, your other films.',
      stats: [
        { label: 'Rewatched films', value: String(rewatched.length) },
        { label: 'Rewatch entries', value: String(ctx.dataset.viewings.filter((v) => v.rewatch).length) },
        { label: '3+ viewings', value: String(comfort.length) },
      ],
      filmIds: rewatched.sort((a, b) => b.viewings.length - a.viewings.length || (b.rating ?? 0) - (a.rating ?? 0)).map((r) => r.film.id),
      n: rewatched.length,
      confidence: rewatched.length >= 15 ? 'medium' : 'low',
      evidence: 'behaviour',
    })
  }

  // ── Scale & ambition: runtime / notability / awards ────────────────────
  const longRow = affinities.runtime.find((r) => r.key === '150+ min')
  const shortRows = affinities.runtime.filter((r) => r.key !== '150+ min').sort((a, b) => a.delta - b.delta)
  if (longRow && longRow.n >= 5 && longRow.delta >= 0.15 && shortRows.length) {
    const lowest = shortRows[0]
    add({
      id: 'runtime',
      category: 'formula',
      title: 'The longer the film, the higher the grade',
      finding: `Films running 150 minutes or more average ${star(longRow.mean)} from you (${longRow.n} films) — ${signed(longRow.delta)} after shrinkage. Your weakest band is ${lowest.key} at ${star(lowest.mean)} (${lowest.n} films).`,
      explanation: 'Long runtimes are a proxy for ambition (epics, auteur passion projects, awards contenders) rather than a cause; but the pattern is strong enough that a long runtime is a good sign for you, not a warning.',
      stats: [...fmtRow(longRow), ...runtimeByGenre(rated, base)],
      filmIds: longRow.filmIds,
      n: longRow.n,
      confidence: longRow.confidence,
      evidence: 'metadata',
    })
  }
  const awardsNone = affinities.prestige.find((r) => r.key === 'No major-award recognition')
  const recognised = rated.filter((r) => r.meta && r.prestige.length)
  if (awardsNone && recognised.length >= 8) {
    const recMean = mean(recognised.map((r) => r.rating!))
    const canon = affinities.notability.find((r) => r.key.startsWith('Global canon'))
    const gap = recMean - awardsNone.mean
    add({
      id: 'canon',
      category: 'formula',
      title: gap > 0.3 ? 'You and the awards bodies mostly agree' : 'Awards barely move you',
      finding: `Films recognised by a major awards body average ${star(recMean)} (${recognised.length} films) versus ${star(awardsNone.mean)} for everything else (${awardsNone.n}).${canon ? ` The globally canonical films — covered by 60+ Wikipedias — average ${star(canon.mean)}.` : ''}`,
      explanation: gap > 0.3
        ? 'Your taste is not contrarian: consensus quality usually lands with you. That makes acclaimed films a low-risk bet — and it makes the exceptions (acclaimed films you disliked) the most revealing part of your profile.'
        : 'Consensus quality is a weak predictor for you — you trust your own response over the canon.',
      stats: [
        { label: 'Award-recognised mean', value: star(recMean) },
        { label: 'Others mean', value: star(awardsNone.mean) },
        { label: 'Gap', value: signed(gap) },
        ...(canon ? [{ label: 'Global-canon mean', value: star(canon.mean) }] : []),
      ],
      filmIds: recognised.sort((a, b) => b.rating! - a.rating!).map((r) => r.film.id),
      n: recognised.length + awardsNone.n,
      confidence: confidenceFor(recognised.length, gap / 2, base.sd, 5),
      evidence: 'metadata',
    })
  }

  // ── Genre flatness: genre is a weak predictor ──────────────────────────
  const bigGenres = affinities.genre.filter((g) => g.n >= 10)
  if (bigGenres.length >= 4) {
    const spread = Math.max(...bigGenres.map((g) => g.shrunk)) - Math.min(...bigGenres.map((g) => g.shrunk))
    const runtimeSpread = affinities.runtime.length ? Math.max(...affinities.runtime.map((g) => g.shrunk)) - Math.min(...affinities.runtime.map((g) => g.shrunk)) : 0
    if (spread < 0.45) {
      add({
        id: 'genre-agnostic',
        category: 'contradiction',
        title: 'Genre is not what decides your rating',
        finding: `Across your ${bigGenres.length} main genres the shrunk averages span only ${spread.toFixed(2)}★ (from ${bigGenres.at(-1)!.key} at ${star(bigGenres.at(-1)!.shrunk)} to ${bigGenres[0].key} at ${star(bigGenres[0].shrunk)}). ${runtimeSpread > spread ? `Runtime bands alone spread ${runtimeSpread.toFixed(2)}★.` : ''}`,
        explanation: 'You are a genre omnivore in the truest sense: the label on the box tells us little about how you will feel. Execution, scale and ambition separate your favourites from your shrugs.',
        stats: bigGenres.slice(0, 6).map((g) => ({ label: g.key, value: `${star(g.shrunk)} · n=${g.n}` })),
        filmIds: [],
        n: rated.length,
        confidence: 'medium',
        evidence: 'metadata',
      })
    }
  }

  // ── 9 · Genre intersections ────────────────────────────────────────────
  const synergies = ctx.pairs.filter((p) => p.n >= 5 && p.synergy >= 0.1).slice(0, 3)
  for (const p of synergies) {
    const ga = affinities.genre.find((g) => g.key === p.a)!
    const gb = affinities.genre.find((g) => g.key === p.b)!
    add({
      id: `pair-${p.a}-${p.b}`,
      category: 'intersection',
      title: `${p.a} × ${p.b}: better together`,
      finding: `${p.a} on its own averages ${star(ga.shrunk)}; ${p.b} ${star(gb.shrunk)}. When a film is both (${p.n} films), it averages ${star(p.mean)} — ${signed(p.synergy)} above the better of the two.`,
      explanation: `The combination is doing work that neither genre does alone — for you, ${p.b === 'Comedy' || p.a === 'Comedy' ? 'humour is what makes the other genre land' : 'the blend creates something you respond to more than either ingredient'}.`,
      stats: [
        { label: `${p.a} alone`, value: star(ga.shrunk) },
        { label: `${p.b} alone`, value: star(gb.shrunk) },
        { label: 'Together', value: `${star(p.mean)} (n=${p.n})` },
        { label: 'Synergy', value: signed(p.synergy) },
      ],
      filmIds: p.filmIds,
      n: p.n,
      confidence: p.n >= 12 && p.synergy >= 0.15 ? 'medium' : 'low',
      evidence: 'metadata',
    })
  }

  // ── 4 · Unexpected disappointments: frequent but below baseline ────────
  const frequentKinds = ['genre', 'subgenre', 'franchise', 'runtime', 'region']
  const disappointments = frequentKinds
    .flatMap((k) => affinities[k] ?? [])
    .filter((r) => r.n >= 8 && r.delta <= -0.1 && r.key !== 'No major-award recognition')
    .sort((a, b) => a.delta * Math.sqrt(a.n) - b.delta * Math.sqrt(b.n))
    .slice(0, 3)
  for (const r of disappointments) {
    const loved = r.filmIds.filter((id) => (byId.get(id)?.rating ?? 0) >= 4.5)
    add({
      id: `disappoint-${r.kind}-${r.key}`,
      category: 'disappointment',
      title: r.delta <= -0.25 ? `${labelOf(r, true)}: frequent, and reliably below par` : `${labelOf(r, true)}: frequent, but below your baseline`,
      finding: `${r.n} of your films (${pct(r.share)}) are ${labelOf(r)}, averaging ${star(r.mean)} (${signed(r.delta)} vs. your baseline).${loved.length ? ` The exceptions — ${titled(loved, 3)} — show it isn't the label you dislike.` : ''}`,
      explanation:
        r.kind === 'runtime'
          ? 'Mid-length films are the default length of studio programmers; when a film is merely efficient, it rarely moves you. This is a description of where your shrugs cluster, not a reason to avoid short films.'
          : r.kind === 'franchise' || r.key === 'superhero'
            ? 'High exposure with below-average returns usually means habit or event-viewing — the next instalment, the big opening weekend — rather than preference.'
            : 'You return to this category often, but on average it returns less than the rest of your viewing. It may be habit, convenience or company rather than preference.',
      stats: fmtRow(r),
      filmIds: [...r.filmIds].reverse(),
      n: r.n,
      confidence: r.confidence,
      evidence: 'metadata',
    })
  }

  // ── 2 · Contradictions: a below-par category that holds top favourites ─
  const contradictions = ['subgenre', 'genre', 'franchise']
    .flatMap((k) => affinities[k] ?? [])
    .filter((r) => r.n >= 6 && r.delta < 0)
    .map((r) => ({ r, top: r.filmIds.filter((id) => (byId.get(id)?.rating ?? 0) >= 4.5), low: r.filmIds.filter((id) => (byId.get(id)?.rating ?? 5) <= 2.5) }))
    .filter((x) => x.top.length >= 2 && x.low.length >= 2)
    .sort((a, b) => b.top.length + b.low.length - (a.top.length + a.low.length))
  for (const c of contradictions.slice(0, 1)) {
    const topRecs = c.top.map((id) => byId.get(id)!)
    const animatedTop = topRecs.filter((r) => r.animated).length
    add({
      id: `contradiction-${c.r.key}`,
      category: 'contradiction',
      title: `The ${labelOf(c.r)} paradox`,
      finding: `${labelOf(c.r, true)} sit below your average (${star(c.r.mean)} across ${c.r.n} films), yet it contains some of your highest ratings — ${titled(c.top, 4)} — alongside some of your lowest (${titled(c.low, 3)}).`,
      explanation: animatedTop >= Math.ceil(c.top.length / 2)
        ? 'The favourites in this category skew animated and formally inventive. It is not the genre you love; it is a filmmaker doing something new with it.'
        : 'Same label, opposite verdicts: you respond to how a film executes the genre, not to the genre itself.',
      stats: [
        { label: 'Films', value: String(c.r.n) },
        { label: 'Rated 4.5★+', value: String(c.top.length) },
        { label: 'Rated 2.5★ or less', value: String(c.low.length) },
        { label: 'Spread (SD)', value: c.r.sd.toFixed(2) },
      ],
      filmIds: [...c.top, ...c.low],
      n: c.r.n,
      confidence: 'medium',
      evidence: 'ratings',
    })
  }
  // Acclaimed-but-disliked: the canon exceptions.
  const acclaimedMisses = rated.filter((r) => r.prestige.includes('Academy Awards') && r.rating! <= 2.5)
  if (acclaimedMisses.length) {
    add({
      id: 'acclaimed-misses',
      category: 'contradiction',
      title: 'Where you break from the consensus',
      finding: `You usually agree with the Academy, which makes ${acclaimedMisses.length === 1 ? 'this one stand out' : 'these stand out'}: ${acclaimedMisses.map((r) => `${r.film.title} (${star(r.rating!)})`).join(', ')}.`,
      explanation:
        acclaimedMisses.length === 1
          ? 'Acclaim did not rescue it for you. A single exception is not a pattern, but it marks where consensus and your own taste part ways.'
          : 'Acclaim did not rescue these for you. Look at what they share — they are the clearest map of your personal limits.',
      stats: acclaimedMisses.slice(0, 4).map((r) => ({ label: r.film.title, value: `${star(r.rating!)} · ${r.genres.slice(0, 2).join('/')}` })),
      filmIds: acclaimedMisses.map((r) => r.film.id),
      n: acclaimedMisses.length,
      confidence: 'low',
      evidence: 'ratings',
    })
  }

  // ── 1 & 8 · Hidden favourites & underrated corners ─────────────────────
  const hiddenKinds = ['subgenre', 'region', 'decade', 'prestige', 'franchise', 'writer']
  const hidden = hiddenKinds
    .flatMap((k) => affinities[k] ?? [])
    .filter((r) => r.n >= 3 && r.n <= 9 && r.mean >= base.mean + 0.4 && r.key !== 'No major-award recognition')
    .sort((a, b) => b.delta - a.delta)
  const usedHidden: string[][] = []
  for (const r of hidden) {
    const overlaps = usedHidden.some((ids) => r.filmIds.filter((id) => ids.includes(id)).length / r.filmIds.length >= 0.5)
    if (overlaps || usedHidden.length >= 3) continue
    usedHidden.push(r.filmIds)
    add({
      id: `hidden-${r.kind}-${r.key}`,
      category: 'hidden-favourite',
      title: `Hidden favourite: ${labelOf(r)}`,
      finding: `Only ${r.n} films, but they average ${star(r.mean)} — ${signed(r.delta)} even after shrinking toward your baseline. (${titled(r.filmIds, 3)}.)`,
      explanation: 'Small but consistently strong: an area worth exploring deliberately, because the evidence so far says it reliably pays off.',
      stats: fmtRow(r),
      filmIds: r.filmIds,
      n: r.n,
      confidence: r.confidence,
      evidence: 'metadata',
    })
  }
  const crew = [...(affinities.composer ?? []), ...(affinities.cinematographer ?? [])]
    .filter((r) => r.n >= 3 && r.delta >= 0.25)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4)
  if (crew.length) {
    add({
      id: 'below-the-line',
      category: 'underrated-corner',
      title: 'Below-the-line signals',
      finding: `The people you never think about predict your ratings: ${crew.map((r) => `${r.key} (${r.kind}, ${r.n} films, ${star(r.mean)})`).join('; ')}.`,
      explanation: 'Composers and cinematographers recur across directors and franchises. When one of these names shows up in the credits of something new, it is a quiet vote of confidence.',
      stats: crew.map((r) => ({ label: r.key, value: `${signed(r.delta)} · n=${r.n}` })),
      filmIds: [...new Set(crew.flatMap((r) => r.filmIds))],
      n: crew.reduce((a, r) => a + r.n, 0),
      confidence: crew.some((r) => r.confidence !== 'low') ? 'medium' : 'low',
      evidence: 'metadata',
    })
  }

  // ── 6 · Director loyalty ───────────────────────────────────────────────
  const dirs = affinities.director.filter((d) => d.n >= 3)
  if (dirs.length) {
    const mostLoved = [...dirs].sort((a, b) => b.shrunk - a.shrunk)[0]
    const mostRated = [...dirs].sort((a, b) => b.n - a.n || b.shrunk - a.shrunk)[0]
    const uneven = [...dirs].sort((a, b) => b.sd - a.sd)[0]
    const weakest = [...dirs].sort((a, b) => a.shrunk - b.shrunk)[0]
    add({
      id: 'director-loyalty',
      category: 'loyalty',
      title: mostLoved.key === mostRated.key ? `${mostLoved.key}: most-rated and most-loved` : `Loyal to ${mostRated.key}, devoted to ${mostLoved.key}`,
      finding: `${mostRated.key} is your most-rated director (${mostRated.n} rated films, ${star(mostRated.mean)} average)${mostLoved.key !== mostRated.key ? `, but ${mostLoved.key} is your most rewarding (${mostLoved.n} films, ${star(mostLoved.mean)})` : ''}. ${uneven.sd >= 0.5 && uneven.key !== mostLoved.key ? `${uneven.key} is your most uneven (${uneven.n} films ranging widely, SD ${uneven.sd}).` : ''} ${weakest.delta < -0.1 ? `${weakest.key} consistently underperforms for you (${star(weakest.mean)} across ${weakest.n}).` : ''}`,
      explanation: 'Watching a director a lot and loving them are different things. Loyalty can be habit; a consistently high average across several films is a much stronger signal of genuine affinity.',
      stats: dirs.sort((a, b) => b.shrunk - a.shrunk).slice(0, 6).map((d) => ({ label: d.key, value: `${star(d.mean)} · n=${d.n} · SD ${d.sd}` })),
      filmIds: [...new Set([...mostLoved.filmIds, ...mostRated.filmIds])],
      n: dirs.reduce((a, d) => a + d.n, 0),
      confidence: mostLoved.confidence === 'low' ? 'low' : 'medium',
      evidence: 'ratings',
    })
  }

  // ── 3 · The five-star formula ──────────────────────────────────────────
  const threshold = rated.filter((r) => r.rating! >= 4.5).length >= 8 ? 4.5 : 4
  const topSet = rated.filter((r) => r.rating! >= threshold)
  const midSet = rated.filter((r) => r.rating! <= 3.5)
  const traitDefs: [string, (r: FilmRecord) => boolean][] = [
    ['Major-award recognition', (r) => r.prestige.length > 0],
    ['Runtime 130+ min', (r) => (r.runtime ?? 0) >= 130],
    ['Global-canon notability', (r) => r.notability === 'canon'],
    ['Drama in the genre mix', (r) => r.genres.includes('Drama')],
    ['Comedy in the genre mix', (r) => r.genres.includes('Comedy')],
    ['Animated', (r) => r.animated],
    ['Part of a franchise', (r) => !!r.franchise],
    ['Superhero', (r) => r.subgenres.includes('superhero')],
    ['Watched within a year of release', (r) => (releaseLag(r) ?? 99) <= 1],
    ['Non-English', (r) => r.englishLanguage === false],
    ['Pre-2000 release', (r) => (r.film.year ?? 3000) < 2000],
    ['Horror / thriller', (r) => r.genres.some((g) => ['Horror', 'Thriller'].includes(g))],
    ['Science fiction', (r) => r.genres.includes('Science Fiction')],
  ]
  const traits = traitDefs
    .map(([label, test]) => {
      const a = topSet.filter(test).length, b = midSet.filter(test).length
      return { label, a, b, pa: a / topSet.length, pb: b / Math.max(midSet.length, 1), z: logOddsZ(a, topSet.length, b, midSet.length, 0.5, 1) }
    })
    .filter((t) => t.a + t.b >= 4)
    .sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
  const formulaStats: Stat[] = traits.slice(0, 8).map((t) => ({
    label: t.label,
    value: `${pct(t.pa)} of top vs ${pct(t.pb)} of ≤3.5★`,
    hint: `log-odds z = ${t.z.toFixed(1)}`,
  }))
  const pos = traits.filter((t) => t.z >= 1.5).slice(0, 3)
  const neg = traits.filter((t) => t.z <= -1.5).slice(0, 2)
  if (topSet.length >= 5 && midSet.length >= 5) {
    add({
      id: 'five-star-formula',
      category: 'formula',
      title: 'The five-star formula',
      finding: `Comparing your ${topSet.length} films rated ${star(threshold)}+ with the ${midSet.length} rated 3.5★ or less: ${pos.length ? pos.map((t) => `${t.label.toLowerCase()} (${pct(t.pa)} vs ${pct(t.pb)})`).join(', ') + ' are markedly more common at the top' : 'no single trait dominates the top'}${neg.length ? `, while ${neg.map((t) => `${t.label.toLowerCase()} (${pct(t.pa)} vs ${pct(t.pb)})`).join(' and ')} ${neg.length > 1 ? 'are' : 'is'} rarer.` : '.'}`,
      explanation: 'This is a recipe description, not a causal claim: these traits travel together in the films you love. Use it as a filter when choosing what to watch next.',
      stats: formulaStats,
      filmIds: topSet.sort((a, b) => b.rating! - a.rating!).map((r) => r.film.id),
      n: topSet.length + midSet.length,
      confidence: topSet.length >= 15 ? 'medium' : 'low',
      evidence: 'metadata',
    })
  }

  // ── 5 · Taste evolution ────────────────────────────────────────────────
  const years = ctx.timeline.years.filter((y) => y.viewings >= 10)
  if (years.length >= 2) {
    const first = years[0], last = years.at(-1)!
    const genreDelta = Object.keys({ ...first.genreShares, ...last.genreShares })
      .map((g) => ({ g, d: (last.genreShares[g] ?? 0) - (first.genreShares[g] ?? 0) }))
      .sort((a, b) => b.d - a.d)
    const rising = genreDelta[0] ?? { g: '', d: 0 }
    const falling = genreDelta.at(-1) ?? { g: '', d: 0 }
    const lagByYear = years.map((y) => {
      const lags = ctx.dataset.viewings
        .filter((v) => !v.rewatch && v.watchedDate?.startsWith(String(y.year)) && (v.dateQuality === 'live' || v.dateQuality === 'delayed'))
        .map((v) => byId.get(v.filmId))
        .map((r) => (r?.film.year ? y.year - r.film.year : null))
        .filter((x): x is number => x !== null)
      return { year: y.year, fresh: lags.filter((l) => l <= 1).length / Math.max(lags.length, 1) }
    })
    add({
      id: 'evolution',
      category: 'evolution',
      title: (last.meanRating ?? 0) > (first.meanRating ?? 0) + 0.1 ? 'Your ratings have been climbing' : (last.meanRating ?? 0) < (first.meanRating ?? 0) - 0.1 ? 'You have become a tougher grader' : 'A steady hand over the years',
      finding: `In ${first.year} you logged ${first.viewings} viewings averaging ${first.meanRating ? star(first.meanRating) : '—'}; in ${last.year}, ${last.viewings} averaging ${last.meanRating ? star(last.meanRating) : '—'}. ${rising.d > 0.04 ? `${rising.g} grew from ${pct(first.genreShares[rising.g] ?? 0)} to ${pct(last.genreShares[rising.g] ?? 0)} of your films` : ''}${falling.d < -0.04 ? `, while ${falling.g} fell from ${pct(first.genreShares[falling.g] ?? 0)} to ${pct(last.genreShares[falling.g] ?? 0)}` : ''}. New releases made up ${pct(lagByYear[0].fresh)} of first watches in ${first.year} and ${pct(lagByYear.at(-1)!.fresh)} in ${last.year}.`,
      explanation: 'Year-to-year shifts in a few hundred films are noisy; treat these as direction-of-travel rather than firm conclusions.',
      stats: years.map((y) => ({ label: String(y.year), value: `${y.viewings} views · ${y.meanRating ? star(y.meanRating) : '—'} · median release ${y.meanReleaseYear ? Math.round(y.meanReleaseYear) : '—'}` })),
      filmIds: last.topFilmIds,
      n: years.reduce((a, y) => a + y.viewings, 0),
      confidence: 'low',
      evidence: 'behaviour',
    })
  }

  // ── 10 · Watchlist psychology ──────────────────────────────────────────
  const wl = ctx.records.filter((r) => r.film.inWatchlist && !r.film.watched)
  const wlMeta = wl.filter((r) => r.meta)
  const wMeta = watched.filter((r) => r.meta)
  if (wlMeta.length >= 20) {
    const cmp = (label: string, f: (r: FilmRecord) => boolean) => ({ label, wl: wlMeta.filter(f).length / wlMeta.length, w: wMeta.filter(f).length / wMeta.length })
    const rows = [
      cmp('Released before 2000', (r) => (r.film.year ?? 3000) < 2000),
      cmp('Not in English', (r) => r.englishLanguage === false),
      cmp('Major-award recognised', (r) => r.prestige.length > 0),
      cmp('Part of a franchise', (r) => !!r.franchise),
      cmp('Horror', (r) => r.genres.includes('Horror')),
      cmp('Drama', (r) => r.genres.includes('Drama')),
      cmp('Superhero', (r) => r.subgenres.includes('superhero')),
      cmp('Runtime 130+ min', (r) => (r.runtime ?? 0) >= 130),
    ].sort((a, b) => Math.abs(b.wl - b.w) - Math.abs(a.wl - a.w))
    const ages = wl.map((r) => r.film.watchlistAddedDate).filter((d): d is string => !!d)
    const now = ctx.dataset.source.exportedAt ? Date.parse(ctx.dataset.source.exportedAt) : Date.now()
    const medianAge = median(ages.map((d) => (now - Date.parse(d)) / 86_400_000 / 365.25))
    const oldest = [...wl].filter((r) => r.film.watchlistAddedDate).sort((a, b) => a.film.watchlistAddedDate!.localeCompare(b.film.watchlistAddedDate!))
    const medYearWl = median(wlMeta.map((r) => r.film.year ?? 0).filter(Boolean))
    const medYearW = median(wMeta.map((r) => r.film.year ?? 0).filter(Boolean))
    const top3 = rows.slice(0, 3)
    const contrast = watchlistContrast(rows, medYearWl, medYearW)
    add({
      id: 'watchlist',
      category: 'watchlist',
      title: 'The films you mean to watch vs. the films you do',
      finding: `Your ${wl.length}-film watchlist is a different person's taste: median release year ${medYearWl} versus ${medYearW} for what you actually watch. ${top3.map((r) => `${r.label}: ${pct(r.wl)} of the watchlist vs ${pct(r.w)} watched`).join('; ')}. Half the list has been waiting ${medianAge.toFixed(1)}+ years${oldest[0] ? ` — ${oldest.slice(0, 2).map((r) => r.film.title).join(' and ')} since ${oldest[0].film.watchlistAddedDate}` : ''}.`,
      explanation: `The watchlist records aspiration${contrast.length ? ` — ${contrast.join(', ')} —` : ''} while your diary records what wins on a given night. The gap is where the most rewarding next discoveries are likely to be.`,
      stats: [
        ...(contrast.length ? [{ label: 'Watchlist leans', value: contrast.join(', ') }] : []),
        { label: 'Median release year', value: `${medYearWl} vs ${medYearW}` },
        ...rows.slice(0, 6).map((r) => ({ label: r.label, value: `${pct(r.wl)} vs ${pct(r.w)}` })),
      ],
      filmIds: oldest.map((r) => r.film.id).slice(0, 12),
      n: wlMeta.length,
      confidence: proportionConfidence(wlMeta.length),
      evidence: 'behaviour',
    })
  }

  // ── Review language ────────────────────────────────────────────────────
  const lang = ctx.language
  const funCat = lang.categories.find((c) => c.id === 'fun')
  const praise = lang.categories.filter((c) => c.lift !== null && c.lift >= 0.15 && c.reviews >= 5).sort((a, b) => b.lift! - a.lift!)
  if (funCat && funCat.lift !== null && funCat.lift <= -0.2) {
    add({
      id: 'language-fun',
      category: 'language',
      title: '"Fun" is faint praise',
      finding: `When your review talks about fun, enjoyment or laughs (${funCat.reviews} reviews), the film averages ${star(funCat.meanWhenMentioned!)} — versus ${star(funCat.meanOtherwise!)} otherwise. ${praise.length ? `The vocabulary of your high ratings is different: ${praise.slice(0, 3).map((c) => `${c.label.toLowerCase()} (${signed(c.lift!)})`).join(', ')}.` : ''}`,
      explanation: 'You are generous with the word "fun" and stingy with the stars that go with it. Being entertained earns a 3–3.5★; being moved, dazzled or immersed is what earns a 4.5.',
      stats: lang.categories.filter((c) => c.lift !== null).sort((a, b) => b.lift! - a.lift!).map((c) => ({ label: c.label, value: `${signed(c.lift!)} · ${c.reviews} reviews` })),
      filmIds: funCat.examples.map((e) => e.filmId),
      n: funCat.reviews,
      confidence: funCat.reviews >= 30 ? 'medium' : 'low',
      evidence: 'review-text',
    })
  }
  const sig = signaturePhrase(ctx)
  if (sig) {
    add({
      id: 'language-signature',
      category: 'language',
      title: `Your signature: "${sig.phrase}"`,
      finding: `"${sig.phrase}" appears in ${sig.count} reviews, averaging ${star(sig.mean)} — it's how you mark a film that truly landed. Your text and stars are only loosely coupled overall (sentiment–rating correlation ${lang.textRatingCorrelation ?? '—'}), and ${pct(lang.shortShare)} of reviews are 12 words or fewer.`,
      explanation: 'Short reviews and a personal shorthand mean your stars carry most of the signal; your words carry the texture. The phrase itself is more reliable than generic praise words.',
      stats: [
        { label: 'Reviews using it', value: String(sig.count) },
        { label: 'Their mean rating', value: star(sig.mean) },
        { label: 'Mean review length', value: `${lang.meanWords} words` },
      ],
      filmIds: sig.filmIds,
      n: sig.count,
      confidence: sig.count >= 10 ? 'medium' : 'low',
      evidence: 'review-text',
    })
  }

  // ── Exceptions vs. the taste model ─────────────────────────────────────
  const resid = (ctx.model.report.available ? rated : [])
    .map((r) => ({ r, gap: r.rating! - (ctx.model.cvPredictions.get(r.film.id) ?? base.mean) }))
    .sort((a, b) => b.gap - a.gap)
  const over = resid.slice(0, 4), under = resid.slice(-4).reverse()
  if (resid.length >= 8) add({
    id: 'exceptions',
    category: 'exception',
    title: 'The films your taste model never saw coming',
    finding: `Based on everything else you've rated, ${over.slice(0, 3).map((x) => `${x.r.film.title} should have been a ${star(ctx.model.cvPredictions.get(x.r.film.id)!)}`).join('; ')} — you gave them ${over.slice(0, 3).map((x) => star(x.r.rating!)).join(', ')}. In the other direction: ${under.slice(0, 3).map((x) => `${x.r.film.title} (${star(x.r.rating!)})`).join(', ')}.`,
    explanation: 'These are films whose attributes (genre, length, people, era, acclaim) did not predict your reaction. They are where the personal, unquantifiable part of your taste lives.',
    stats: [...over, ...under].map((x) => ({ label: x.r.film.title, value: `${star(x.r.rating!)} vs predicted ${ctx.model.cvPredictions.get(x.r.film.id)!.toFixed(1)}` })),
    filmIds: [...over, ...under].map((x) => x.r.film.id),
    n: rated.length,
    confidence: 'low',
    evidence: 'interpretation',
    speculative: true,
  })

  // ── 12 · The films that define you ─────────────────────────────────────
  const defining = definingFilms(rated, base)
  add({
    id: 'defining',
    category: 'defining',
    title: 'The films that define you',
    finding: `A shortlist chosen to cover the widest range of your strongest preferences — each film is highly rated and adds a trait the others don't: ${defining.map((d) => d.r.film.title).join(', ')}.`,
    explanation: 'Selected greedily: each pick maximises rating plus the number of new high-affinity traits (genres, people, eras, regions) it brings to the set.',
    stats: defining.map((d) => ({ label: d.r.film.title, value: d.adds.slice(0, 3).join(' · ') })),
    filmIds: defining.map((d) => d.r.film.id),
    n: rated.length,
    confidence: 'medium',
    evidence: 'interpretation',
  })

  // ── Five-star universe ─────────────────────────────────────────────────
  const links: AppData['fiveStar']['links'] = []
  for (let i = 0; i < topSet.length; i++)
    for (let j = i + 1; j < topSet.length; j++) {
      const a = topSet[i], b = topSet[j]
      const reasons = [
        ...a.directors.filter((x) => b.directors.includes(x)).map((x) => `dir. ${x}`),
        ...a.writers.filter((x) => b.writers.includes(x) && !a.directors.includes(x)).map((x) => `writer ${x}`),
        ...a.cast.filter((x) => b.cast.includes(x)).slice(0, 2),
        ...a.composers.filter((x) => b.composers.includes(x)).map((x) => `music ${x}`),
        ...a.cinematographers.filter((x) => b.cinematographers.includes(x)).map((x) => `DP ${x}`),
        ...(a.franchise && a.franchise === b.franchise ? [a.franchise] : []),
      ]
      const sharedGenres = a.genres.filter((g) => b.genres.includes(g))
      if (reasons.length || sharedGenres.length >= 3) links.push({ a: a.film.id, b: b.film.id, reasons: reasons.length ? reasons : [sharedGenres.join(' / ')] })
    }

  return {
    insights: dedupe(insights),
    fiveStar: { filmIds: topSet.map((r) => r.film.id), threshold, traits: formulaStats, links },
  }

  function labelOf(r: AffinityRow, capital = false): string {
    const label =
      r.kind === 'subgenre' ? `${r.key} films`
        : r.kind === 'genre' ? `${r.key} films`
          : r.kind === 'franchise' ? `${r.key.replace(/^the /i, '')} films`
            : r.kind === 'runtime' ? `${r.key} films`
              : r.kind === 'decade' ? `films from the ${r.key}`
                : r.kind === 'region' ? `films from ${r.key}`
                  : r.kind === 'prestige' ? `${r.key}-recognised films`
                    : `${kindName[r.kind] ?? r.kind} ${r.key}`
    return capital ? label.charAt(0).toUpperCase() + label.slice(1) : label
  }
}

/** Plain-English adjectives describing how the watchlist differs from watched films. */
export function watchlistContrast(rows: { label: string; wl: number; w: number }[], medYearWl: number, medYearW: number): string[] {
  const d = (label: string) => {
    const r = rows.find((x) => x.label === label)
    return r ? r.wl - r.w : 0
  }
  const out: string[] = []
  if (medYearW - medYearWl >= 3) out.push('older')
  if (d('Not in English') >= 0.05) out.push('more international')
  if (d('Major-award recognised') >= 0.05) out.push('more acclaimed')
  if (d('Drama') >= 0.08) out.push('more dramatic')
  if (d('Part of a franchise') <= -0.1) out.push('far less franchise-driven')
  if (d('Horror') >= 0.05) out.push('more horror-curious')
  return out
}

function runtimeByGenre(rated: FilmRecord[], base: { mean: number }): Stat[] {
  const out: Stat[] = []
  for (const g of ['Action', 'Drama', 'Comedy', 'Science Fiction']) {
    const inG = rated.filter((r) => r.genres.includes(g) && r.runtime)
    const long = inG.filter((r) => r.runtime! >= 130).map((r) => r.rating!)
    const short = inG.filter((r) => r.runtime! < 130).map((r) => r.rating!)
    if (long.length >= 4 && short.length >= 4)
      out.push({ label: `${g}: 130+ vs shorter`, value: `${shrink(long, base.mean, 4).toFixed(2)} vs ${shrink(short, base.mean, 4).toFixed(2)}★`, hint: `n=${long.length} / ${short.length}` })
  }
  return out
}

/** Most frequent 2-word phrase (excluding filler) that's over-represented in ≥4★ reviews. */
function signaturePhrase(ctx: AnalysisContext): { phrase: string; count: number; mean: number; filmIds: string[] } | null {
  const reviews = ctx.dataset.reviews.filter((r) => r.rating !== null && r.text.trim())
  const grams = new Map<string, { n: number; ratings: number[]; films: string[] }>()
  const filler = new Set(['of the', 'in the', 'this movie', 'this film', 'it was', 'the movie', 'the film', 'i was', 'to be', 'and the', 'it is', 'is a', 'was a', 'of this', 'on the', 'for the', 'to the', 'and i', 'at the', 'i think', 'but i', 'a lot', 'one of', 'i love', 'i loved', 'loved the', 'love the', 'so much', 'the best', 'such a', 'of my'])
  for (const r of reviews) {
    const toks = tokenize(r.text)
    const seen = new Set<string>()
    for (let i = 0; i < toks.length - 1; i++) seen.add(`${toks[i]} ${toks[i + 1]}`)
    for (const g of seen) {
      if (filler.has(g)) continue
      const e = grams.get(g) ?? { n: 0, ratings: [], films: [] }
      e.n++
      e.ratings.push(r.rating!)
      e.films.push(r.filmId)
      grams.set(g, e)
    }
  }
  const best = [...grams]
    .filter(([, e]) => e.n >= 5 && mean(e.ratings) >= ctx.base.mean + 0.25)
    .sort((a, b) => b[1].n - a[1].n)[0]
  return best ? { phrase: best[0], count: best[1].n, mean: round(mean(best[1].ratings)), filmIds: [...new Set(best[1].films)] } : null
}

function definingFilms(rated: FilmRecord[], base: { mean: number }, k = 10): { r: FilmRecord; adds: string[] }[] {
  const traitsOf = (r: FilmRecord) => [
    ...r.genres.map((g) => `genre:${g}`),
    ...r.directors.slice(0, 1).map((d) => `dir:${d}`),
    r.decade ? `decade:${r.decade}s` : '',
    r.region ? `region:${r.region}` : '',
    r.animated ? 'form:animated' : '',
    r.runtime && r.runtime >= 150 ? 'scale:epic' : '',
    r.franchise ? `series:${r.franchise}` : '',
    r.englishLanguage === false ? 'lang:non-English' : '',
  ].filter(Boolean)
  const pool = rated.filter((r) => r.rating! >= Math.min(4.5, base.mean + 0.75) && r.meta)
  const chosen: { r: FilmRecord; adds: string[] }[] = []
  const covered = new Set<string>()
  const usedSeries = new Set<string>()
  // Title family ("Spider-Man: …", "The Lord of the Rings: …") — catches series Wikidata files under different items.
  const family = (r: FilmRecord) => r.film.title.split(/:| – | - /)[0].trim().toLowerCase()
  const usedFamilies = new Set<string>()
  while (chosen.length < k && pool.length) {
    let best: { r: FilmRecord; score: number; adds: string[] } | null = null
    for (const r of pool) {
      if (chosen.some((c) => c.r === r)) continue
      if ((r.franchise && usedSeries.has(r.franchise)) || usedFamilies.has(family(r))) continue
      const adds = traitsOf(r).filter((t) => !covered.has(t))
      const score = (r.rating! - base.mean) * 2 + adds.length + (r.film.isProfileFavorite ? 1.5 : 0) + (r.viewings.length > 1 ? 0.5 : 0)
      if (!best || score > best.score) best = { r, score, adds }
    }
    if (!best) break
    best.adds.forEach((t) => covered.add(t))
    if (best.r.franchise) usedSeries.add(best.r.franchise)
    usedFamilies.add(family(best.r))
    chosen.push({ r: best.r, adds: best.adds.map((t) => t.split(':')[1]) })
  }
  return chosen
}

function dedupe(xs: Insight[]): Insight[] {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
}

export type { Confidence }
