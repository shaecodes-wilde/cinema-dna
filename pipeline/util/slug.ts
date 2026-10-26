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

/** Loose title key for comparing titles across sources ("The Batman" ≈ "Batman, The"). */
export function titleKey(title: string): string {
  return slugify(title).replace(/-/g, '')
}

export function filmKey(title: string, year: number | null): string {
  return `${slugify(title)}:${year ?? '?'}`
}
