import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memory } from '@/lib/types'
import { Practice } from './Practice'

vi.mock('@/lib/storage', () => ({ updateMemory: vi.fn().mockResolvedValue(null) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function makeMemories(count: number): Memory[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    url: 'https://example.com',
    urlNoHash: 'https://example.com',
    domain: 'example.com',
    pageTitle: 'Example',
    mode: 'hide' as const,
    selectedText: `answer ${i}`,
    contextBefore: `before ${i}`,
    contextAfter: `after ${i}`,
    createdAt: i,
    updatedAt: i,
  }))
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const context = () => container.querySelector('.practice-context')?.textContent ?? ''
const click = async (selector: string) => {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(selector)!.click()
  })
}

describe('Practice', () => {
  it('keeps the same card when the parent re-renders with a fresh memories array', () => {
    const memories = makeMemories(8)
    act(() => root.render(<Practice memories={[...memories]} onClose={() => {}} />))
    const first = context()
    expect(first).toContain('before')

    // Dashboard passes `memories.filter(...)`, a new array identity on every render,
    // and re-renders whenever storage changes (including after each Check).
    for (let i = 0; i < 6; i++) {
      act(() => root.render(<Practice memories={[...memories]} onClose={() => {}} />))
      expect(context()).toBe(first)
    }
  })

  it('shows the answer for the card being practised after a storage-driven re-render', async () => {
    const memories = makeMemories(8)
    act(() => root.render(<Practice memories={[...memories]} onClose={() => {}} />))
    const index = /before (\d+)/.exec(context())![1]

    await click('button.primary') // Check
    act(() => root.render(<Practice memories={[...memories]} onClose={() => {}} />))

    expect(container.querySelector('.practice-answer')?.textContent).toContain(`answer ${index}`)
  })

  it('goes through every memory exactly once', async () => {
    const memories = makeMemories(8)
    act(() => root.render(<Practice memories={[...memories]} onClose={() => {}} />))

    const seen: string[] = []
    for (let i = 0; i < memories.length; i++) {
      seen.push(/before (\d+)/.exec(context())![1])
      await click('button.primary') // Check
      act(() => root.render(<Practice memories={[...memories]} onClose={() => {}} />))
      await click('button.primary') // Next / Finish
    }

    expect(new Set(seen).size).toBe(memories.length)
    expect(container.textContent).toContain('Session complete')
  })
})
