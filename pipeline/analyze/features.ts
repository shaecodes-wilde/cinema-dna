import type { Dataset, Film, FilmMetadata, MetadataFile, Viewing } from '../../shared/types.ts'

/** One joined record per film: personal data + (optional) metadata. All analysis starts here. */
export interface FilmRecord {
  film: Film
  meta: FilmMetadata | null
  rating: number | null
  viewings: Viewing[]
  /** viewings with a trustworthy date (not backfilled/approximate) */
  datedViewings: Viewing[]
  decade: number | null
  genres: string[]
  subgenres: string[]
  directors: string[]
  writers: string[]
  cast: string[]
  cinematographers: string[]
  composers: string[]
  countries: string[]
  languages: string[]
  runtime: number | null
  runtimeBucket: string | null
  notability: NotabilityTier | null
  prestige: string[]
  franchise: string | null
  animated: boolean
  documentary: boolean
  englishLanguage: boolean | null
  usOnly: boolean | null
  region: string | null
}

export type NotabilityTier = 'canon' | 'well-known' | 'mid' | 'niche'

export function notabilityTier(sitelinks: number): NotabilityTier {
  if (sitelinks >= 60) return 'canon'
  if (sitelinks >= 35) return 'well-known'
  if (sitelinks >= 15) return 'mid'
  return 'niche'
}

export const NOTABILITY_LABEL: Record<NotabilityTier, string> = {
  canon: 'Global canon (60+ Wikipedias)',
  'well-known': 'Widely known (35–59)',
  mid: 'Mid-profile (15–34)',
  niche: 'Niche (<15)',
}

export function runtimeBucket(min: number | null): string | null {
  if (!min) return null
  if (min < 90) return '< 90 min'
  if (min < 110) return '90–109 min'
  if (min < 130) return '110–129 min'
  if (min < 150) return '130–149 min'
  return '150+ min'
}
export const RUNTIME_BUCKETS = ['< 90 min', '90–109 min', '110–129 min', '130–149 min', '150+ min']

const PRESTIGE: [RegExp, string][] = [
  [/^Academy Award/i, 'Academy Awards'],
  [/^BAFTA|British Academy Film Award/i, 'BAFTA'],
  [/^Golden Globe/i, 'Golden Globes'],
  [/Palme d'Or|Cannes|Grand Prix \(Cannes/i, 'Cannes'],
  [/Golden Lion|Venice|Silver Lion/i, 'Venice'],
  [/Golden Bear|Silver Bear|Berlin/i, 'Berlinale'],
  [/Independent Spirit/i, 'Independent Spirit'],
  [/Annie Award/i, 'Annie Awards'],
  [/César Award/i, 'César'],
  [/Sundance/i, 'Sundance'],
]

export function prestigeBodies(labels: string[]): string[] {
  const out = new Set<string>()
  for (const l of labels) for (const [re, name] of PRESTIGE) if (re.test(l)) out.add(name)
  return [...out]
}

const REGIONS: Record<string, string> = {
  'United States': 'United States', 'United States of America': 'United States',
  'United Kingdom': 'UK & Ireland', Ireland: 'UK & Ireland',
  Canada: 'Canada',
  Japan: 'East Asia', 'South Korea': 'East Asia', China: 'East Asia', "People's Republic of China": 'East Asia', 'Hong Kong': 'East Asia', Taiwan: 'East Asia',
  India: 'South Asia',
  France: 'Continental Europe', Germany: 'Continental Europe', Italy: 'Continental Europe', Spain: 'Continental Europe', Finland: 'Continental Europe', Sweden: 'Continental Europe', Denmark: 'Continental Europe', Norway: 'Continental Europe', Belgium: 'Continental Europe', Netherlands: 'Continental Europe', Poland: 'Continental Europe', Austria: 'Continental Europe', Switzerland: 'Continental Europe', Hungary: 'Continental Europe', 'Czech Republic': 'Continental Europe', Greece: 'Continental Europe', Portugal: 'Continental Europe', Iceland: 'Continental Europe', Romania: 'Continental Europe',
  Australia: 'Oceania', 'New Zealand': 'Oceania',
  Mexico: 'Latin America', Brazil: 'Latin America', Argentina: 'Latin America', Chile: 'Latin America', Colombia: 'Latin America',
}

/** Primary production region: the first non-US country if any (co-productions count as international). */
export function primaryRegion(countries: string[]): string | null {
  if (!countries.length) return null
  const regions = countries.map((c) => REGIONS[c] ?? 'Other')
  return regions.find((r) => r !== 'United States') ?? 'United States'
}

export const normCountry = (c: string) => (c === 'United States of America' ? 'United States' : c)

export function buildRecords(dataset: Dataset, metadata: MetadataFile | null): FilmRecord[] {
  const viewingsByFilm = new Map<string, Viewing[]>()
  for (const v of dataset.viewings) viewingsByFilm.set(v.filmId, [...(viewingsByFilm.get(v.filmId) ?? []), v])

  return dataset.films.map((film) => {
    // Low-confidence (partial-title) matches are kept for the audit but never feed the analysis.
    const candidate = metadata?.films[film.id] ?? null
    const meta = candidate && candidate.match.confidence !== 'low' ? candidate : null
    const viewings = (viewingsByFilm.get(film.id) ?? []).sort((a, b) =>
      (a.watchedDate ?? a.loggedDate).localeCompare(b.watchedDate ?? b.loggedDate),
    )
    const names = (xs: { name: string }[] | undefined) => [...new Set((xs ?? []).map((x) => x.name))]
    const countries = [...new Set((meta?.countries ?? []).map(normCountry))]
    const languages = meta?.languages ?? []
    const year = film.year ?? meta?.releaseYear ?? null
    return {
      film,
      meta,
      rating: film.rating,
      viewings,
      datedViewings: viewings.filter((v) => v.dateQuality === 'live' || v.dateQuality === 'delayed'),
      decade: year ? Math.floor(year / 10) * 10 : null,
      genres: meta?.genres ?? [],
      subgenres: meta?.subgenres ?? [],
      directors: names(meta?.directors),
      writers: names(meta?.writers),
      cast: names(meta?.cast),
      cinematographers: names(meta?.cinematographers),
      composers: names(meta?.composers),
      countries,
      languages,
      runtime: meta?.runtime ?? null,
      runtimeBucket: runtimeBucket(meta?.runtime ?? null),
      notability: meta ? notabilityTier(meta.sitelinks) : null,
      prestige: prestigeBodies([...(meta?.awardsWon ?? []), ...(meta?.nominations ?? [])]),
      franchise: meta?.series[0] ?? null,
      animated: meta?.isAnimated ?? false,
      documentary: meta?.isDocumentary ?? false,
      englishLanguage: languages.length ? languages.includes('English') : null,
      usOnly: countries.length ? countries.every((c) => c === 'United States') : null,
      region: primaryRegion(countries),
    }
  })
}

/** Watched date of the first trustworthy viewing (or null). */
export const firstDated = (r: FilmRecord) => r.datedViewings[0]?.watchedDate ?? null

/** Years between release and the first dated viewing (0 = same calendar year). */
export function releaseLag(r: FilmRecord): number | null {
  const d = firstDated(r)
  if (!d || !r.film.year) return null
  return Number(d.slice(0, 4)) - r.film.year
}
