import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_HEIGHT, MIN_WIDTH, Popover } from './Popover'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ANCHOR = { top: 200, left: 500 }
// Where jsdom (which has no layout) is told the popover sits: 400x300 at (100, 100).
const RECT = { left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300, x: 100, y: 100 }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...RECT, toJSON: () => RECT } as DOMRect)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(RECT.width)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(RECT.height)
  window.innerWidth = 1000
  window.innerHeight = 800

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Popover position={ANCHOR}>content</Popover>))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const popover = () => container.querySelector<HTMLElement>('.recallify-popover')!
const handle = () => container.querySelector<HTMLElement>('.recallify-popover-handle')!
const grip = () => container.querySelector<HTMLElement>('.recallify-popover-grip')!

function pointer(target: HTMLElement, type: string, x: number, y: number) {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }))
  })
}

function drag(target: HTMLElement, from: [number, number], to: [number, number]) {
  pointer(target, 'pointerdown', ...from)
  pointer(target, 'pointermove', ...to)
  pointer(target, 'pointerup', ...to)
}

describe('Popover', () => {
  it('opens at its anchor and sizes itself to its content', () => {
    expect(popover().style.top).toBe('200px')
    expect(popover().style.left).toBe('500px')
    expect(popover().style.width).toBe('')
    expect(popover().classList.contains('is-sized')).toBe(false)
    expect(popover().textContent).toContain('content')
  })

  it('moves by the distance the handle is dragged', () => {
    drag(handle(), [300, 110], [350, 160])

    expect(popover().style.left).toBe('550px')
    expect(popover().style.top).toBe('250px')
  })

  it('keeps moving from where it was left on the next drag', () => {
    drag(handle(), [300, 110], [350, 160])
    drag(handle(), [350, 160], [330, 190])

    expect(popover().style.left).toBe('530px')
    expect(popover().style.top).toBe('280px')
  })

  it('cannot be dragged off the bottom-right of the screen', () => {
    drag(handle(), [300, 110], [9000, 9000])

    // Its right and bottom edges stop at the viewport edges (1000 x 800).
    expect(popover().style.left).toBe(`${500 + (1000 - RECT.right)}px`)
    expect(popover().style.top).toBe(`${200 + (800 - RECT.bottom)}px`)
  })

  it('cannot be dragged off the top-left of the screen', () => {
    drag(handle(), [300, 110], [-9000, -9000])

    // Its left and top edges stop at the viewport edges.
    expect(popover().style.left).toBe(`${500 - RECT.left}px`)
    expect(popover().style.top).toBe(`${200 - RECT.top}px`)
  })

  it('does not jump when grabbed while already partly off the screen', () => {
    const offLeft = { ...RECT, left: -60, right: 340, x: -60 }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...offLeft, toJSON: () => offLeft } as DOMRect)

    drag(handle(), [100, 110], [110, 120])

    // Moves with the pointer, rather than being snapped back on screen.
    expect(popover().style.left).toBe('510px')
    expect(popover().style.top).toBe('210px')
  })

  it('grows from the grip and keeps the left edge in place', () => {
    drag(grip(), [500, 400], [560, 540])

    expect(popover().style.width).toBe('460px')
    expect(popover().style.height).toBe('440px')
    expect(popover().classList.contains('is-sized')).toBe(true)
    // It is centred on its anchor, so it shifts right by half the growth to hold the left edge.
    expect(popover().style.left).toBe('530px')
    expect(popover().style.top).toBe('200px')
  })

  it('will not shrink below a usable size', () => {
    drag(grip(), [500, 400], [-5000, -5000])

    expect(popover().style.width).toBe(`${MIN_WIDTH}px`)
    expect(popover().style.height).toBe(`${MIN_HEIGHT}px`)
  })

  it('will not grow beyond the viewport', () => {
    drag(grip(), [500, 400], [9000, 9000])

    expect(popover().style.width).toBe(`${1000 - 16}px`)
    expect(popover().style.height).toBe(`${800 - 16}px`)
  })

  it('marks itself while a drag is in progress', () => {
    pointer(handle(), 'pointerdown', 300, 110)
    expect(popover().classList.contains('is-dragging')).toBe(true)
    pointer(handle(), 'pointerup', 300, 110)
    expect(popover().classList.contains('is-dragging')).toBe(false)
  })

  it('ignores non-primary mouse buttons', () => {
    act(() => {
      handle().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX: 300, clientY: 110 }))
    })
    pointer(handle(), 'pointermove', 400, 210)

    expect(popover().style.left).toBe('500px')
  })

  it('does not leak mouseup to the page, so a drag cannot re-trigger the selection toolbar', () => {
    const onPageMouseUp = vi.fn()
    document.addEventListener('mouseup', onPageMouseUp)

    act(() => {
      handle().dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(onPageMouseUp).not.toHaveBeenCalled()
    document.removeEventListener('mouseup', onPageMouseUp)
  })
})
