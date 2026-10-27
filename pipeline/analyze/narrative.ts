import { MIN_RATED_FILMS, type AppData, type DnaDimension, type Insight, type ReportSection, type Stat } from '../../shared/app-types.ts'
import type { AnalysisContext } from './index.ts'
import { mean } from './stats.ts'

type NarrativeInput = AnalysisContext & {
  dna: DnaDimension[]
  insights: Insight[]
  partial: Omit<AppData, 'identity' | 'dna' | 'insights' | 'report' | 'fiveStar'>
}

/**
 * Turns computed evidence into prose. Every sentence is conditional on the numbers that
 * justify it; nothing here introduces a fact that isn't in the analysis bundle.
 */
export function buildNarrative(x: NarrativeInput): { identity: AppData['identity']; report: AppData['report'] } {
  if (x.rated.length < MIN_RATED_FILMS) {
    const msg = `CINEMA DNA reads your taste from your star ratings, and this export has ${x.rated.length} rated film${x.rated.length === 1 ? '' : 's'}. Rate at least ${MIN_RATED_FILMS} films on Letterboxd (more is better: most patterns need 20–50), export again and re-run the import.`
    return {
      identity: { title: 'Not enough ratings yet', subtitle: msg, intro: [msg], standouts: [] },
      report: { title: 'Not enough ratings yet', subtitle: `@${x.partial.profile.username}`, sections: [{ heading: 'What happened', paragraphs: [msg] }] },
    }
  }

  const { dna, insights, partial, base, affinities, byId, rated } = x
  const d = (id: string) => dna.find((v) => v.id === id)
  const ins = (id: string) => insights.find((v) => v.id === id)
  const t = partial.totals
  const title = (id: string) => byId.get(id)?.film.title ?? id
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  const star = (v: number) => `${v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}★`
  const pct = (v: number) => `${Math.round(v)}%`

  const present = d('present'), time = d('time'), world = d('world'), rewatch = d('rewatch')
  const longRow = affinities.runtime.find((r) => r.key === '150+ min')
  const canon = ins('canon')
  const prestigeGap = canon ? Number(canon.stats.find((s) => s.label === 'Gap')?.value.replace('−', '-').replace('★', '').replace('+', '') ?? 0) : 0
  const genreAgnostic = !!ins('genre-agnostic')
  const auteur = d('auteur'), dark = d('dark')

  // ── Identity title ───────────────────────────────────────────────────────
  const adjective =
    present && present.score >= 40 ? 'Opening-Night'
      : time && time.score >= 30 ? 'Time-Travelling'
        : world && world.score >= 35 ? 'Globetrotting'
          : rewatch && rewatch.score >= 25 ? 'Devoted'
            : 'Restless'
  const noun =
    longRow && longRow.delta >= 0.2 && prestigeGap >= 0.3 ? 'Maximalist'
      : prestigeGap >= 0.3 ? 'Canon Seeker'
        : (auteur?.affinity ?? 0) >= 0.2 ? 'Auteurist'
          : (dark?.affinity ?? 0) >= 0.2 ? 'Thrill Seeker'
            : genreAgnostic ? 'Omnivore'
              : 'Cinephile'
  const identityTitle = `The ${adjective} ${noun}`

  const topGenres = Object.entries(
    rated.reduce<Record<string, number>>((a, r) => (r.genres.forEach((g) => (a[g] = (a[g] ?? 0) + 1)), a), {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g.toLowerCase())
  const fives = rated.filter((r) => r.rating === 5)
  const pairs = insights.filter((i) => i.category === 'intersection')
  const pairRows = pairs
    .map((p) => partial.genrePairs.find((g) => `pair-${g.a}-${g.b}` === p.id))
    .filter((p) => p !== undefined)
  const disappoint = insights.filter((i) => i.category === 'disappointment')
  const contradiction = insights.find((i) => i.id.startsWith('contradiction-'))
  const drift = ins('rewatch-drift')
  const fun = ins('language-fun')
  const sig = ins('language-signature')
  const watchlist = ins('watchlist')
  const loyalty = ins('director-loyalty')
  const defining = ins('defining')
  const evolution = ins('evolution')
  const hidden = insights.filter((i) => i.category === 'hidden-favourite')
  const crew = ins('below-the-line')
  const driftUp = drift ? Number(drift.stats.find((s) => s.label === 'Up on rewatch')?.value ?? 0) : 0
  const driftDown = drift ? Number(drift.stats.find((s) => s.label === 'Down on rewatch')?.value ?? 0) : 0

  const subtitle =
    noun === 'Maximalist'
      ? `A ${genreAgnostic ? 'genre-agnostic' : 'wide-ranging'} viewer who rewards scale, ambition and craft — and keeps 5★ for the rare film that earns it.`
      : `A ${genreAgnostic ? 'genre-agnostic' : 'wide-ranging'} viewer whose ratings follow craft more than labels.`

  // ── Opening editorial ────────────────────────────────────────────────────
  const intro: string[] = []
  intro.push(
    `Since ${partial.profile.joined ? partial.profile.joined.slice(0, 4) : 'joining Letterboxd'}, ${partial.profile.name} has logged ${t.diaryViewings} diary entries across ${t.watchedFilms} films${t.hoursWatched ? ` — roughly ${t.hoursWatched.toLocaleString('en-US')} hours in the dark` : ''}. ` +
      `${present && present.score >= 40 ? `This is someone who watches cinema in the present tense: ${pct(present.score)} of first viewings happen within a year of release.` : ''}`,
  )
  {
    const ambition = !!longRow && longRow.delta >= 0.15
    const clauses = [
      ambition ? `films of 150 minutes or more average ${star(longRow!.mean)}` : '',
      prestigeGap >= 0.3 ? `award-recognised films outscore the rest by ${prestigeGap.toFixed(2)}★` : '',
      pairRows[0] ? `films tagged both ${pairRows[0].a.toLowerCase()} and ${pairRows[0].b.toLowerCase()} rate above your average` : '',
    ].filter(Boolean)
    const joined = list(clauses)
    const signals = !joined ? '' : ambition ? `What does predict them is ambition: ${joined}.` : `${joined[0].toUpperCase()}${joined.slice(1)}.`
    const opening = genreAgnostic ? `On paper the diet is ${list(topGenres)}. But genre turns out to be a poor predictor of the stars.` : ''
    const paragraph = [opening, signals].filter(Boolean).join(' ')
    if (paragraph) intro.push(paragraph)
  }
  intro.push(
    `The grading is ${base.mean >= 3.25 ? 'generous' : base.mean >= 2.75 ? 'measured' : 'tough'} — a ${star(base.mean)} average${fives.length <= Math.max(1, rated.length * 0.08) ? ` — and perfection is rationed: only ${fives.length} ${fives.length === 1 ? 'film holds' : 'films hold'} 5★` : `, with ${fives.length} films at 5★`}${fives.length === 1 ? `: ${fives[0].film.title}` : fives.length ? `, among them ${list(fives.slice(0, 4).map((r) => r.film.title))}` : ''}.` +
      `${driftUp > driftDown ? ' And rewatches tend to raise your stars.' : driftDown > driftUp ? ' And rewatches tend to lower your stars.' : ''}`,
  )

  const standouts: Stat[] = [
    ...(longRow ? [{ label: '150+ min films', value: star(longRow.mean), hint: `${longRow.n} films; your average is ${star(base.mean)}` }] : []),
    ...(present ? [{ label: 'First watched near release', value: pct(present.score) }] : []),
    { label: '5★ films', value: String(fives.length), hint: `of ${t.ratedFilms} rated` },
    ...(rewatch ? [{ label: 'Rewatch share', value: pct(rewatch.score) }] : []),
    ...(sig ? [{ label: 'Signature phrase', value: `"${sig.title.match(/"(.+)"/)?.[1] ?? ''}"` }] : []),
  ]

  // A star rubric in the bio, if the user wrote one (e.g. "5 Stars: masterpiece | 3 Stars: good").
  const rubric = partial.profile.bio
    .split('\n')
    .find((l) => /\d\s*(★|stars?)\b/i.test(l))
    ?.replace(/\/\//g, '')
    .trim()
  const wlLean = watchlist?.stats.find((s) => s.label === 'Watchlist leans')?.value
  const timeLift = time?.affinity ?? null
  const worldLift = world?.affinity ?? null
  const franchiseDim = d('franchise')

  // ── Report ───────────────────────────────────────────────────────────────
  const sections: ReportSection[] = []
  sections.push({
    kicker: 'I.',
    heading: 'The identity',
    paragraphs: [
      `${identityTitle}. The phrase is not a horoscope; it is distilled from ${t.ratedFilms} ratings and ${t.reviews} reviews. ${intro[0]}`,
      `${rubric ? `Your profile spells out a scale — "${rubric}". ` : ''}In practice your average is ${star(base.mean)}${base.mean > 3 ? ', which makes a 3★ a below-average grade' : ''}: ${Math.round(rated.filter((r) => r.rating! <= 3).length / rated.length * 100)}% of your films sit at 3★ or lower, and anything at 4★ is a genuine recommendation.`,
    ],
  })
  const prefParas: string[] = []
  if (genreAgnostic) prefParas.push(ins('genre-agnostic')!.finding + ' ' + ins('genre-agnostic')!.explanation)
  if (ins('runtime')) prefParas.push(`${ins('runtime')!.finding} ${ins('runtime')!.explanation}`)
  if (canon) prefParas.push(`${canon.finding} ${canon.explanation}`)
  if (pairRows.length) {
    prefParas.push(
      `Some genre overlaps rate above your average: ${pairRows
        .map((p) => `${p.a.toLowerCase()} with ${p.b.toLowerCase()} (${p.n} films, +${p.synergy.toFixed(2)}★ vs your average)`)
        .join('; ')}. Each genre's own average includes these films, so this shows which overlaps you rate highly, not that combining genres adds anything.`,
    )
  }
  sections.push({ kicker: 'II.', heading: 'What actually moves you', paragraphs: prefParas })

  const formula = ins('five-star-formula')
  sections.push({
    kicker: 'III.',
    heading: 'The five-star formula',
    paragraphs: [
      formula ? formula.finding : '',
      fives.length
        ? `The 5★ shelf itself is small and specific: ${list(fives.map((r) => r.film.title))}. ${fives.filter((r) => r.animated).length >= 2 ? `${fives.filter((r) => r.animated).length} of the ${fives.length} are animated, against ${Math.round((rated.filter((r) => r.animated).length / rated.length) * 100)}% of everything you rate. ` : ''}${fives.filter((r) => r.viewings.length > 1).length >= 2 ? `${fives.filter((r) => r.viewings.length > 1).length} of them have been logged more than once; your favourites are films you go back to.` : ''}`
        : '',
    ].filter(Boolean),
    filmIds: fives.map((r) => r.film.id),
  })

  const patternParas: string[] = []
  if (contradiction) patternParas.push(`${contradiction.title}. ${contradiction.finding} ${contradiction.explanation}`)
  for (const i of disappoint.slice(0, 2)) patternParas.push(`${i.finding} ${i.explanation}`)
  if (drift) patternParas.push(`${drift.finding} ${drift.explanation}`)
  if (fun) patternParas.push(`Your vocabulary gives you away, too. ${fun.finding} ${fun.explanation}`)
  if (sig) patternParas.push(sig.finding)
  if (ins('acclaimed-misses')) patternParas.push(`${ins('acclaimed-misses')!.finding} ${ins('acclaimed-misses')!.explanation}`)
  sections.push({ kicker: 'IV.', heading: 'Hidden patterns and contradictions', paragraphs: patternParas })

  const peopleParas: string[] = []
  if (loyalty) peopleParas.push(loyalty.finding)
  if (crew) peopleParas.push(`${crew.finding} ${crew.explanation}`)
  if (hidden.length) peopleParas.push(`Smaller corners pay off disproportionately: ${hidden.map((h) => `${h.title.replace('Hidden favourite: ', '')} (${h.stats.find((s) => s.label === 'Raw mean')?.value} across ${h.n})`).join('; ')}.`)
  if (defining) peopleParas.push(`If one shelf had to explain you to a stranger, it would hold ${list(defining.filmIds.map(title))}. ${defining.explanation}`)
  sections.push({ kicker: 'V.', heading: 'Representative films and filmmakers', paragraphs: peopleParas, filmIds: defining?.filmIds })

  if (evolution) sections.push({ kicker: 'VI.', heading: 'How the taste has moved', paragraphs: [evolution.finding, evolution.explanation] })

  const unexplored: string[] = []
  const genreCounts = affinities.genre.reduce<Record<string, number>>((a, g) => ((a[g.key] = g.n), a), {})
  const thin = ['Documentary', 'Western', 'War', 'Music', 'Romance'].filter((g) => (genreCounts[g] ?? 0) <= 8)
  if (thin.length) unexplored.push(`Some territory is barely mapped: ${list(thin.map((g) => `${g.toLowerCase()} (${genreCounts[g] ?? 0} films)`))}. With samples this small, the ratings there say almost nothing either way — they are open questions, not verdicts.`)
  if (time) unexplored.push(`Only ${pct(time.score)} of your films predate 2000${world ? ` and ${pct(world.score)} come from outside the English-speaking West` : ''}.`)
  if (watchlist) unexplored.push(`${watchlist.finding} ${watchlist.explanation}`)
  sections.push({ kicker: 'VII.', heading: 'The unexplored map', paragraphs: unexplored })

  const close: string[] = []
  close.push(
    [
      'Put together, the evidence describes someone for whom cinema is an event.',
      present && present.score >= 40 ? 'You meet films close to their release,' : 'You seek films out,',
      `grade them ${base.mean >= 3.25 ? 'warmly but honestly' : 'on your own scale'}, and save your highest praise for films that are big in every sense`,
      `— ${[longRow && longRow.delta >= 0.15 ? 'long' : null, prestigeGap >= 0.3 ? 'acclaimed' : null, 'ambitious', pairs.length ? 'willing to mix registers' : null].filter(Boolean).join(', ')}.`,
      franchiseDim && franchiseDim.score >= 30 && (franchiseDim.affinity ?? 0) <= -0.05
        ? `Franchise instalments make up ${Math.round(franchiseDim.score)}% of your films and return less than the rest.`
        : '',
    ].join(' ').replace(' ,', ','),
  )
  close.push(
    [
      driftUp > driftDown && downs(insights) ? 'The most personal finding is the simplest: you trust a second viewing more than a first impression. The films you return to grow; the ones you only remember tend to shrink.' : '',
      wlLean ? `Your watchlist already knows where to go next — ${wlLean}.` : '',
      wlLean && ((timeLift ?? -1) >= 0 || (worldLift ?? -1) >= 0)
        ? `And on the evidence of your own ratings${(timeLift ?? -1) >= 0 ? ` (older films ${timeLift! >= 0 ? '+' : ''}${timeLift!.toFixed(2)}★` : ' ('}${(worldLift ?? -1) >= 0 ? `${(timeLift ?? -1) >= 0 ? ', ' : ''}world cinema +${worldLift!.toFixed(2)}★` : ''}), going there is a better bet than habit suggests.`
        : '',
    ].filter(Boolean).join(' '),
  )
  sections.push({ kicker: 'VIII.', heading: 'A closing reading', paragraphs: close })

  return {
    identity: { title: identityTitle, subtitle, intro: intro.filter(Boolean), standouts },
    report: {
      title: identityTitle,
      subtitle: `A cinematic identity report for ${partial.profile.name} (@${partial.profile.username}) · built from the Letterboxd export of ${partial.source.exportedAt?.slice(0, 10) ?? 'unknown date'}`,
      sections: sections.map((s) => ({ ...s, paragraphs: s.paragraphs.filter((p) => p && p.trim()) })).filter((s) => s.paragraphs.length),
    },
  }
}

function downs(insights: Insight[]): boolean {
  const g = insights.find((i) => i.id === 'rewatch-drift')
  return !!g && /moved only downward|downward \d+ times/.test(g.finding)
}

export { mean }
