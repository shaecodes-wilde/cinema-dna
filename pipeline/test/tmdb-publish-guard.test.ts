import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FilmMetadata } from '../../shared/types.ts'
import { applyTmdb } from '../enrich/tmdb.ts'
import { readJson, writeJson } from '../paths.ts'
import { film, metadata, refresh, sourceFetch, tempPaths } from './refresh-fixture.ts'

const dirs: string[] = []
function pathsForTest(alphaTmdb = 101) {
  const paths = tempPaths()
  dirs.push(paths.root)
  for (const [id, label, tmdbId] of [['Q1', 'Alpha', alphaTmdb], ['Q2', 'Beta', 202]] as const) {
    writeJson(join(paths.cache, 'wikidata-entities', `${id}.json`), {
      id, label, description: '2020 film', aliases: [], sitelinks: 20,
      claims: { P31: ['Q11424'], P577: ['2020-01-01'], P4947: [String(tmdbId)] },
    })
  }
  return paths
}

function matchedFetch(tmdb: (url: string) => Response) {
  const fallback = sourceFetch()
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.startsWith('https://api.themoviedb.org/')) return tmdb(url)
    const query = new URLSearchParams(String(init?.body)).get('query') ?? ''
    if (query.startsWith('SELECT DISTINCT ?item ?t')) {
      return Response.json({ results: { bindings: ['Alpha', 'Beta'].map((title, i) => ({
        item: { type: 'uri', value: `http://www.wikidata.org/entity/Q${i + 1}` },
        t: { type: 'literal', value: title },
      })) } })
    }
    return fallback(input, init)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('TMDB_API_KEY', 'test')
  vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

it('publishes a new QID match on consecutive refreshes despite an unchanged stale TMDB ID returning 404', async () => {
  const paths = pathsForTest(999)
  const fetchImpl = matchedFetch((url) => url.includes('/movie/999?')
    ? new Response('stale ID', { status: 404 })
    : Response.json({ id: 202, title: 'Beta' }))
  const log = vi.fn()
  const previous = await refresh([film()], { paths, fetchImpl, log })
  for (let run = 0; run < 2; run++) {
    const before = readFileSync(paths.metadata)
    const next = await refresh([film(), film('Beta')], { paths, fetchImpl, log })
    expect(next.films[film().id]).toEqual(previous.films[film().id])
    expect(next.films[film('Beta').id].match.wikidataId).toBe('Q2')
    expect(readJson(paths.metadata)).toEqual(next)
    expect(readFileSync(paths.metadataPrev)).toEqual(before)
  }
  expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes('/movie/999?'))).toHaveLength(3)
  expect(log.mock.calls.flat().filter((line) => /tmdb: Alpha: HTTP 404/.test(line))).toHaveLength(3)
})

it('publishes when a brand-new film returns 404 and the existing film retains its full TMDB overlay', async () => {
  const paths = pathsForTest()
  const movie = {
    id: 101, title: 'Alpha', runtime: 99, genres: [{ id: 18, name: 'Drama' }],
    poster_path: '/alpha.jpg', overview: 'Alpha overview', keywords: { keywords: [{ id: 1, name: 'friendship' }] },
    credits: { cast: [{ id: 1, name: 'Actor', order: 0 }], crew: [{ id: 2, name: 'Director', job: 'Director' }] },
  }
  const fetchImpl = matchedFetch((url) => url.includes('/movie/202?')
    ? new Response('new film unavailable', { status: 404 }) : Response.json(movie))
  const previous = await refresh([film()], { paths, fetchImpl, log: vi.fn() })
  const before = readFileSync(paths.metadata)
  const log = vi.fn()
  const next = await refresh([film(), film('Beta')], { paths, fetchImpl, log })
  expect(next.films[film().id]).toEqual(previous.films[film().id])
  expect(next.films[film('Beta').id].match.wikidataId).toBe('Q2')
  expect(readJson(paths.metadata)).toEqual(next)
  expect(readFileSync(paths.metadataPrev)).toEqual(before)
  expect(log.mock.calls.flat().join('\n')).toMatch(/tmdb: Beta: HTTP 404/)
})

const overlays: [string, Partial<FilmMetadata>][] = [
  ['poster', { posterUrl: 'https://images.test/alpha.jpg' }],
  ['overview', { overview: 'Alpha overview' }],
  ['keywords', { keywords: ['friendship'] }],
  ['runtime', { runtime: 99 }],
  ['genres', { genres: ['Drama'] }],
  ...(['cast', 'directors', 'writers', 'cinematographers', 'composers'] as const)
    .map((key): [string, Partial<FilmMetadata>] => [key, { [key]: [{ id: 'tmdb:1', name: 'Person' }] }]),
]
it.each(overlays)('refuses publication when a failed film loses its previous TMDB %s', async (_, overlay) => {
  const paths = pathsForTest()
  const previous = metadata()
  Object.assign(previous.films[film().id], overlay, { sources: ['wikidata', 'tmdb'] })
  writeJson(paths.metadata, previous)
  const before = readFileSync(paths.metadata)
  await expect(refresh([film()], { paths, fetchImpl: matchedFetch(() => new Response('unavailable', { status: 404 })), log: vi.fn() }))
    .rejects.toThrow(/degraded refresh/)
  expect(readFileSync(paths.metadata)).toEqual(before)
  expect(existsSync(paths.metadataPrev)).toBe(false)
})

it('refuses publication when a failed film loses its TMDB-sourced ID', async () => {
  const paths = pathsForTest()
  const previous = metadata()
  previous.films[film().id] = applyTmdb(previous.films[film().id], { id: 999, title: 'Alpha' })
  writeJson(paths.metadata, previous)
  const before = readFileSync(paths.metadata)
  await expect(refresh([film()], { paths, fetchImpl: matchedFetch(() => new Response('unavailable', { status: 404 })), log: vi.fn() }))
    .rejects.toThrow(/degraded refresh/)
  expect(readFileSync(paths.metadata)).toEqual(before)
})

it.each([401, 403])('protects a prior TMDB-only film skipped after an earlier film returns %s', async (status) => {
  const paths = pathsForTest()
  const previous = metadata([film('Beta')])
  previous.films[film('Beta').id].match.method = 'tmdb-search'
  previous.films[film('Beta').id].match.wikidataId = null
  writeJson(paths.metadata, previous)
  const before = readFileSync(paths.metadata)
  const fetchImpl = sourceFetch({ tmdbStatus: status })
  await expect(refresh([film(), film('Beta')], { paths, fetchImpl, log: vi.fn() })).rejects.toThrow(/degraded refresh/)
  expect(readFileSync(paths.metadata)).toEqual(before)
  expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes('api.themoviedb.org'))).toHaveLength(1)
})

it.each(['removed', 'null', 're-pointed'])('allows intentional %s losses despite another film returning 401', async (exception) => {
  const paths = pathsForTest()
  const previous = metadata([film('Beta')])
  previous.films[film('Beta').id].posterUrl = 'https://images.test/beta.jpg'
  writeJson(paths.metadata, previous)
  if (exception !== 'removed') writeJson(paths.overrides, { matches: { [film('Beta').id]: exception === 'null' ? null : 'Q2' } })
  const next = await refresh(exception === 'removed' ? [film()] : [film(), film('Beta')], {
    paths, fetchImpl: matchedFetch(() => new Response('credentials rejected', { status: 401 })), log: vi.fn(),
  })
  expect(next.films[film('Beta').id]?.posterUrl ?? null).toBeNull()
  expect(readJson(paths.metadata)).toEqual(next)
})
