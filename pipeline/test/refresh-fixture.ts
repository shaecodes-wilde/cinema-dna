import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'
import type { Film, MetadataFile } from '../../shared/types.ts'
import { emptyMetadata, enrich, type EnrichOptions } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

export function film(title = 'Alpha'): Film {
  return { ...normalize(fixtureArchive()).films[0], id: `lb:${title.toLowerCase()}`, title, year: 2020, slug: title.toLowerCase() }
}

export function dataset(films = [film()]) {
  return { ...normalize(fixtureArchive()), films }
}

export function metadata(films = [film()]): MetadataFile {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z', sources: ['wikidata'], unmatched: [],
    films: Object.fromEntries(films.map((f) => [f.id, {
      ...emptyMetadata(f, { method: 'title-year-search', confidence: 'high', notes: [] }),
      match: { ...emptyMetadata(f, { method: 'title-year-search', confidence: 'high', notes: [] }).match, wikidataId: 'Q1' },
      sources: ['wikidata'],
    }])),
  }
}

export function tempPaths() {
  const scratch = process.env.CINEMA_DNA_TEST_SCRATCH ?? tmpdir()
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(join(scratch, 'refresh-'))
  return {
    root, cache: join(root, 'cache'), overrides: join(root, 'overrides.json'),
    metadata: join(root, 'normalized/metadata.json'), metadataPrev: join(root, 'normalized/metadata.prev.json'),
  }
}

export const noFetch = () => vi.fn<typeof fetch>(async () => { throw new Error('unexpected network request') })

/** Complete synthetic responses exercise the real matching, HTTP cache and projection code. */
export function sourceFetch({ exact = true, tmdbStatus = 200 } = {}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.startsWith('https://api.themoviedb.org/')) {
      if (tmdbStatus !== 200) return new Response('source failed', { status: tmdbStatus })
      const body = url.includes('/search/movie')
        ? { results: [{ id: 101, title: 'Alpha', release_date: '2020-01-01' }] }
        : { id: 101, title: 'Alpha', runtime: 99, poster_path: '/alpha.jpg', overview: 'Alpha overview', keywords: { keywords: [{ id: 1, name: 'friendship' }] } }
      return Response.json(body)
    }
    if (url !== 'https://query.wikidata.org/sparql') throw new Error(`unexpected URL: ${url}`)
    const query = new URLSearchParams(String(init?.body)).get('query') ?? ''
    const item = { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' }
    const literal = (value: string) => ({ type: 'literal', value })
    let bindings: object[] = []
    if (exact && query.startsWith('SELECT DISTINCT ?item ?t')) bindings = [{ item, t: literal('Alpha') }]
    else if (query.includes('VALUES ?item { wd:Q1 }')) {
      if (query.startsWith('SELECT ?item ?itemLabel')) bindings = [{ item, itemLabel: literal('Alpha'), itemDescription: literal('2020 film'), sl: literal('20') }]
      else if (query.startsWith('SELECT ?item ?prop')) bindings = [
        { item, prop: { type: 'uri', value: 'http://www.wikidata.org/prop/direct/P31' }, val: { type: 'uri', value: 'http://www.wikidata.org/entity/Q11424' } },
        { item, prop: { type: 'uri', value: 'http://www.wikidata.org/prop/direct/P577' }, val: literal('2020-01-01T00:00:00Z') },
      ]
    }
    return Response.json({ results: { bindings } })
  })
}

/** Drain the real rate-limit sleeps using Vitest's fake timers. Attach a rejection handler immediately. */
export async function refresh(films: Film[], opts: EnrichOptions) {
  const result = enrich(dataset(films), opts).then((value) => ({ value }), (error: unknown) => ({ error }))
  await vi.runAllTimersAsync()
  const outcome = await result
  if ('error' in outcome) throw outcome.error
  return outcome.value
}
