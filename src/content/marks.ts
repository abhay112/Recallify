import type { Memory } from '@/lib/types'
import { locateRange } from '@/lib/anchor'

function wrapRange(range: Range, tagName: string): HTMLElement {
  const wrapper = document.createElement(tagName)
  wrapper.setAttribute('data-recallify-ignore', 'true')
  const content = range.extractContents()
  wrapper.appendChild(content)
  range.insertNode(wrapper)
  return wrapper
}

export function applyInlineMark(range: Range, memory: Memory, onOpenNote: (memory: Memory) => void): void {
  const wrapper = wrapRange(range, 'mark')
  wrapper.className = 'recallify-mark'
  wrapper.dataset.recallifyId = memory.id
  wrapper.title = memory.note ? 'Click to view your note' : 'Click to add a note'
  wrapper.addEventListener('click', (event) => {
    event.stopPropagation()
    onOpenNote(memory)
  })
}

export function applyHideMark(range: Range, memory: Memory, onChange: (patch: Partial<Memory>) => void): void {
  const wrapper = wrapRange(range, 'span')
  wrapper.className = 'recallify-hide-wrap'
  wrapper.dataset.recallifyId = memory.id

  const original = document.createElement('span')
  original.className = 'recallify-hide-original'

  while (wrapper.firstChild) {
    original.appendChild(wrapper.firstChild)
  }
  wrapper.appendChild(original)

  const blank = document.createElement('span')
  blank.className = 'recallify-hide-blank'
  blank.textContent = '🧠 recall?'
  blank.setAttribute('data-recallify-ignore', 'true')
  wrapper.appendChild(blank)

  let revealed = Boolean(memory.revealed)
  const setRevealed = (value: boolean) => {
    revealed = value
    wrapper.classList.toggle('is-revealed', revealed)
    original.classList.toggle('is-revealed', revealed)
  }
  setRevealed(revealed)

  blank.addEventListener('click', (event) => {
    event.stopPropagation()
    if (revealed) return
    openRecallInput(blank, memory, (attempt) => {
      const correct = attempt.trim().toLowerCase() === memory.selectedText.trim().toLowerCase()
      setRevealed(true)
      onChange({ recallAttempt: attempt, revealed: true })
      showResult(wrapper, correct)
    })
  })

  original.addEventListener('click', (event) => {
    event.stopPropagation()
    setRevealed(false)
    onChange({ revealed: false })
  })
}

function openRecallInput(
  blank: HTMLElement,
  memory: Memory,
  onSubmit: (attempt: string) => void
): void {
  const input = document.createElement('input')
  input.className = 'recallify-hide-input'
  input.type = 'text'
  input.placeholder = `${memory.selectedText.length} chars`
  input.setAttribute('data-recallify-ignore', 'true')
  blank.replaceWith(input)
  input.focus()

  const finish = () => {
    const value = input.value
    input.replaceWith(blank)
    onSubmit(value)
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish()
    } else if (event.key === 'Escape') {
      input.replaceWith(blank)
    }
  })
  input.addEventListener('blur', () => {
    if (document.body.contains(input)) finish()
  })
}

function showResult(wrapper: HTMLElement, correct: boolean): void {
  const existing = wrapper.querySelector('.recallify-hide-result')
  existing?.remove()
  const result = document.createElement('span')
  result.className = `recallify-hide-result ${correct ? 'correct' : 'incorrect'}`
  result.setAttribute('data-recallify-ignore', 'true')
  result.textContent = correct ? '✓' : '✗'
  wrapper.appendChild(result)
}

export function restoreMemoriesOnPage(
  memories: Memory[],
  onOpenNote: (memory: Memory) => void,
  onHideChange: (id: string, patch: Partial<Memory>) => void
): void {
  for (const memory of memories) {
    if (document.querySelector(`[data-recallify-id="${memory.id}"]`)) continue
    const range = locateRange(memory.selectedText, memory.contextBefore, memory.contextAfter)
    if (!range) continue
    try {
      if (memory.mode === 'inline') {
        applyInlineMark(range, memory, onOpenNote)
      } else {
        applyHideMark(range, memory, (patch) => onHideChange(memory.id, patch))
      }
    } catch {
      // Selection could not be safely wrapped (e.g. spans a table boundary) — skip it.
    }
  }
}
