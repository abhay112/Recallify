import { useEffect, useState } from 'react'
import type { Memory, SelectionContext } from '@/lib/types'
import { CategoryPicker } from './CategoryPicker'

interface Position {
  top: number
  left: number
}

type OverlayState =
  | { mode: 'idle' }
  | { mode: 'toolbar'; position: Position; selection: SelectionContext }
  | { mode: 'editor'; position: Position; selection: SelectionContext }
  | { mode: 'note'; position: Position; memory: Memory }

interface OverlayProps {
  state: OverlayState
  onRemember: (selection: SelectionContext) => void
  onHide: (selection: SelectionContext) => void
  onSaveNote: (note: string, categoryId: string | undefined) => void
  onUpdateNote: (memory: Memory, note: string, categoryId: string | undefined) => void
  onDeleteNote: (memory: Memory) => void
  onClose: () => void
}

export function Overlay({ state, onRemember, onHide, onSaveNote, onUpdateNote, onDeleteNote, onClose }: OverlayProps) {
  if (state.mode === 'idle') return null

  return (
    <div className="recallify-overlay-root" onMouseDown={(e) => e.stopPropagation()}>
      {state.mode === 'toolbar' && (
        <Toolbar position={state.position} onRemember={() => onRemember(state.selection)} onHide={() => onHide(state.selection)} />
      )}
      {state.mode === 'editor' && (
        <NoteEditor
          position={state.position}
          selectedText={state.selection.selectedText}
          onSave={onSaveNote}
          onCancel={onClose}
        />
      )}
      {state.mode === 'note' && (
        <NoteViewer
          position={state.position}
          memory={state.memory}
          onSave={(note, categoryId) => onUpdateNote(state.memory, note, categoryId)}
          onDelete={() => onDeleteNote(state.memory)}
          onClose={onClose}
        />
      )}
    </div>
  )
}

function Toolbar({ position, onRemember, onHide }: { position: Position; onRemember: () => void; onHide: () => void }) {
  return (
    <div className="recallify-toolbar" style={{ top: position.top, left: position.left }}>
      <button onClick={onRemember}>💡 Remember</button>
      <button onClick={onHide}>🙈 Hide &amp; Remember</button>
    </div>
  )
}

function NoteEditor({
  position,
  selectedText,
  onSave,
  onCancel,
}: {
  position: Position
  selectedText: string
  onSave: (note: string, categoryId: string | undefined) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="recallify-popover" style={{ top: position.top, left: position.left }}>
      <div className="recallify-popover-label">SELECTED TEXT</div>
      <div className="recallify-popover-quote">{selectedText}</div>

      <div className="recallify-popover-label">CATEGORY</div>
      <CategoryPicker categoryId={categoryId} onChange={setCategoryId} />

      <textarea
        autoFocus
        placeholder="Write your explanation…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="recallify-popover-actions">
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={() => onSave(note, categoryId)} disabled={!note.trim()}>Save memory</button>
      </div>
    </div>
  )
}

function NoteViewer({
  position,
  memory,
  onSave,
  onDelete,
  onClose,
}: {
  position: Position
  memory: Memory
  onSave: (note: string, categoryId: string | undefined) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(memory.note ?? '')
  const [categoryId, setCategoryId] = useState<string | undefined>(memory.categoryId)

  if (!editing) {
    return (
      <div className="recallify-popover" style={{ top: position.top, left: position.left }}>
        <div className="recallify-popover-label">YOUR NOTE</div>
        <div className="recallify-popover-note">{memory.note || '(no note saved)'}</div>
        <div className="recallify-popover-actions">
          <button className="danger" onClick={onDelete}>Delete</button>
          <button className="secondary" onClick={() => setEditing(true)}>Edit</button>
          <button className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="recallify-popover" style={{ top: position.top, left: position.left }}>
      <div className="recallify-popover-label">SELECTED TEXT</div>
      <div className="recallify-popover-quote">{memory.selectedText}</div>

      <div className="recallify-popover-label">CATEGORY</div>
      <CategoryPicker categoryId={categoryId} onChange={setCategoryId} />

      <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="recallify-popover-actions">
        <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
        <button className="primary" onClick={() => { onSave(note, categoryId); setEditing(false) }}>Save changes</button>
      </div>
    </div>
  )
}
