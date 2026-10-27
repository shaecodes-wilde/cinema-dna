// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'
import { CHAPTERS } from '../chapters/registry.ts'
import { bundle, stubBrowser } from './helpers.ts'

vi.mock('../chapters/Opening.tsx', () => ({ Opening: () => null }))
vi.mock('../chapters/Dna.tsx', () => ({ Dna: () => null }))
vi.mock('../chapters/Genres.tsx', () => ({ Genres: () => null }))
vi.mock('../chapters/Timeline.tsx', () => ({ Timeline: () => null }))
vi.mock('../chapters/Directors.tsx', () => ({ Directors: () => null }))
vi.mock('../chapters/Constellation.tsx', () => ({ Constellation: () => null }))
vi.mock('../chapters/FiveStar.tsx', () => ({ FiveStar: () => null }))
vi.mock('../chapters/Critic.tsx', () => ({ Critic: () => null }))
vi.mock('../chapters/Next.tsx', () => ({ Next: () => null }))
vi.mock('../chapters/Report.tsx', () => ({ Report: () => null }))
vi.mock('../chapters/Explorer.tsx', () => ({ Explorer: () => null }))
vi.mock('../chapters/Quality.tsx', () => ({ Quality: () => null }))

beforeEach(() => stubBrowser())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('gives every numbered mobile chapter link its explicit nav label', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => bundle() }))
  render(<App />)
  const nav = await screen.findByRole('navigation', { name: 'Chapters' })
  for (const chapter of CHAPTERS) {
    const link = within(nav).getByRole('link', { name: chapter.nav })
    expect(link.getAttribute('href')).toBe(`#${chapter.id}`)
    expect(link.getAttribute('aria-label')).toBe(chapter.nav)
  }
})

it('shows the recovery instructions for an invalid JSON bundle', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) }))
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'No analysis found yet.' })).toBeTruthy()
  expect(document.body.textContent).toContain('is not a CINEMA DNA bundle; rerun npm run analyze')
  expect(screen.queryByRole('navigation')).toBeNull()
})
