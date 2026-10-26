/** Approximates Letterboxd's film slug scheme: lowercase ASCII, apostrophes dropped, other runs → "-". */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Loose, Unicode-preserving key for comparing titles across sources ("The Batman" ≈ "Batman, The",
 * "東京" ≠ "大阪"). Unlike `slugify`, it never collapses non-Latin titles to an empty string.
 */
export function titleKey(title: string): string {
  const key = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '') // keep non-Latin marks (が ≠ か)
  return key || title.trim().toLowerCase()
}

/** Identity key for joining diary/review rows (which carry entry codes) to films. */
export function filmKey(title: string, year: number | null): string {
  return `${titleKey(title)}:${year ?? '?'}`
}
