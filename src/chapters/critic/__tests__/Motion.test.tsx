// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bundle, stubBrowser } from '../../../__tests__/helpers.ts'
import { DataProvider } from '../../../lib/data.tsx'
import { ModelPanel } from '../Motion.tsx'

beforeEach(() => stubBrowser())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([0.5, 0.95, 1.1])('labels development CV honestly at error %s, keeping the no-better guard', (cvRmse) => {
  const data = bundle()
  data.model = { ...data.model, available: true, cvRmse, baselineRmse: 1 }
  const { container } = render(<DataProvider data={data}><ModelPanel /></DataProvider>)
  expect(container.textContent).not.toContain('genuinely')
  expect(container.textContent).toContain('development estimate')
  expect(container.textContent).toContain('λ was tuned on the same folds')
  expect(container.textContent).toContain('optimistic; magnitude unknown')
  expect(container.textContent).toContain('vocabulary is built before the folds; its effect is unmeasured')
  if (cvRmse > 1) expect(screen.getByText('no better')).toBeTruthy()
  if (cvRmse === 0.5) expect(container.textContent).toContain('a strong association on this data')
})

it('keeps predictions off for an unavailable model', () => {
  const data = bundle()
  data.model.available = false
  const { container } = render(<DataProvider data={data}><ModelPanel /></DataProvider>)
  expect(container.textContent).toContain('are switched off')
  expect(container.textContent).not.toContain('CV error')
})
