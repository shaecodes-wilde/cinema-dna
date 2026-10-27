import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carryForward, readPreviousMetadata, unexplainedLosses } from '../enrich/index.ts'
import { readJson, writeJson } from '../paths.ts'
import { film, metadata, noFetch, refresh, tempPaths } from './refresh-fixture.ts'

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return { ...fs, renameSync: vi.fn(fs.renameSync), writeFileSync: vi.fn(fs.writeFileSync) }
})

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
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('ID-anchored offline carry-forward', () => {
  const alpha = film()
  const beta = film('Beta')
  const missing = [alpha, beta].map((f) => ({ filmId: f.id, title: f.title, year: f.year, reason: 'no confident Wikidata match' }))

  it('carries a legacy match, keeps Beta unmatched and does not mutate previous records', () => {
    const prev = metadata()
    const result = carryForward(prev, {}, missing, [alpha, beta], {}, true)
    expect(Object.keys(result.films)).toEqual([alpha.id])
    expect(result.films[alpha.id].match.notes).toContain('carried from previous metadata (offline run)')
    expect(result.unmatched.map((u) => u.filmId)).toEqual([beta.id])
    expect(prev.films[alpha.id].match.notes).toEqual([])
    expect(unexplainedLosses(prev, { ...prev, ...result }, [alpha, beta], {})).toEqual([])
  })

  it.each([null, 'Q2'])('respects override %s and treats the loss as allowed', (override) => {
    const prev = metadata()
    const overrides = { matches: { [alpha.id]: override } }
    const result = carryForward(prev, {}, missing, [alpha], overrides, true)
    expect(result.films).toEqual({})
    expect(result.unmatched).toEqual(missing)
    expect(unexplainedLosses(prev, { ...prev, ...result }, [alpha], overrides)).toEqual([])
  })

  it('allows an unchanged explicit QID and adds the carry note only once', () => {
    const prev = metadata()
    const overrides = { matches: { [alpha.id]: 'Q1' } }
    const once = carryForward(prev, {}, missing, [alpha], overrides, true)
    const twice = carryForward({ ...prev, ...once }, {}, missing, [alpha], overrides, true)
    expect(twice.films[alpha.id].match.notes).toEqual(['carried from previous metadata (offline run)'])
  })

  it('never carries a removed film or a record anchored to a different ID', () => {
    const prev = metadata()
    expect(carryForward(prev, {}, [], [beta], {}, true).films).toEqual({})
    expect(unexplainedLosses(prev, { ...prev, films: {} }, [beta], {})).toEqual([])
    prev.films[alpha.id].filmId = beta.id
    expect(carryForward(prev, {}, missing, [alpha], {}, true).films).toEqual({})
    expect(unexplainedLosses(prev, { ...prev, films: {} }, [alpha], {})).toEqual([alpha.id])
  })

  it('does nothing online and never replaces a fresh match', () => {
    const prev = metadata()
    expect(carryForward(prev, {}, missing, [alpha], {}, false)).toEqual({ films: {}, unmatched: missing })
    const fresh = metadata().films
    fresh[alpha.id].match.wikidataId = 'Q3'
    expect(carryForward(prev, fresh, [], [alpha], {}, true).films).toEqual(fresh)
    expect(unexplainedLosses(prev, { ...prev, films: {} }, [alpha], {})).toEqual([alpha.id])
  })
})

