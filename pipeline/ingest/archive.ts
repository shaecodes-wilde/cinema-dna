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
  return { path, sha256: hash.digest('hex'), files }
}

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)
