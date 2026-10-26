import type { AppData } from '../../shared/app-types.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Self-contained, printable editorial report (no external assets; prints cleanly to PDF). */
export function renderReportHtml(data: AppData): string {
  const r = data.report
  const film = new Map(data.films.map((f) => [f.id, f]))
  const t = data.totals
  const shelf = (ids: string[] | undefined) =>
    ids?.length
      ? `<ul class="shelf">${ids
          .slice(0, 12)
          .map((id) => film.get(id))
          .filter(Boolean)
          .map((f) => `<li><span class="t">${esc(f!.title)}</span><span class="m">${f!.year ?? ''}${f!.rating ? ` · ${f!.rating}★` : ''}</span></li>`)
          .join('')}</ul>`
      : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.title)} — CINEMA DNA</title>
<style>
  :root { --ink:#efe8dc; --muted:#a39d92; --line:#2a2724; --bg:#0f0e0d; --accent:#e0a43a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font: 17px/1.65 Georgia, 'Times New Roman', serif; }
  main { max-width: 760px; margin: 0 auto; padding: 72px 28px 96px; }
  .eyebrow { font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: .32em; text-transform: uppercase; color: var(--accent); }
  h1 { font-size: clamp(44px, 8vw, 76px); line-height: .95; font-weight: 400; letter-spacing: -.02em; margin: 18px 0 14px; }
  .sub { color: var(--muted); font-style: italic; margin: 0 0 40px; }
  .facts { display:grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border:1px solid var(--line); margin: 0 0 56px; }
  .facts div { background: var(--bg); padding: 16px; font: 12px/1.3 ui-sans-serif, system-ui, sans-serif; color: var(--muted); }
  .facts b { display:block; font: 400 28px/1.1 Georgia, serif; color: var(--ink); margin-bottom: 4px; }
  section { margin: 0 0 52px; break-inside: avoid-page; }
  .kicker { font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; color: var(--accent); letter-spacing: .2em; }
  h2 { font-weight: 400; font-size: 32px; margin: 8px 0 18px; letter-spacing: -.01em; }
  p { margin: 0 0 16px; }
  section:first-of-type p:first-of-type::first-letter { float:left; font-size: 64px; line-height: .9; padding: 6px 10px 0 0; color: var(--accent); }
  .shelf { list-style:none; padding:0; margin: 18px 0 0; columns: 2; column-gap: 28px; font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; }
  .shelf li { break-inside: avoid; border-top: 1px solid var(--line); padding: 7px 0; display:flex; justify-content: space-between; gap: 12px; }
  .shelf .m { color: var(--muted); white-space: nowrap; }
  footer { border-top: 1px solid var(--line); padding-top: 18px; color: var(--muted); font: 12px/1.6 ui-sans-serif, system-ui, sans-serif; }
  @media print { :root { --ink:#141210; --muted:#5d5850; --line:#d9d3c8; --bg:#fff; --accent:#9a6a12; } main { padding: 0; } }
  @media (max-width: 600px) { .facts { grid-template-columns: repeat(2, 1fr); } .shelf { columns: 1; } }
</style></head>
<body><main>
  <div class="eyebrow">Cinema DNA · Identity report</div>
  <h1>${esc(r.title)}</h1>
  <p class="sub">${esc(data.identity.subtitle)}</p>
  <div class="facts">
    <div><b>${t.watchedFilms}</b>films watched</div>
    <div><b>${t.diaryViewings}</b>diary viewings</div>
    <div><b>${t.meanRating.toFixed(2)}★</b>average rating</div>
    <div><b>${t.reviews}</b>reviews written</div>
  </div>
  ${r.sections
    .map(
      (s) => `<section><div class="kicker">${esc(s.kicker ?? '')}</div><h2>${esc(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${shelf(s.filmIds)}</section>`,
    )
    .join('\n  ')}
  <footer>${esc(r.subtitle)}. Ratings and dates come from your Letterboxd export; film metadata from ${esc(data.source.metadataSources.join(' + ') || 'none')}.
  Patterns are correlations in your own history, not causal claims. Generated ${esc(data.generatedAt.slice(0, 10))}.</footer>
</main></body></html>
`
}

export function renderReportMarkdown(data: AppData): string {
  const r = data.report
  return [
    `# ${r.title}`,
    `*${data.identity.subtitle}*`,
    '',
    `> ${r.subtitle}`,
    '',
    ...r.sections.flatMap((s) => [`## ${s.kicker ?? ''} ${s.heading}`.trim(), '', ...s.paragraphs.flatMap((p) => [p, ''])]),
  ].join('\n')
}

/** The long-form written analysis: every DNA dimension and insight with its evidence. */
export function renderTasteAnalysisMarkdown(data: AppData): string {
  const film = new Map(data.films.map((f) => [f.id, f]))
  const fl = (ids: string[], n = 6) =>
    ids.slice(0, n).map((id) => film.get(id)).filter(Boolean).map((f) => `*${f!.title}*${f!.rating ? ` (${f!.rating}★)` : ''}`).join(', ')
  const t = data.totals
  const q = data.quality.metadata
  const out: string[] = []
  out.push(`# CINEMA DNA — Taste analysis for @${data.profile.username}`, '')
  out.push(`*${data.identity.title} — ${data.identity.subtitle}*`, '')
  out.push(`Source: \`${data.source.archive}\` (exported ${data.source.exportedAt ?? 'n/a'}) · metadata: ${data.source.metadataSources.join(' + ') || 'none'} · generated ${data.generatedAt}`, '')
  out.push('## At a glance', '')
  out.push('| Measure | Value |', '|---|---|')
  out.push(
    `| Films watched | ${t.watchedFilms} |`,
    `| Films rated | ${t.ratedFilms} |`,
    `| Diary viewings | ${t.diaryViewings} (${t.rewatchViewings} rewatches) |`,
    `| Reviews | ${t.reviews} across ${t.reviewedFilms} films |`,
    `| Mean / median rating | ${t.meanRating}★ / ${t.medianRating}★ (SD ${t.sdRating}) |`,
    `| Estimated hours | ${t.hoursWatched ?? 'n/a'} (runtime known for ${Math.round(t.hoursCoverage * 100)}% of films) |`,
    `| Metadata coverage | ${q.watchedMatched}/${q.watchedTotal} watched films matched |`,
    '',
  )
  out.push('## Opening', '', ...data.identity.intro.flatMap((p) => [p, '']))
  out.push('## Cinematic DNA', '')
  out.push('| Dimension | Score | Rating lift | n | Confidence |', '|---|---:|---:|---:|---|')
  for (const d of data.dna) out.push(`| ${d.name} | ${d.score} | ${d.affinity === null ? '—' : `${d.affinity >= 0 ? '+' : ''}${d.affinity.toFixed(2)}★`} | ${d.n} | ${d.confidence} |`)
  out.push('')
  for (const d of data.dna) {
    out.push(`### ${d.name} — ${d.score}/100`, '', `**${d.headline}.** ${d.definition} Value: ${d.value}.`, '')
    if (d.filmIds.length) out.push(`Evidence: ${fl(d.filmIds)}.`, '')
  }
  out.push('## Findings', '')
  const order = ['formula', 'intersection', 'contradiction', 'disappointment', 'hidden-favourite', 'underrated-corner', 'loyalty', 'rewatch', 'language', 'generosity', 'evolution', 'watchlist', 'exception', 'defining']
  for (const i of [...data.insights].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))) {
    out.push(`### ${i.title}`, '')
    out.push(`*${i.category} · n = ${i.n} · confidence: ${i.confidence} · evidence: ${i.evidence}${i.speculative ? ' · interpretive' : ''}*`, '')
    out.push(`**Finding.** ${i.finding}`, '')
    out.push(`**Why it matters.** ${i.explanation}`, '')
    if (i.stats.length) out.push(i.stats.map((s) => `- ${s.label}: ${s.value}`).join('\n'), '')
    if (i.filmIds.length) out.push(`Films: ${fl(i.filmIds, 8)}.`, '')
  }
  out.push('## Affinity tables', '')
  for (const kind of ['genre', 'decade', 'runtime', 'region', 'director', 'composer', 'cinematographer']) {
    const rows = (data.affinities[kind] ?? []).filter((r) => r.n >= (kind === 'genre' || kind === 'decade' || kind === 'runtime' || kind === 'region' ? 1 : 2))
    if (!rows.length) continue
    out.push(`### ${kind[0].toUpperCase() + kind.slice(1)}`, '', '| Group | n | Mean | Shrunk | Δ vs you | Confidence |', '|---|---:|---:|---:|---:|---|')
    for (const r of rows.slice(0, 15)) out.push(`| ${r.label} | ${r.n} | ${r.mean} | ${r.shrunk} | ${r.delta >= 0 ? '+' : ''}${r.delta} | ${r.confidence} |`)
    out.push('')
  }
  out.push('## Taste model', '')
  const m = data.model
  out.push(
    `A ridge regression over ${m.features} film attributes (genres, sub-genres, decade, runtime, region, notability, awards, franchise, and leave-one-out "track record" of the film's director, writers, cast, cinematographer and composer), fit on ${m.n} rated films with λ = ${m.lambda} chosen by 10-fold cross-validation.`,
    '',
    `Cross-validated RMSE **${m.cvRmse}★** vs **${m.baselineRmse}★** for always guessing your average (${Math.round((1 - m.cvRmse / m.baselineRmse) * 100)}% better); correlation with your actual ratings r = ${m.correlation}. That is a modest but real signal — your taste is only partly predictable from metadata, which is exactly why the exceptions are interesting.`,
    '',
    `Strongest positive weights: ${m.topPositive.map((w) => `${w.feature} (${w.weight >= 0 ? '+' : ''}${w.weight})`).join(', ')}.`,
    '',
    `Strongest negative weights: ${m.topNegative.map((w) => `${w.feature} (${w.weight})`).join(', ')}.`,
    '',
  )
  out.push('## Top recommendations', '')
  for (const rec of data.recommendations.slice(0, 15))
    out.push(`- **${rec.title}** (${rec.year ?? '?'}) — predicted ${rec.predicted.toFixed(2)}★ · ${rec.source === 'watchlist' ? 'on your watchlist' : 'new discovery'}${rec.uncertain ? ' · ⚠ ' + rec.uncertainty.join('; ') : ''}  \n  ${rec.reasons.slice(0, 2).join(' · ')}`)
  out.push('')
  out.push('## Method & limitations', '')
  out.push(
    '- **Ratings**: each film uses its current Letterboxd rating (`ratings.csv`). Diary ratings are kept as history and used for rewatch/revision analysis.',
    '- **Shrinkage**: group averages are empirical-Bayes estimates pulled toward your overall mean by k pseudo-films (k = 6 for genres/decades, 3 for people). A single 5★ film moves a group only a little.',
    '- **Confidence**: "high" requires ≥ 8 films and a deviation ≥ 2 standard errors; "medium" ≥ 4 films and ≥ 1.2 SE; otherwise "low".',
    '- **Dates**: viewing timelines use diary watch dates on/after your join date. Earlier dates were logged retroactively and are flagged as backfilled; `watched.csv` dates are never treated as viewing dates.',
    `- **Metadata**: Wikidata (CC0), matched primarily by Letterboxd film ID (P6127), else exact title + year. ${q.unmatched.length} titles (mostly documentaries, TV and shorts) are unmatched and excluded from metadata-driven analysis.`,
    '- **Review language**: transparent keyword lexicons; reviews are short, so these are tendencies, not diagnoses.',
    '- **Correlation, not causation**: every pattern describes your history; none claims a film attribute *causes* your rating.',
    '',
  )
  return out.join('\n')
}
