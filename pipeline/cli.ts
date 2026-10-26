import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Dataset } from '../shared/types.ts'
import { readExport } from './ingest/archive.ts'
import { normalize } from './ingest/normalize.ts'
import { PATHS, ROOT, latestExport, readJson, writeJson } from './paths.ts'

const [command = 'all', ...rest] = process.argv.slice(2)
// Optional local secrets (TMDB_API_KEY, CINEMA_DNA_CONTACT) — never committed.
for (const f of ['.env.local', '.env']) if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f))
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

/** `import <zip>`: copy an export into data/raw/ (the original is left untouched) and run everything. */
function importExport(): string {
  const src = rest.find((a) => !a.startsWith('--'))
  if (!src || !existsSync(src)) throw new Error('usage: npm run import -- <path/to/letterboxd-export.zip>')
  const abs = resolve(src)
  if (statSync(abs).isDirectory() || abs.startsWith(PATHS.raw)) return abs
  mkdirSync(PATHS.raw, { recursive: true })
  const dest = join(PATHS.raw, basename(abs))
  copyFileSync(abs, dest)
  console.log(`▸ import  copied ${basename(abs)} → data/raw/`)
  return dest
}

async function ingest(exportPath?: string): Promise<Dataset> {
  const path = exportPath ?? flag('export') ?? latestExport()
  console.log(`▸ ingest  ${path}`)
  const dataset = normalize(readExport(path))
  writeJson(PATHS.dataset, dataset)
  const c = dataset.audit.counts
  console.log(
    `  ${c.films} films · ${c.watchedFilms} watched · ${c.ratedFilms} rated · ${c.diaryViewings} diary viewings ` +
      `(${c.rewatchViewings} rewatches) · ${c.reviews} reviews · ${c.watchlistFilms} watchlist · ${c.detachedEntries} detached`,
  )
  console.log(`  ${dataset.audit.conflicts.length} identity/rating conflicts logged · ${dataset.audit.notes.length} notes`)
  return dataset
}

async function main() {
  if (!['import', 'ingest', 'enrich', 'analyze', 'all'].includes(command)) {
    console.log('usage: tsx pipeline/cli.ts <import <zip>|ingest|enrich|analyze|all> [--export <zip|dir>] [--offline] [--no-discover]')
    process.exit(1)
  }
  const all = command === 'all' || command === 'import'
  if (command === 'ingest' || all) await ingest(command === 'import' ? importExport() : undefined)
  if (command === 'enrich' || all) {
    const { enrich } = await import('./enrich/index.ts')
    await enrich(readJson<Dataset>(PATHS.dataset), { offline: rest.includes('--offline') })
  }
  if (command === 'analyze' || all) {
    if (!existsSync(PATHS.dataset)) throw new Error('Run `npm run ingest` first.')
    const { analyzeAll } = await import('./analyze/index.ts')
    await analyzeAll({ offline: rest.includes('--offline'), discover: !rest.includes('--no-discover') })
  }
  if (all) console.log('\n✓ Done. Open the dashboard with `npm run dev`; the written analysis is in reports/taste-analysis.md')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
