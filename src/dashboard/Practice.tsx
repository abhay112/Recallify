import { useState } from 'react'
import { updateMemory } from '@/lib/storage'
import type { Memory } from '@/lib/types'

interface PracticeProps {
  memories: Memory[]
  onClose: () => void
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function Practice({ memories, onClose }: PracticeProps) {
  // Deal the deck once. `memories` changes identity on every Dashboard render, and
  // each Check writes to storage (which re-renders Dashboard), so reshuffling on
  // prop changes would swap the card out from under the user mid-session.
  const [shuffled] = useState(() => shuffle(memories))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [results, setResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  const current = shuffled[index]
  const done = index >= shuffled.length

  const check = async () => {
    if (!current) return
    const correct = attempt.trim().toLowerCase() === current.selectedText.trim().toLowerCase()
    setResults((r) => ({ correct: r.correct + (correct ? 1 : 0), total: r.total + 1 }))
    setRevealed(true)
    await updateMemory(current.id, { recallAttempt: attempt, revealed: true })
  }

  const next = () => {
    setIndex((i) => i + 1)
    setRevealed(false)
    setAttempt('')
  }

  return (
    <div className="practice-overlay">
      <div className="practice-card">
        <button className="practice-close" onClick={onClose}>✕</button>

        {!done && current && (
          <>
            <div className="practice-progress">
              {index + 1} / {shuffled.length}
            </div>
            <div className="practice-context">
              {current.contextBefore} <span className="blank-marker">[ ? ]</span> {current.contextAfter}
            </div>

            {!revealed ? (
              <>
                <input
                  autoFocus
                  className="practice-input"
                  placeholder="What goes in the blank?"
                  value={attempt}
                  onChange={(e) => setAttempt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && check()}
                />
                <button className="primary" onClick={check}>Check</button>
              </>
            ) : (
              <>
                <div className={`practice-answer ${attempt.trim().toLowerCase() === current.selectedText.trim().toLowerCase() ? 'correct' : 'incorrect'}`}>
                  Correct answer: <strong>{current.selectedText}</strong>
                  <br />
                  Your answer: {attempt || '(empty)'}
                </div>
                <button className="primary" onClick={next}>
                  {index + 1 === shuffled.length ? 'Finish' : 'Next →'}
                </button>
              </>
            )}
          </>
        )}

        {done && (
          <div className="practice-summary">
            <h3>Session complete 🎉</h3>
            <p>{results.correct} / {results.total} correct</p>
            <button className="primary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
