import { useEffect, useState } from 'react'
import type { Memory, SelectionContext } from '@/lib/types'
import { CategoryPicker } from './CategoryPicker'
import { EditorBody, ReadTools } from './NoteTools'
import { Popover } from './Popover'

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
  onSaveNote: (note: string, categoryId: string | undefined, starred: boolean) => void
  onUpdateNote: (memory: Memory, note: string, categoryId: string | undefined, starred: boolean) => void
  onStarChange: (memory: Memory, starred: boolean) => void
  onDeleteNote: (memory: Memory) => void
  onOpenDashboard: () => void
  onClose: () => void
}

export function Overlay({
  state,
  onRemember,
  onHide,
  onSaveNote,
  onUpdateNote,
  onStarChange,
  onDeleteNote,
  onOpenDashboard,
  onClose,
}: OverlayProps) {
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
          onOpenDashboard={onOpenDashboard}
        />
      )}
      {state.mode === 'note' && (
        <NoteViewer
          // Remount per memory so a different note doesn't inherit the last one's edits or placement.
          key={state.memory.id}
          position={state.position}
          memory={state.memory}
          onSave={(note, categoryId, starred) => onUpdateNote(state.memory, note, categoryId, starred)}
          onStarChange={(starred) => onStarChange(state.memory, starred)}
          onDelete={() => onDeleteNote(state.memory)}
          onOpenDashboard={onOpenDashboard}
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
  onOpenDashboard,
}: {
  position: Position
  selectedText: string
  onSave: (note: string, categoryId: string | undefined, starred: boolean) => void
  onCancel: () => void
  onOpenDashboard: () => void
}) {
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const save = () => {
    if (note.trim()) onSave(note, categoryId, starred)
  }

  return (
    <Popover position={position}>
      <div className="recallify-popover-label">SELECTED TEXT</div>
      <div className="recallify-popover-quote">{selectedText}</div>

      <div className="recallify-popover-label">CATEGORY</div>
      <CategoryPicker categoryId={categoryId} onChange={setCategoryId} />

      <EditorBody
        value={note}
        onChange={setNote}
        source={{ selectedText, pageTitle: document.title, url: location.href }}
        starred={starred}
        onStarChange={setStarred}
        onOpenDashboard={onOpenDashboard}
        onSubmit={save}
        placeholder="Write your explanation…"
      />
      <div className="recallify-popover-actions">
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={save} disabled={!note.trim()}>Save memory</button>
      </div>
    </Popover>
  )
}

function NoteViewer({
  position,
  memory,
  onSave,
  onStarChange,
  onDelete,
  onOpenDashboard,
  onClose,
}: {
  position: Position
  memory: Memory
  onSave: (note: string, categoryId: string | undefined, starred: boolean) => void
  onStarChange: (starred: boolean) => void
  onDelete: () => void
  onOpenDashboard: () => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(memory.note ?? '')
  const [categoryId, setCategoryId] = useState<string | undefined>(memory.categoryId)
  const [starred, setStarred] = useState(memory.starred ?? false)

  const source = { selectedText: memory.selectedText, pageTitle: memory.pageTitle, url: memory.url }
  // Stars save straight away, in either mode, rather than waiting for "Save changes".
  const changeStar = (next: boolean) => {
    setStarred(next)
    onStarChange(next)
  }
  const saveChanges = () => {
    onSave(note, categoryId, starred)
    setEditing(false)
  }

  if (!editing) {
    return (
      <Popover position={position}>
        <div className="recallify-popover-label">YOUR NOTE</div>
        <div className="recallify-popover-note recallify-popover-grow">{memory.note || '(no note saved)'}</div>
        <ReadTools
          source={source}
          note={memory.note ?? ''}
          starred={starred}
          onStarChange={changeStar}
          onOpenDashboard={onOpenDashboard}
        />
        <div className="recallify-popover-actions">
          <button className="danger" onClick={onDelete}>Delete</button>
          <button className="secondary" onClick={() => setEditing(true)}>Edit</button>
          <button className="primary" onClick={onClose}>Close</button>
        </div>
      </Popover>
    )
  }

  return (
    <Popover position={position}>
      <div className="recallify-popover-label">SELECTED TEXT</div>
      <div className="recallify-popover-quote">{memory.selectedText}</div>

      <div className="recallify-popover-label">CATEGORY</div>
      <CategoryPicker categoryId={categoryId} onChange={setCategoryId} />

      <EditorBody
        value={note}
        onChange={setNote}
        source={source}
        starred={starred}
        onStarChange={changeStar}
        onOpenDashboard={onOpenDashboard}
        onSubmit={saveChanges}
      />
      <div className="recallify-popover-actions">
        <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
        <button className="primary" onClick={saveChanges}>Save changes</button>
      </div>
    </Popover>
  )
}
