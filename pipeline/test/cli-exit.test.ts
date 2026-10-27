import { readFileSync, rmSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../enrich/http.ts'
import { enrich } from '../enrich/index.ts'
import { runEnrichStep } from '../enrich/step.ts'
import { writeJson } from '../paths.ts'
import { dataset, film, metadata, sourceFetch, tempPaths } from './refresh-fixture.ts'

beforeEach(() => {
  vi.stubEnv('TMDB_API_KEY', 'test')
  vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('CLI enrichment failure policy without importing cli.ts', () => {
  it('rethrows a Wikidata error for standalone enrich so main.catch exits nonzero', async () => {
    const error = new HttpError(400, 'HTTP 400 for query.wikidata.org')
    const args: string[] = []
    await expect(runEnrichStep('enrich', args, async () => { throw error })).rejects.toBe(error)
    expect(args).toEqual([])
  })

  it.each(['all', 'import'])('continues %s on enrichment failure with discovery disabled', async (command) => {
    const error = new HttpError(400, 'HTTP 400 for query.wikidata.org')
    const args = ['--offline']
    await expect(runEnrichStep(command, args, async () => { throw error })).resolves.toBeUndefined()
    expect(args).toEqual(['--offline', '--no-discover'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('previous metadata file (unchanged)'))
  })

  it('leaves successful commands and an existing no-discover flag alone', async () => {
    const args = ['--no-discover']
    await runEnrichStep('all', args, async () => {})
    expect(console.warn).not.toHaveBeenCalled()
    await runEnrichStep('all', args, async () => { throw new Error('failed') })
    expect(args).toEqual(['--no-discover'])
  })

  it('propagates a real Wikidata-stage 400 through enrich before any metadata write', async () => {
    const paths = tempPaths()
    try {
      writeJson(paths.metadata, metadata())
      const before = readFileSync(paths.metadata)
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('invalid query', { status: 400 }))
      await expect(runEnrichStep('enrich', [], () => enrich(dataset(), { paths, fetchImpl, log: vi.fn() }))).rejects.toMatchObject({ status: 400 })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(String(fetchImpl.mock.calls[0][0])).toContain('query.wikidata.org')
      expect(readFileSync(paths.metadata)).toEqual(before)
    } finally {
      rmSync(paths.root, { recursive: true, force: true })
    }
  })

  it('makes the internally caught TMDB 401 visible to the CLI as a degraded refresh', async () => {
    vi.useFakeTimers()
    const paths = tempPaths()
    try {
      const prev = metadata()
      prev.films[film().id].posterUrl = 'https://images.test/alpha.jpg'
      writeJson(paths.metadata, prev)
      const before = readFileSync(paths.metadata)
      const task = runEnrichStep('enrich', [], () => enrich(dataset(), { paths, fetchImpl: sourceFetch({ tmdbStatus: 401 }), log: vi.fn() }))
      const assertion = expect(task).rejects.toThrow(/degraded refresh/)
      await vi.runAllTimersAsync()
      await assertion
      expect(readFileSync(paths.metadata)).toEqual(before)
      const args: string[] = []
      await runEnrichStep('import', args, () => enrich(dataset(), { paths, fetchImpl: sourceFetch({ tmdbStatus: 401 }), log: vi.fn() }))
      expect(args).toContain('--no-discover')
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('degraded refresh'))
      expect(readFileSync(paths.metadata)).toEqual(before)
    } finally {
      rmSync(paths.root, { recursive: true, force: true })
    }
  })
})