describe('previous metadata and publication', () => {
  it('starts cold for missing, unparsable or films-less files and accepts legacy files', () => {
    const paths = pathsForTest()
    const log = vi.fn()
    expect(readPreviousMetadata(paths.metadata, log)).toBeNull()
    expect(log).not.toHaveBeenCalled()
    for (const content of ['{broken', 'null', '{}', '{"films":[]}', '{"films":"bad"}']) {
      writeJson(paths.metadata, {})
      writeFileSync(paths.metadata, content)
      expect(readPreviousMetadata(paths.metadata, log)).toBeNull()
    }
    expect(log).toHaveBeenCalledTimes(5)
    writeJson(paths.metadata, metadata())
    expect(readPreviousMetadata(paths.metadata, log)).toEqual(metadata())
  })

  it('skips the backup on the first-ever enrich and never fetches offline', async () => {
    const paths = pathsForTest()
    const fetchImpl = noFetch()
    const result = await refresh([film()], { paths, offline: true, fetchImpl, log: vi.fn() })
    expect(readJson(paths.metadata)).toEqual(result)
    expect(result.unmatched.map((u) => u.filmId)).toEqual([film().id])
    expect(existsSync(paths.metadataPrev)).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('keeps all matches and overlays through two consecutive offline refreshes after adding Beta', async () => {
    const paths = pathsForTest()
    const prev = metadata()
    prev.films[film().id].posterUrl = 'https://images.test/alpha.jpg'
    prev.films[film().id].keywords = ['friendship']
    prev.films[film().id].sources.push('tmdb')
    writeJson(paths.metadata, prev)
    const fetchImpl = noFetch()
    for (let run = 0; run < 2; run++) {
      const before = readFileSync(paths.metadata)
      const next = await refresh([film(), film('Beta')], { paths, offline: true, fetchImpl, log: vi.fn() })
      expect(Object.keys(next.films)).toEqual([film().id])
      expect(next.films[film().id].posterUrl).toBe(prev.films[film().id].posterUrl)
      expect(next.films[film().id].keywords).toEqual(['friendship'])
      expect(next.sources).toContain('tmdb')
      expect(next.unmatched.map((u) => u.filmId)).toEqual([film('Beta').id])
      expect(readFileSync(paths.metadataPrev)).toEqual(before)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('starts cold on malformed metadata without aborting enrich', async () => {
    const paths = pathsForTest()
    writeJson(paths.metadata, {})
    writeFileSync(paths.metadata, '{broken')
    const next = await refresh([film()], { paths, offline: true, fetchImpl: noFetch(), log: vi.fn() })
    expect(next.films).toEqual({})
    expect(readFileSync(paths.metadataPrev, 'utf8')).toBe('{broken')
    expect(readJson(paths.metadata)).toEqual(next)
  })

  it('throws on unexplained offline losses before touching either metadata file', async () => {
    const paths = pathsForTest()
    const prev = metadata()
    prev.films[film().id].filmId = 'lb:wrong'
    writeJson(paths.metadata, prev)
    writeJson(paths.metadataPrev, { backup: 'keep' })
    const before = readFileSync(paths.metadata)
    const backup = readFileSync(paths.metadataPrev)
    await expect(refresh([film()], { paths, offline: true, fetchImpl: noFetch(), log: vi.fn() })).rejects.toThrow(/unexplained metadata losses: lb:alpha/)
    expect(readFileSync(paths.metadata)).toEqual(before)
    expect(readFileSync(paths.metadataPrev)).toEqual(backup)
  })

  it.each(['write', 'rename'])('keeps the previous metadata byte-identical and readable after a %s failure', async (operation) => {
    const paths = pathsForTest()
    const prev = metadata()
    writeJson(paths.metadata, prev)
    const before = readFileSync(paths.metadata)
    if (operation === 'write') vi.mocked(writeFileSync).mockImplementationOnce(() => { throw new Error('injected write failure') })
    else vi.mocked(renameSync).mockImplementationOnce(() => { throw new Error('injected rename failure') })
    await expect(refresh([film()], { paths, offline: true, fetchImpl: noFetch(), log: vi.fn() })).rejects.toThrow(`injected ${operation} failure`)
    expect(readFileSync(paths.metadata)).toEqual(before)
    expect(readJson(paths.metadata)).toEqual(prev)
    expect(readFileSync(paths.metadataPrev)).toEqual(before)
    expect(readdirSync(dirname(paths.metadata)).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('atomically replaces JSON, creates parent dirs and leaves no temporary file', () => {
    const paths = pathsForTest()
    const path = join(paths.root, 'nested/value.json')
    writeJson(path, { before: true })
    writeJson(path, { after: true })
    expect(readJson(path)).toEqual({ after: true })
    expect(readdirSync(dirname(path))).toEqual(['value.json'])
  })
})
