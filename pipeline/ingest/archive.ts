import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'

export interface ExportArchive {
  path: string
  sha256: string
  files: Map<string, string>
}

/** Reads a Letterboxd export from a .zip or an already-extracted directory. Never writes to it. */
export function readExport(path: string): ExportArchive {
  const files = new Map<string, string>()
  const hash = createHash('sha256')
  if (statSync(path).isDirectory()) {
    const walk = (dir: string) => {
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith('.csv')) {
          const buf = readFileSync(full)
          hash.update(buf)
          files.set(relative(path, full).split('\\').join('/'), stripBom(buf.toString('utf8')))
        }
      }
    }
    walk(path)
  } else {
    const buf = readFileSync(path)
    hash.update(buf)
    const entries = unzipSync(new Uint8Array(buf))
    for (const [name, data] of Object.entries(entries)) {
      if (!name.endsWith('.csv') || name.includes('..')) continue
      files.set(name.replace(/^\/+/, ''), stripBom(strFromU8(data)))
    }
  }
  return { path, sha256: hash.digest('hex'), files: normalizeLayout(files, path) }
}

const CORE = ['watched.csv', 'ratings.csv', 'diary.csv']

/**
 * Re-zipped exports (macOS "Compress", or a parent folder) nest everything under one directory and may
 * carry __MACOSX/._* junk. Strip a shared prefix, drop the junk, and refuse archives with no Letterboxd CSVs.
 */
export function normalizeLayout(files: Map<string, string>, path = 'export'): Map<string, string> {
  const kept = [...files].filter(([name]) => !name.startsWith('__MACOSX/') && !name.split('/').some((part) => part.startsWith('._')))
  const coreHit = kept.map(([name]) => name).find((name) => CORE.some((c) => name === c || name.endsWith(`/${c}`)))
  if (!coreHit) {
    throw new Error(`${path} doesn't look like a Letterboxd export (no watched.csv, ratings.csv or diary.csv found).`)
  }
  const prefix = coreHit.slice(0, coreHit.lastIndexOf('/') + 1)
  return new Map(kept.filter(([name]) => name.startsWith(prefix)).map(([name, text]) => [name.slice(prefix.length), text]))
}

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)
