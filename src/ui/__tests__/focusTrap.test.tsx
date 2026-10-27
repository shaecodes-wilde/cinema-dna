// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bundle, stubBrowser } from '../../__tests__/helpers.ts'
import { DataProvider, useData } from '../../lib/data.tsx'
import { FilmDrawer } from '../FilmDrawer.tsx'
import { trapTab } from '../focusTrap.ts'

beforeEach(() => stubBrowser(true))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('wraps Tab in both directions, skipping disabled and hidden controls', () => {
  const { container } = render(<div tabIndex={-1}><button>first</button><button disabled>disabled</button><button hidden>hidden</button><button tabIndex={-1}>excluded</button><a href="#last">last</a></div>)
  const panel = container.firstElementChild as HTMLElement
  const first = screen.getByText('first')
  const last = screen.getByText('last')
  first.focus()
  const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
  trapTab(panel, backward)
  expect(backward.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(last)
  const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
  trapTab(panel, forward)
  expect(forward.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(first)
  const interior = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
  trapTab(panel, interior)
  expect(interior.defaultPrevented).toBe(false)
})

it('skips controls inside a CSS-hidden ancestor', () => {
  const { container } = render(<div tabIndex={-1}><button>first</button><a href="#last">last</a><div style={{ display: 'none' }}><button>hidden child</button></div></div>)
  const panel = container.firstElementChild as HTMLElement
  screen.getByText('first').focus()
  const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
  trapTab(panel, backward)
  expect(document.activeElement).toBe(screen.getByText('last'))
})

it('keeps focus on an empty dialog', () => {
  const { container } = render(<div tabIndex={-1} />)
  const panel = container.firstElementChild as HTMLElement
  const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
  trapTab(panel, event)
  expect(event.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(panel)
})

const data = bundle()
const film = data.films.find((f) => f.matched && f.genres.length)!
function Harness() {
  const { openFilm, filter } = useData()
  return <><button onClick={() => openFilm(film.id)}>Open</button><output>{filter.genre}</output><section id="explorer" /><FilmDrawer /></>
}

it('contains focus, makes the background inert, locks scrolling, and restores focus on Escape', async () => {
  document.body.style.overflow = 'auto'
  const { container } = render(<DataProvider data={data}><Harness /></DataProvider>)
  const opener = screen.getByText('Open')
  opener.focus()
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog')
  const close = within(dialog).getByRole('button', { name: 'Close film details' })
  expect(document.activeElement).toBe(close)
  expect(container.hasAttribute('inert')).toBe(true)
  expect(dialog.closest('[inert]')).toBeNull()
  expect(document.body.style.overflow).toBe('hidden')
  const controls = dialog.querySelectorAll('button, a[href]')
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(controls[controls.length - 1])
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
  expect(document.activeElement).toBe(close)
  const focus = vi.spyOn(opener, 'focus')
  fireEvent.keyDown(close, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(document.activeElement).toBe(opener)
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(container.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('auto')
  document.body.style.overflow = ''
})

it('preserves an existing inert background and unlocks on drill-down without scrolling focus', async () => {
  const previous = document.createElement('div')
  previous.setAttribute('inert', '')
  document.body.append(previous)
  const scroll = vi.fn()
  const previousScroll = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  const { unmount } = render(<DataProvider data={data}><Harness /></DataProvider>)
  const opener = screen.getByText('Open')
  opener.focus()
  fireEvent.click(opener)
  const focus = vi.spyOn(opener, 'focus')
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: film.genres[0] }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('status').textContent).toBe(film.genres[0])
  await waitFor(() => expect(scroll).toHaveBeenCalled())
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(previous.hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('')
  unmount()
  previous.remove()
  HTMLElement.prototype.scrollIntoView = previousScroll
  vi.restoreAllMocks()
})
