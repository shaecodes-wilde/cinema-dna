// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bundle, stubBrowser } from '../../__tests__/helpers.ts'
import { DataProvider } from '../../lib/data.tsx'
import { TooltipProvider } from '../../ui/primitives.tsx'
import { Genres } from '../Genres.tsx'

beforeEach(() => {
  stubBrowser()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('explains overlaps, labels list lifts, and keeps the baseline label after selection', () => {
  const data = bundle()
  data.insights = []
  data.timeline.years = []
  data.affinities.genre = ['Comedy', 'Horror', 'Drama'].map((key) => ({ ...data.affinities.genre[0], key, label: key, n: 12 }))
  data.genrePairs = [
    { a: 'Comedy', b: 'Horror', n: 5, mean: 4, shrunk: 3.6, synergy: 0.6, filmIds: [] },
    { a: 'Drama', b: 'Horror', n: 6, mean: 2, shrunk: 2.6, synergy: -0.4, filmIds: [] },
  ]
  const { container } = render(<DataProvider data={data}><TooltipProvider><Genres /></TooltipProvider></DataProvider>)
  fireEvent(window, new Event('beforeprint'))
  const section = screen.getByRole('heading', { name: 'Where two genres overlap' }).parentElement!.parentElement!
  expect(container.textContent).toContain('The overlaps below show which genre combinations you rate highest')
  expect(section.textContent).toContain('Amber means films carrying both rate above your overall average; blue means below')
  for (const title of ['Highest-rated overlaps', 'Lowest-rated overlaps']) expect(within(section).getByText(title)).toBeTruthy()
  const lists = within(section).getAllByRole('list')
  for (const list of lists) {
    for (const item of within(list).getAllByRole('listitem')) {
      expect(item.textContent).toContain('★ vs avg')
      expect(item.querySelector('[aria-label]')?.getAttribute('aria-label')).toMatch(/[+−]\d\.\d{2} stars vs your average/)
    }
  }
  fireEvent.focus(within(section).getByRole('button', { name: 'What does this mean?' }))
  expect(within(section).getByRole('tooltip').textContent).toContain('the same measure as the genre bars')
  expect(within(section).getByRole('tooltip').textContent).toContain('not whether combining them adds anything')
  const checkCopy = () => {
    const labels = Array.from(section.querySelectorAll('[aria-label]'), (el) => el.getAttribute('aria-label')).join(' ')
    expect(`${section.textContent} ${labels}`).not.toMatch(/synergy|better together|on its own|\balone\b|lifts both|matter more than the components|great multiplier|better parent|combination is doing work/i)
  }
  checkCopy()
  fireEvent.click(within(lists[0]).getByRole('button', { name: /Comedy × Horror/ }))
  expect(within(section).getByRole('heading', { name: 'Comedy × Horror' })).toBeTruthy()
  expect(section.textContent).toContain('+0.60★ vs your average')
  checkCopy()
  fireEvent.click(within(section).getByRole('gridcell', { name: /Drama and Horror: 6 films/ }))
  expect(within(section).getByRole('heading', { name: 'Drama × Horror' })).toBeTruthy()
  expect(section.textContent).toContain('−0.40★ vs your average')
  checkCopy()
})
