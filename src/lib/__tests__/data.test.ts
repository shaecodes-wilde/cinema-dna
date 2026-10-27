// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bundle, stubBrowser } from '../../__tests__/helpers.ts'
import { isAppData, useAppData } from '../data.tsx'

beforeEach(() => stubBrowser())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('bundle recovery', () => {
  it.each([null, [], {}, { generatedAt: 'x' }])('rejects an invalid outer shape: %j', (value) => {
    expect(isAppData(value)).toBe(false)
  })

  it('accepts the real synthetic bundle without a version field', () => {
    expect(isAppData(bundle())).toBe(true)
  })

  it('requires every specified key and its shallow type', () => {
    const paths = ['generatedAt', 'profile', 'profile.username', 'source', 'source.metadataSources', 'totals', 'totals.ratedFilms', 'totals.watchedFilms', 'identity', 'identity.intro', 'films', 'insights', 'dna', 'genrePairs', 'recommendations', 'model', 'report', 'report.sections', 'quality', 'quality.audit', 'quality.metadata', 'quality.notes']
    for (const path of paths) {
      const value = bundle() as unknown as Record<string, unknown>
      const keys = path.split('.')
      let parent = value
      for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>
      parent[keys.at(-1)!] = null
      expect(isAppData(value), path).toBe(false)
    }
  })

  it('routes JSON with an invalid shape to the missing state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) }))
    const { result } = renderHook(useAppData)
    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(result.current).toEqual({ status: 'missing', message: 'public/data/cinema-dna.json is not a CINEMA DNA bundle; rerun npm run analyze' })
  })

  it('loads a valid bundle', async () => {
    const data = bundle()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => data }))
    const { result } = renderHook(useAppData)
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data }))
  })
})
