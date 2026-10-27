import synthetic from '../../docs/audit-evidence/results/runtime/synthetic-app-data.json?raw'
import { vi } from 'vitest'
import type { AppData } from '../../shared/app-types.ts'

export const bundle = (): AppData => JSON.parse(synthetic)

export function stubBrowser(reduced = false) {
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: reduced, media, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })))
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
}
