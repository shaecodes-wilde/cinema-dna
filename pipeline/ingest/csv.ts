import Papa from 'papaparse'

export type Row = Record<string, string>

export function parseCsv(text: string): Row[] {
  return parseCsvDetailed(text).rows
}

export function parseCsvDetailed(text: string): { rows: Row[]; errors: { row: number; message: string }[]; extraColumnRows: number[] } {
  const out = Papa.parse<Record<string, string | string[]>>(text, { header: true, skipEmptyLines: 'greedy' })
  const extraColumnRows: number[] = []
  const rows = out.data.map((r, i) => {
    const clean: Row = {}
    for (const [k, v] of Object.entries(r)) {
      if (k === '__parsed_extra') extraColumnRows.push(i + 2)
      else if (k) clean[k.trim()] = typeof v === 'string' ? v.trim() : ''
    }
    return clean
  })
  // Field mismatches count data rows; quote errors count the header too.
  const errors = out.errors.map((e) => ({ row: e.row === undefined ? 1 : e.row + (e.type === 'FieldMismatch' ? 2 : 1), message: e.message }))
  return { rows, errors, extraColumnRows }
}

export interface ParsedList {
  meta: Row
  metaRow: number
  entries: Row[]
  errors: { row: number; message: string }[]
  extraColumnRows: number[]
}

/**
 * Letterboxd list exports are two CSV blocks: a version line, a one-row metadata table
 * (Date,Name,Tags,URL,Description), a blank line, then the entries (Position,Name,Year,URL,Description).
 */
export function parseListCsv(text: string): ParsedList {
  const out = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy' })
  const rows = out.data
  const metaHeader = rows.findIndex((r) => r[0] === 'Date' && r.includes('Name'))
  const entryHeader = rows.findIndex((r) => r[0] === 'Position')
  const toObj = (header: string[], r: string[]): Row =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()]))
  const meta = metaHeader >= 0 && rows[metaHeader + 1] ? toObj(rows[metaHeader], rows[metaHeader + 1]) : {}
  const entries =
    entryHeader >= 0 ? rows.slice(entryHeader + 1).map((r) => toObj(rows[entryHeader], r)) : []
  const extraColumnRows =
    entryHeader >= 0 ? rows.slice(entryHeader + 1).flatMap((r, i) => (r.length > rows[entryHeader].length ? [entryHeader + i + 2] : [])) : []
  const errors = out.errors.map((e) => ({ row: (e.row ?? 0) + 1, message: e.message }))
  return { meta, metaRow: metaHeader + 2, entries, errors, extraColumnRows }
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

export const isoDate = (s: string | undefined): string | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const date = new Date(`${s}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s ? s : null
}
