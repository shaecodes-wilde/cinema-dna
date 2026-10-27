// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { bundle, stubBrowser } from '../../../__tests__/helpers.ts'
import { DataProvider } from '../../../lib/data.tsx'
import { Quality } from '../../Quality.tsx'
import { dataHandlingText } from '../dataHandling.ts'

beforeEach(() => stubBrowser())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([
  { sources: [], names: ['No film metadata enrichment was run for this build.'] },
  { sources: ['wikidata'], names: ['Wikidata'] },
  { sources: ['wikidata', 'tmdb'], names: ['Wikidata and TMDB', 'Poster images load from TMDB.'] },
  { sources: ['synthetic-fixture'], names: ['synthetic-fixture'] },
])('renders complete data-handling copy for $sources', ({ sources, names }) => {
  const text = dataHandlingText(sources)
  expect(text).toContain('Your export file stays on this machine.')
  for (const name of names) expect(text).toContain(name)
  expect(text).toMatch(/\.$/)
  expect(text).not.toMatch(/to\s*[;.]|wikidata|tmdb/)
  expect(text.includes('Poster images')).toBe(sources.includes('tmdb'))
  const data = bundle()
  data.source.metadataSources = sources
  render(createElement(DataProvider, { data, children: createElement(Quality) }))
  fireEvent(window, new Event('beforeprint'))
  expect(screen.getByText((_, node) => node?.tagName === 'P' && !!node.textContent?.includes(text))).toBeTruthy()
  expect(document.body.textContent).not.toContain('nothing is uploaded anywhere')
  expect(document.body.textContent).not.toContain("refreshes only fetch what's new")
  expect(document.body.textContent).toContain('online refreshes can re-query existing films')
})
