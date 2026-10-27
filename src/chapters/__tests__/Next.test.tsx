// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bundle, stubBrowser } from '../../__tests__/helpers.ts'
import { DataProvider } from '../../lib/data.tsx'
import { Next } from '../Next.tsx'

beforeEach(() => stubBrowser())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([true, false])('labels the recommendation estimate when available=%s', (available) => {
  const data = bundle()
  data.model.available = available
  data.recommendations = []
  const { container } = render(<DataProvider data={data}><Next /></DataProvider>)
  fireEvent(window, new Event('beforeprint'))
  if (available) {
    expect(container.textContent).toContain('cross-validated development estimates')
    expect(container.textContent).toContain('optimistic because λ was tuned on the same folds; magnitude unknown')
  } else {
    expect(container.textContent).toContain('Too few ratings for a taste model yet')
    expect(container.textContent).not.toContain('typical miss')
  }
})
