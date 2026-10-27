// @vitest-environment jsdom
/// <reference types="node" />
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { stubBrowser } from '../../__tests__/helpers.ts'

beforeEach(() => stubBrowser())
afterEach(() => vi.unstubAllGlobals())

const styles = readFileSync('src/styles.css', 'utf8')
const color = (token: string) => styles.match(new RegExp(`--color-${token}: #([a-f0-9]{6});`))![1]
const luminance = (hex: string) => hex.match(/../g)!.reduce((sum, channel, i) => {
  const value = parseInt(channel, 16) / 255
  return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]
}, 0)

it.each(['night', 'night-2', 'night-3'])('keeps faint text at WCAG AA contrast on %s', (surface) => {
  const ratio = (luminance(color('faint')) + 0.05) / (luminance(color(surface)) + 0.05)
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})
