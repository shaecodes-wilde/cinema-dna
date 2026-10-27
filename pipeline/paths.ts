import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '..')
export const PATHS = {
  raw: join(ROOT, 'data/raw'),
  cache: join(ROOT, 'data/cache'),
  normalized: join(ROOT, 'data/normalized'),
  dataset: join(ROOT, 'data/normalized/dataset.json'),
  metadata: join(ROOT, 'data/normalized/metadata.json'),
  metadataPrev: join(ROOT, 'data/normalized/metadata.prev.json'),
  overrides: join(ROOT, 'data/overrides.json'),
  appData: join(ROOT, 'public/data/cinema-dna.json'),
  reports: join(ROOT, 'reports'),
}

/** Newest Letterboxd export (zip or extracted dir) in data/raw/. */
export function latestExport(): string {
  if (!existsSync(PATHS.raw)) throw new Error(`No ${PATHS.raw}. Put your Letterboxd export zip there.`)
  const candidates = readdirSync(PATHS.raw)
    .filter((n) => n.startsWith('letterboxd-') || n.endsWith('.zip'))
    .map((n) => join(PATHS.raw, n))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs || b.localeCompare(a))
  if (!candidates.length) throw new Error(`No Letterboxd export found in ${PATHS.raw}`)
  return candidates[0]
}

export function writeJson(path: string, value: unknown, pretty = true): void {
  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, JSON.stringify(value, null, pretty ? 1 : undefined) + '\n')
}

/** Write-then-rename so an interrupted run never leaves a half-written file. */
export function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, text)
    renameSync(tmp, path)
  } finally {
    rmSync(tmp, { force: true })
  }
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}
