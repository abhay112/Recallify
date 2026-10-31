import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorBody } from './NoteTools'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const settings = { fontSize: 15, popoverTheme: 'light' as 'light' | 'dark' }
const updateSettings = vi.fn()

vi.mock('@/lib/settings', () => ({
  getSettings: () => Promise.resolve(settings),
  onSettingsChanged: () => () => {},
  updateSettings: (patch: unknown) => updateSettings(patch),
}))

const SOURCE = { selectedText: 'quote', pageTitle: 'Page', url: 'https://example.com/a' }

let container: HTMLDivElement
let root: Root
let latest = ''
const onStar = vi.fn()
const onSubmit = vi.fn()

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  latest = value
  return (
    <EditorBody
      value={value}
      onChange={setValue}
      source={SOURCE}
      starred={false}
      onStarChange={onStar}
      onOpenDashboard={() => {}}
      onSubmit={onSubmit}
    />
  )
}

async function mount(initial = '') {
  await act(async () => root.render(<Harness initial={initial} />))
  await act(async () => {})
}

const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
const click = (label: string) => act(async () => button(label).click())
const status = () => container.querySelector('.recallify-tools-status')!.textContent

beforeEach(() => {
  settings.fontSize = 15
  settings.popoverTheme = 'light'
  latest = ''
  updateSettings.mockClear()
  onStar.mockClear()
  onSubmit.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('EditorBody tools', () => {
  it('shows word and character counts', async () => {
    await mount('hello brave world')
    expect(status()).toBe('3 words · 17 characters')
  })

  it('disables text tools while the note is empty', async () => {
    await mount()
    expect(button('Cut').disabled).toBe(true)
    expect(button('Clear').disabled).toBe(true)
    expect(button('Paste').disabled).toBe(false)
  })

  it('clears the note and undo brings it back', async () => {
    await mount('keep me')
    await click('Clear')
    expect(latest).toBe('')
    await click('Undo')
    expect(latest).toBe('keep me')
    await click('Redo')
    expect(latest).toBe('')
  })

  it('cycles the case of the whole note', async () => {
    await mount('Hello world')
    await click('Change case')
    expect(latest).toBe('HELLO WORLD')
    await click('Change case')
    expect(latest).toBe('hello world')
  })

  it('stars through the callback', async () => {
    await mount('x')
    await click('Star this memory')
    expect(onStar).toHaveBeenCalledWith(true)
  })

  it('changes font size and the theme through settings', async () => {
    await mount('x')
    await click('Larger text')
    expect(updateSettings).toHaveBeenCalledWith({ fontSize: 16 })
    await click('Switch to dark theme')
    expect(updateSettings).toHaveBeenCalledWith({ popoverTheme: 'dark' })
  })

  it('toggles the shortcuts help', async () => {
    await mount('x')
    expect(container.querySelector('.recallify-tools-help')).toBeNull()
    await click('Shortcuts')
    expect(container.querySelector('.recallify-tools-help')).not.toBeNull()
  })

  it('submits on Ctrl+Enter', async () => {
    await mount('x')
    const area = container.querySelector('textarea')!
    await act(async () => {
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    })
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('downloads the note with its source', async () => {
    const create = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await mount('my note')
    await act(async () => button('Download as .txt').click())
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalled()
    expect(status()).toBe('Downloaded')
    click.mockRestore()
  })
})
