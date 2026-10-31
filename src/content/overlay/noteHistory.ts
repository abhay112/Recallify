/** Undo/redo for the note textarea. Pure, so it can be tested without a DOM. */
const MAX_STEPS = 200

export interface History {
  past: string[]
  present: string
  future: string[]
  /** When the last edit happened, or 0 if the next edit must start a new undo step. */
  lastEditAt: number
}

export function createHistory(initial: string): History {
  return { past: [], present: initial, future: [], lastEditAt: 0 }
}

/**
 * Records an edit. Edits closer together than `coalesceMs` fold into one undo step, so
 * typing a sentence undoes in sensible chunks; pass 0 for one-shot actions like Clear.
 */
export function edit(history: History, value: string, now: number, coalesceMs: number): History {
  if (value === history.present) return history
  const coalesce = history.lastEditAt > 0 && now - history.lastEditAt < coalesceMs
  const past = coalesce ? history.past : [...history.past, history.present].slice(-MAX_STEPS)
  return { past, present: value, future: [], lastEditAt: now }
}

export function undo(history: History): History {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastEditAt: 0,
  }
}

export function redo(history: History): History {
  if (history.future.length === 0) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastEditAt: 0,
  }
}
