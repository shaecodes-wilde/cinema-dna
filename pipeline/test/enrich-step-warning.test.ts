import { existsSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { runEnrichStep } from '../enrich/step.ts'

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(), existsSync: vi.fn(),
}))
afterEach(() => vi.restoreAllMocks())

it.each([false, true])('describes the metadata actually available after failure (exists=%s)', async (exists) => {
  vi.mocked(existsSync).mockReturnValue(exists)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await runEnrichStep('import', [], async () => { throw new Error('source failed') })
  const text = warn.mock.calls.flat().join('\n')
  expect(text.includes('previous metadata file (unchanged)')).toBe(exists)
  if (!exists) expect(text).toContain('without metadata')
})
