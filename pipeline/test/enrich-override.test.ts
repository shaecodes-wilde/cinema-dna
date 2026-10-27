import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJson, writeJson } from '../paths.ts'
import { film, metadata, noFetch, refresh, sourceFetch, tempPaths } from './refresh-fixture.ts'

const dirs: string[] = []
const pathsForTest = () => { const paths = tempPaths(); dirs.push(paths.root); return paths }
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
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

describe('explicit overrides never fall back', () => {
  it('never uses cached automatic Q1 or TMDB when an offline override is re-pointed to unavailable Q2', async () => {
    const paths = pathsForTest()
    const first = await refresh([film()], { paths, fetchImpl: sourceFetch(), log: vi.fn() })
    expect(first.films[film().id].match).toMatchObject({ wikidataId: 'Q1', tmdbId: 101, method: 'title-year-search' })
    expect(first.films[film().id].posterUrl).toContain('/alpha.jpg')
    const before = sha(paths.metadata)
    writeJson(paths.overrides, { matches: { [film().id]: 'Q2' } })
    const fetchImpl = noFetch()
    const next = await refresh([film()], { paths, offline: true, fetchImpl, log: vi.fn() })
    expect(next.films[film().id]).toBeUndefined()
    expect(next.unmatched).toEqual([{ filmId: film().id, title: 'Alpha', year: 2020, reason: 'override: Q2 not available offline (uncached)' }])
    expect(JSON.stringify(next)).not.toMatch(/title-year-search|tmdb-search|carried from previous/)
    expect(sha(paths.metadataPrev)).toBe(before)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not search automatically online when the explicit QID is missing', async () => {
    const paths = pathsForTest()
    writeJson(paths.metadata, metadata())
    writeJson(paths.overrides, { matches: { [film().id]: 'Q2' } })
    const fetchImpl = sourceFetch()
    const next = await refresh([film()], { paths, fetchImpl, log: vi.fn() })
    expect(next.films).toEqual({})
    expect(next.unmatched[0].reason).toBe('override: Q2 not found')
    const requests = fetchImpl.mock.calls.map(([url, init]) => `${String(url)} ${String(init?.body)}`)
    expect(requests).toHaveLength(2)
    expect(requests.every((request) => request.includes('wd%3AQ2'))).toBe(true)
    expect(requests.join('\n')).not.toMatch(/api.themoviedb|mwapi|SELECT\+DISTINCT/)
  })

  it('honors a null override without any source request', async () => {
    const paths = pathsForTest()
    writeJson(paths.metadata, metadata())
    writeJson(paths.overrides, { matches: { [film().id]: null } })
    const fetchImpl = noFetch()
    const next = await refresh([film()], { paths, fetchImpl, log: vi.fn() })
    expect(next.films).toEqual({})
    expect(next.unmatched[0].reason).toBe('override: no match')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('detected source failures block destructive publication', () => {
  it.each([401, 403, 404])('keeps posters, keywords, TMDB-only matches and the old backup when TMDB returns %s', async (status) => {
    const paths = pathsForTest()
    const prev = metadata([film(), film('Beta')])
    prev.sources.push('tmdb')
    prev.films[film().id].posterUrl = 'https://images.test/alpha.jpg'
    prev.films[film().id].keywords = ['friendship']
    prev.films[film().id].match.tmdbId = 101
    prev.films[film('Beta').id].match.wikidataId = null
    prev.films[film('Beta').id].match.method = 'tmdb-search'
    prev.films[film('Beta').id].sources = ['tmdb']
    writeJson(paths.metadata, prev)
    writeJson(paths.metadataPrev, { backup: 'keep' })
    const before = sha(paths.metadata)
    const backup = sha(paths.metadataPrev)
    const log = vi.fn()
    await expect(refresh([film(), film('Beta')], { paths, fetchImpl: sourceFetch({ tmdbStatus: status }), log }))
      .rejects.toThrow(new RegExp(`degraded refresh: lb:alpha, lb:beta .*HTTP ${status}.*previous metadata.json kept unchanged`))
    expect(sha(paths.metadata)).toBe(before)
    expect(readJson(paths.metadata)).toEqual(prev)
    expect(sha(paths.metadataPrev)).toBe(backup)
    expect(log.mock.calls.flat().join('\n')).toMatch(status === 404 ? /tmdb: Alpha/ : /TMDB rejected the credentials/)
  })

  it('logs online losses without blocking when no source failure was detected', async () => {
    vi.stubEnv('TMDB_API_KEY', '')
    const paths = pathsForTest()
    writeJson(paths.metadata, metadata())
    const before = sha(paths.metadata)
    const log = vi.fn()
    const next = await refresh([film()], { paths, fetchImpl: sourceFetch({ exact: false }), log })
    expect(next.films).toEqual({})
    expect(log.mock.calls.flat().join('\n')).toContain('unexplained metadata losses: lb:alpha')
    expect(sha(paths.metadataPrev)).toBe(before)
    expect(readJson(paths.metadata)).toEqual(next)
  })

  it('can publish a degraded first-ever run because no previous metadata can be lost', async () => {
    const paths = pathsForTest()
    const next = await refresh([film()], { paths, fetchImpl: sourceFetch({ tmdbStatus: 401 }), log: vi.fn() })
    expect(next.films[film().id].match.wikidataId).toBe('Q1')
    expect(readJson(paths.metadata)).toEqual(next)
    expect(readdirSync(paths.root + '/normalized')).toEqual(['metadata.json'])
  })
})
