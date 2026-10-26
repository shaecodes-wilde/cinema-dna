import Papa from 'papaparse'

export type Row = Record<string, string>

export function parseCsv(text: string): Row[] {
  const out = Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy' })
  return out.data.map((r) => {
    const clean: Row = {}
    for (const [k, v] of Object.entries(r)) if (k) clean[k.trim()] = (v ?? '').trim()
    return clean
  })
}

export interface ParsedList {
  meta: Row
  entries: Row[]
}

/**
 * Letterboxd list exports are two CSV blocks: a version line, a one-row metadata table
 * (Date,Name,Tags,URL,Description), a blank line, then the entries (Position,Name,Year,URL,Description).
 */
export function parseListCsv(text: string): ParsedList {
  const rows = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy' }).data
  const metaHeader = rows.findIndex((r) => r[0] === 'Date' && r.includes('Name'))
  const entryHeader = rows.findIndex((r) => r[0] === 'Position')
  const toObj = (header: string[], r: string[]): Row =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()]))
  const meta = metaHeader >= 0 && rows[metaHeader + 1] ? toObj(rows[metaHeader], rows[metaHeader + 1]) : {}
  const entries =
    entryHeader >= 0 ? rows.slice(entryHeader + 1).map((r) => toObj(rows[entryHeader], r)) : []
  return { meta, entries }
}

export const uriCode = (uri: string | undefined): string | null => {
  const m = uri?.match(/boxd\.it\/([A-Za-z0-9]+)/)
  return m ? m[1] : null
}

export const num = (s: string | undefined): number | null => {
  if (s === undefined || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export const isoDate = (s: string | undefined): string | null =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
