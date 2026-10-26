/** Canonical genre vocabulary (mirrors the TMDB/Letterboxd genre set). */
export const CANONICAL_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy',
  'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
] as const
export type Genre = (typeof CANONICAL_GENRES)[number]

const RULES: [RegExp, Genre[]][] = [
  [/superhero/, ['Action', 'Adventure']],
  [/\baction\b|martial arts|kung fu|wuxia|heist|spy film|swashbuckler|disaster/, ['Action']],
  [/adventure|swashbuckler|survival|road movie|treasure/, ['Adventure']],
  [/animat|anime|stop.motion|claymation/, ['Animation']],
  [/comed|parody|satir|spoof|farce|mockumentary|sitcom/, ['Comedy']],
  [/crime|gangster|heist|noir|mafia|mob film|police|detective|caper|prison/, ['Crime']],
  [/documentary|docudrama/, ['Documentary']],
  [/drama|melodrama|coming.of.age|biographical|biopic|tragedy/, ['Drama']],
  [/family|children|kids/, ['Family']],
  [/fantasy|fairy tale|sword and sorcery|magic|mythologic/, ['Fantasy']],
  [/histor|biographical|biopic|period (piece|drama|film)|costume drama|epic film/, ['History']],
  [/horror|slasher|zombie|splatter|monster film|creature feature|vampire|werewolf|giallo|found footage/, ['Horror']],
  [/music|concert|dance film|rock film/, ['Music']],
  [/myster|whodunit|detective/, ['Mystery']],
  [/romance|romantic/, ['Romance']],
  [/science fiction|sci-fi|cyberpunk|space opera|dystopi|post-apocalyptic|time.travel|kaiju|tech noir|alien|apocalyptic/, ['Science Fiction']],
  [/thriller|suspense/, ['Thriller']],
  [/\bwar\b|anti-war|military/, ['War']],
  [/western/, ['Western']],
]

/** Maps a source genre label (e.g. "psychological thriller film") onto canonical genres. */
export function canonicalGenres(label: string): Genre[] {
  const l = label.toLowerCase()
  const out = new Set<Genre>()
  for (const [re, genres] of RULES) if (re.test(l)) genres.forEach((g) => out.add(g))
  return [...out]
}

/** Cleans a Wikidata genre label for display ("psychological thriller film" → "psychological thriller"). */
export const subgenreLabel = (label: string) => label.replace(/\s+(film|movie)s?$/i, '').trim()

/** TMDB genre names → canonical (TMDB uses "Science Fiction"; drop "TV Movie"). */
export function fromTmdbGenre(name: string): Genre | null {
  return (CANONICAL_GENRES as readonly string[]).includes(name) ? (name as Genre) : null
}

/** True for labels that merely restate a canonical genre ("action", "drama", "animated"…). */
export function isPlainGenre(label: string): boolean {
  const l = label.toLowerCase()
  return CANONICAL_GENRES.some((g) => g.toLowerCase() === l) || ['animated', 'historical', 'musical', 'romance film', 'speculative fiction', 'live-action/animated'].includes(l)
}
