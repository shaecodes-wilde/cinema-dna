// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GenrePair } from '../../../../shared/app-types.ts'
import { stubBrowser } from '../../../__tests__/helpers.ts'
import { TooltipProvider } from '../../../ui/primitives.tsx'
import { deltaColor } from '../../dna/scales.ts'
import { PairMatrix } from '../PairMatrix.tsx'

beforeEach(() => {
  stubBrowser()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([0.6, -0.4, 0])('labels lift %s against your average in cells and tooltips', (lift) => {
  const pair: GenrePair = { a: 'Comedy', b: 'Horror', n: 5, mean: 4, shrunk: 3.6, synergy: lift, filmIds: [] }
  const onSelect = vi.fn()
  const { container } = render(
    <TooltipProvider><PairMatrix genres={['Comedy', 'Horror', 'Drama']} pairs={[pair]} selected={pair} onSelect={onSelect} /></TooltipProvider>,
  )
  expect(screen.getByRole('grid', { name: 'Genre overlap matrix' })).toBeTruthy()
  const cell = screen.getByRole('gridcell', { name: /Comedy and Horror: 5 films/ })
  expect(cell.getAttribute('aria-label')).toContain(`${lift >= 0 ? '+' : '−'}${Math.abs(lift).toFixed(2)} stars vs your average`)
  expect(cell.querySelector('rect')?.getAttribute('fill')).toBe(deltaColor(lift, 0.35))
  expect(screen.getAllByRole('gridcell', { name: /fewer than 3 films/ })).toHaveLength(2)
  fireEvent.mouseMove(cell, { clientX: 100, clientY: 100 })
  expect(screen.getByRole('tooltip').textContent).toContain('★ vs your average')
  const labels = Array.from(container.querySelectorAll('[aria-label]'), (el) => el.getAttribute('aria-label')).join(' ')
  expect(`${container.textContent} ${labels}`).not.toMatch(/synergy|better together|on its own|\balone\b|lifts both|matter more than the components|great multiplier|better parent|combination is doing work/i)
  fireEvent.click(cell)
  fireEvent.keyDown(cell, { key: 'Enter' })
  fireEvent.keyDown(cell, { key: ' ' })
  expect(onSelect).toHaveBeenCalledTimes(3)
  expect(onSelect).toHaveBeenLastCalledWith(pair)
  fireEvent.mouseLeave(cell)
  expect(screen.queryByRole('tooltip')).toBeNull()
})
