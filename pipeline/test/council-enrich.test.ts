import { readFileSync, rmSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readPreviousMetadata } from '../enrich/index.ts'
import { writeJson } from '../paths.ts'
import { film, metadata, noFetch, refresh, sourceFetch, tempPaths } from './refresh-fixture.ts'

const dirs: string[] = []
const pathsForTest = () => { const paths = tempPaths(); dirs.push(paths.root); return paths }
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('TMDB_API_KEY', '')
  vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

it('stays quiet for a missing previous file but warns for an unreadable path', () => {
  const paths = pathsForTest()
  const log = vi.fn()
  expect(readPreviousMetadata(paths.metadata, log)).toBeNull()
  expect(log).not.toHaveBeenCalled()
  expect(readPreviousMetadata(paths.root, log)).toBeNull()
  expect(log).toHaveBeenCalledWith(expect.stringContaining('ignoring unreadable previous metadata.json'))
})

it.each(['disabled', 'cache miss'])('preserves a TMDB overlay after an offline Wikidata rebuild with TMDB %s', async (mode) => {
  const paths = pathsForTest()
  const first = await refresh([film()], { paths, fetchImpl: sourceFetch(), log: vi.fn() })
  first.films[film().id].posterUrl = 'https://images.test/alpha.jpg'
  first.films[film().id].keywords = ['friendship']
  first.films[film().id].sources.push('tmdb')
  writeJson(paths.metadata, first)
  const before = readFileSync(paths.metadata)
  if (mode === 'cache miss') vi.stubEnv('TMDB_API_KEY', 'uncached-test-key')
  const fetchImpl = noFetch()
  const next = await refresh([film()], { paths, offline: true, fetchImpl, log: vi.fn() })
  const current = next.films[film().id]
  expect(current.match.method).toBe('title-year-search')
  expect(current.posterUrl).toBe(first.films[film().id].posterUrl)
  expect(current.keywords).toEqual(['friendship'])
  expect(current.match.notes).toContain('carried from previous metadata (offline run)')
  expect(readFileSync(paths.metadataPrev)).toEqual(before)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it.each(['', 'invalid', 42])('ignores invalid override %j and logs its film ID', async (override) => {
  const paths = pathsForTest()
  await refresh([film()], { paths, fetchImpl: sourceFetch(), log: vi.fn() })
  writeJson(paths.overrides, { matches: { [film().id]: override } })
  const log = vi.fn()
  const fetchImpl = noFetch()
  const next = await refresh([film()], { paths, offline: true, fetchImpl, log })
  expect(next.films[film().id].match.wikidataId).toBe('Q1')
  expect(next.films[film().id].match.method).toBe('title-year-search')
  expect(next.unmatched).toEqual([])
  expect(log.mock.calls.flat().join('\n')).toMatch(/ignoring invalid override.*lb:alpha/)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it('names at most five affected films and the source failure in a refused refresh', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test')
  const paths = pathsForTest()
  const films = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map(film)
  const prev = metadata(films)
  for (const meta of Object.values(prev.films)) meta.posterUrl = 'https://images.test/poster.jpg'
  writeJson(paths.metadata, prev)
  const before = readFileSync(paths.metadata)
  await expect(refresh(films, { paths, fetchImpl: sourceFetch({ tmdbStatus: 401 }), log: vi.fn() }))
    .rejects.toThrow(/degraded refresh: lb:alpha, lb:beta, lb:gamma, lb:delta, lb:epsilon, ….*HTTP 401/)
  expect(readFileSync(paths.metadata)).toEqual(before)
})

it('caps the distinct failure messages listed in a refused refresh', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test')
  const paths = pathsForTest()
  const films = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map(film)
  const prev = metadata(films)
  for (const meta of Object.values(prev.films)) meta.posterUrl = 'https://images.test/poster.jpg'
  writeJson(paths.metadata, prev)
  const error = await refresh(films, { paths, fetchImpl: sourceFetch({ tmdbStatus: 404 }), log: vi.fn() }).catch((e: Error) => e)
  expect(error).toBeInstanceOf(Error)
  const message = (error as Error).message
  expect(message).toMatch(/degraded refresh/)
  expect((message.match(/HTTP 404/g) ?? []).length).toBeLessThanOrEqual(3)
})

