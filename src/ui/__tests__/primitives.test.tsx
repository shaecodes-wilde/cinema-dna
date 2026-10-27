// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bundle, stubBrowser } from '../../__tests__/helpers.ts'
import { DataProvider } from '../../lib/data.tsx'
import { Report } from '../../chapters/Report.tsx'
import { Chapter, Poster, Reveal } from '../primitives.tsx'

beforeEach(() => stubBrowser())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('makes unseen reveals static before printing and restores them afterwards', () => {
  const { container } = render(<Reveal><p>Essay</p></Reveal>)
  expect((container.firstElementChild as HTMLElement).style.opacity).toBe('0')
  fireEvent(window, new Event('beforeprint'))
  expect((container.firstElementChild as HTMLElement).style.opacity).not.toBe('0')
  expect((container.firstElementChild as HTMLElement).style.transform).toBe('')
  fireEvent(window, new Event('afterprint'))
  expect((container.firstElementChild as HTMLElement).style.opacity).toBe('0')
})

it('mounts an unseen chapter for browser printing', () => {
  render(<Chapter id="report" number="10" title="Report" kicker="Essay"><Reveal><p>Unseen essay</p></Reveal></Chapter>)
  expect(screen.queryByText('Unseen essay')).toBeNull()
  fireEvent(window, new Event('beforeprint'))
  expect(screen.getByText('Unseen essay')).toBeTruthy()
})

it('replaces a broken poster with the title card and retries a different URL', () => {
  const data = bundle()
  const film = { ...data.films[0], poster: 'https://example.invalid/poster.jpg' }
  const { container, rerender } = render(<DataProvider data={data}><Poster film={film} /></DataProvider>)
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText(film.title)).toBeTruthy()
  rerender(<DataProvider data={data}><Poster film={{ ...film, poster: 'https://example.invalid/new.jpg' }} /></DataProvider>)
  expect(container.querySelector('img')?.getAttribute('src')).toContain('/new.jpg')
})

it('includes every report essay when printing without scrolling through it', () => {
  const data = bundle()
  render(<DataProvider data={data}><Report /></DataProvider>)
  const report = document.getElementById('report')!
  expect(report.querySelector('.report-essay')).toBeNull()
  fireEvent(window, new Event('beforeprint'))
  for (const section of data.report.sections) {
    expect(screen.getByRole('heading', { name: section.heading })).toBeTruthy()
    for (const paragraph of section.paragraphs) expect(report.textContent).toContain(paragraph)
  }
})
