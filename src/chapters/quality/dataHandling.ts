export function dataHandlingText(sources: string[]): string {
  const local = 'Your export file stays on this machine.'
  if (!sources.length) return `${local} No film metadata enrichment was run for this build.`
  const names = sources.map((id) => ({ wikidata: 'Wikidata', tmdb: 'TMDB' })[id] ?? id).join(' and ')
  return `${local} To add film metadata, the pipeline looks up film titles, years and Letterboxd slugs on ${names}.${sources.includes('tmdb') ? ' Poster images load from TMDB.' : ''}`
}
