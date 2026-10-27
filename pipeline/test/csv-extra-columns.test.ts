import { expect, it } from 'vitest'
import { parseCsvDetailed } from '../ingest/csv.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

it('reports extra-column rows once while retaining other PapaParse errors', () => {
  const text = 'Date,Name,Year,Letterboxd URI\n2024-01-01,Alpha,1999,https://boxd.it/A,extra\n2024-01-01,Beta'
  const parsed = parseCsvDetailed(text)
  expect(parsed.extraColumnRows).toEqual([2])
  expect(parsed.errors.some((e) => e.row === 2)).toBe(false)
  expect(parsed.errors).toContainEqual({ row: 3, message: expect.stringContaining('Too few fields:') })
  const notes = normalize(fixtureArchive({ 'watched.csv': text })).audit.notes.filter((n) => n.startsWith('watched.csv:'))
  expect(notes.filter((n) => /row 2\b/.test(n))).toHaveLength(1)
  expect(notes.join('\n')).toContain('row 3: Too few fields:')
})
