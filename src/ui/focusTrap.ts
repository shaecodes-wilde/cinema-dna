/** True when the element or any ancestor up to the container is CSS-hidden. */
function cssHidden(el: HTMLElement, container: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node && node !== container.parentElement; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return true
  }
  return false
}

/** Wrap keyboard navigation at the dialog edges, including focus arriving from outside. */
export function trapTab(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return
  const controls = [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert], [aria-hidden="true"]') && !cssHidden(el, container))
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || !last) {
    e.preventDefault()
    container.focus({ preventScroll: true })
  } else if (!controls.includes(document.activeElement as HTMLElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus({ preventScroll: true })
  }
}
