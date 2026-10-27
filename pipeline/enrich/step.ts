import { existsSync } from 'node:fs'
import { PATHS } from '../paths.ts'

/** Metadata is optional for a full import; a standalone refresh must report failure. */
export async function runEnrichStep(command: string, rest: string[], enrichFn: () => Promise<unknown>): Promise<void> {
  try {
    await enrichFn()
  } catch (err) {
    if (command === 'enrich') throw err
    console.warn(`  ⚠ enrichment stopped: ${(err as Error).message}`)
    console.warn(`  continuing ${existsSync(PATHS.metadata) ? 'with the previous metadata file (unchanged)' : 'without metadata'} — re-run \`npm run enrich\` later`)
    if (!rest.includes('--no-discover')) rest.push('--no-discover')
  }
}
