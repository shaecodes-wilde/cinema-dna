// Regression: the intro used to leave a dangling comma or start lowercase depending on which signals fired.
import { expect, it } from 'vitest'
import type { Dataset, MetadataFile } from '../../shared/types.ts'
import { analyze } from '../analyze/index.ts'
import { emptyMetadata } from '../enrich/index.ts'
import { normalize } from '../ingest/normalize.ts'
import { fixtureArchive } from './fixtures.ts'

const group = (ratings: number[], genres: string[]) => ratings.map((rating) => ({ rating, genres }))
function library(rows: { rating: number; genres: string[] }[]) {
  const template = normalize(fixtureArchive())
  const dataset: Dataset = {
    ...template,
    films: rows.map(({ rating }, i) => ({
      ...template.films[0], id: `lb:P${i}`, title: `Pair film ${i}`, year: 2020,
      rating, watched: true, inWatchlist: false, liked: false, isProfileFavorite: false,
      viewingIds: [], reviewIds: [], listMemberships: [],
    })),
    viewings: [], reviews: [], lists: [], detached: [],
    audit: { ...template.audit, conflicts: [] },
  }
  const metadata: MetadataFile = {
    generatedAt: dataset.generatedAt, sources: ['wikidata'], unmatched: [],
    films: Object.fromEntries(dataset.films.map((film, i) => [film.id, {
      ...emptyMetadata(film, { method: 'letterboxd-id', confidence: 'high', notes: [] }),
      genres: rows[i].genres,
    }])),
  }
  return { dataset, metadata }
}
const run = (x: ReturnType<typeof library>) => analyze(x.dataset, x.metadata, { discover: false, offline: true })

it.each([0, 1])('writes complete, capitalised intro paragraphs with %s qualifying pairs', async (pairCount) => {
  const x = pairCount
    ? library([...group(Array(8).fill(4.5), ['Comedy', 'Horror']), ...group(Array(32).fill(1), ['Drama'])])
    : library([...group(Array(10).fill(4.5), ['Comedy']), ...group(Array(30).fill(3), ['Drama'])])
  for (const [i, m] of Object.values(x.metadata.films).entries()) {
    if (pairCount) m.awardsWon = i < 8 ? ['Academy Award'] : []
    else m.runtime = i < 10 ? 160 : 95
  }
  const data = await run(x)
  expect(data.insights.filter((i) => i.category === 'intersection')).toHaveLength(pairCount)
  for (const text of data.identity.intro) {
    expect(text.trim(), 'paragraph should have a capital first letter').toMatch(/^[A-Z]/)
    expect(text.trim(), 'paragraph should end with terminal punctuation').toMatch(/[.!?]$/)
  }
})

it('finishes the runtime sentence when a below-average pair is dropped', async () => {
  const parentOnly = [...Array(44).fill(2), 2.5]
  const x = library([
    ...group([1.5, 2, 2, 2, 2], ['Comedy', 'Horror']),
    ...group(parentOnly, ['Comedy']), ...group(parentOnly, ['Horror']),
    ...group([...Array(24).fill(5), ...Array(31).fill(4.5)], ['Drama']),
  ])
  for (const m of Object.values(x.metadata.films)) m.runtime = m.genres.includes('Drama') ? 160 : 95
  const data = await run(x)
  expect(data.insights.filter((i) => i.category === 'intersection')).toHaveLength(0)
  for (const text of data.identity.intro) expect(text.trim()).toMatch(/[.!?]$/)
})
