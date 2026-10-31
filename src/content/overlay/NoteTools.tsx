import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from 'react'
import { updateSettings } from '@/lib/settings'
import { copyText, readClipboardText } from './clipboard'
import { downloadText } from './download'
import { Icon, type IconName } from './icons'
import { createHistory, edit, redo, undo } from './noteHistory'
import { countWords, cycleCase, fileNameFor, formatWithSource } from './noteText'
import { toggleSpeech } from './speech'
import { useSettings } from './useSettings'

const MIN_FONT = 12
const MAX_FONT = 20
/** Typing faster than this between keystrokes counts as one undo step. */
const TYPING_STEP_MS = 600

interface Source {
  selectedText: string
  pageTitle: string
  url: string
}

function useStatus() {
  const [status, setStatus] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const say = useCallback((message: string) => {
    setStatus(message)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus(''), 2200)
  }, [])
  return [status, say] as const
}

function useReadAloud(say: (message: string) => void) {
  const [speaking, setSpeaking] = useState(false)

  // The browser doesn't tell us when speech ends on its own, so check while it runs.
  useEffect(() => {
    if (!speaking) return
    const id = window.setInterval(() => {
      if (!window.speechSynthesis?.speaking) setSpeaking(false)
    }, 400)
    return () => window.clearInterval(id)
  }, [speaking])
  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const toggle = (text: string) => {
    const result = toggleSpeech(text)
    setSpeaking(result === 'speaking')
    if (result === 'no-voice') say('No on-device voice available')
    if (result === 'unsupported') say('Reading aloud isn’t supported here')
  }
  return { speaking, toggle }
}

interface ToolProps {
  label: string
  icon?: IconName
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
  children?: ReactNode
}

function Tool({ label, icon, onClick, disabled, pressed, children }: ToolProps) {
  return (
    <button
      type="button"
      className={`recallify-tool${pressed ? ' active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      // Keep focus and the text selection in the textarea while using the tools.
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} /> : children}
    </button>
  )
}

const Divider = () => <span className="recallify-tool-divider" aria-hidden="true" />

const SHORTCUTS: [string, string][] = [
  ['Ctrl/⌘ + Enter', 'Save'],
  ['Esc', 'Cancel'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z', 'Redo'],
  ['Drag the top bar', 'Move this window'],
  ['Drag the corner', 'Resize this window'],
]

/** Buttons shared by the editing and read-only toolbars. */
function SharedTools({
  source,
  note,
  starred,
  onStarChange,
  onOpenDashboard,
  say,
  speakText,
  showHelp,
  onToggleHelp,
}: {
  source: Source
  note: string
  starred: boolean
  onStarChange: (starred: boolean) => void
  onOpenDashboard: () => void
  say: (message: string) => void
  speakText: () => string
  showHelp: boolean
  onToggleHelp: () => void
}) {
  const settings = useSettings()
  const { speaking, toggle } = useReadAloud(say)
  const dark = settings.popoverTheme === 'dark'
  const full = () => formatWithSource({ ...source, note })

  return (
    <>
      <Tool label={speaking ? 'Stop reading' : 'Read aloud'} icon="speak" pressed={speaking} onClick={() => toggle(speakText())} />
      <Tool
        label="Copy with source"
        icon="share"
        onClick={async () => say((await copyText(full())) ? 'Copied with source' : 'Couldn’t copy')}
      />
      <Tool
        label="Download as .txt"
        icon="download"
        onClick={() => {
          downloadText(fileNameFor(source.pageTitle), full())
          say('Downloaded')
        }}
      />
      <Tool label={starred ? 'Remove star' : 'Star this memory'} icon="star" pressed={starred} onClick={() => onStarChange(!starred)} />
      <Divider />
      <Tool
        label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        icon={dark ? 'sun' : 'moon'}
        onClick={() => void updateSettings({ popoverTheme: dark ? 'light' : 'dark' })}
      />
      <Tool label="Shortcuts" icon="keyboard" pressed={showHelp} onClick={onToggleHelp} />
      <Tool label="Open dashboard" icon="open" onClick={onOpenDashboard} />
    </>
  )
}

function Help() {
  return (
    <dl className="recallify-tools-help">
      {SHORTCUTS.map(([keys, action]) => (
        <div key={keys}>
          <dt>{keys}</dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  )
}

interface EditorBodyProps {
  value: string
  onChange: (value: string) => void
  source: Source
  starred: boolean
  onStarChange: (starred: boolean) => void
  onOpenDashboard: () => void
  onSubmit: () => void
  placeholder?: string
}

/** The note textarea with its editing toolbar. */
export function EditorBody({
  value,
  onChange,
  source,
  starred,
  onStarChange,
  onOpenDashboard,
  onSubmit,
  placeholder,
}: EditorBodyProps) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<{ start: number; end: number } | null>(null)
  const [history, setHistory] = useState(() => createHistory(value))
  const [spellcheck, setSpellcheck] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [status, say] = useStatus()
  const settings = useSettings()

  // After a tool rewrites the text, put the cursor or selection back where it belongs.
  useEffect(() => {
    const el = textarea.current
    if (!pending.current || !el) return
    el.focus()
    el.setSelectionRange(pending.current.start, pending.current.end)
    pending.current = null
  }, [value])

  const commit = (next: string, coalesceMs = 0) => {
    setHistory((h) => edit(h, next, Date.now(), coalesceMs))
    onChange(next)
  }

  /** The selected range, or the whole note when nothing is selected. */
  const target = () => {
    const el = textarea.current
    const start = el?.selectionStart ?? 0
    const end = el?.selectionEnd ?? 0
    return start === end ? { start: 0, end: value.length } : { start, end }
  }

  const replace = (start: number, end: number, text: string, select = false) => {
    pending.current = { start: select ? start : start + text.length, end: start + text.length }
    commit(value.slice(0, start) + text + value.slice(end))
  }

  const undoStep = () => {
    const next = undo(history)
    if (next === history) return
    setHistory(next)
    onChange(next.present)
  }
  const redoStep = () => {
    const next = redo(history)
    if (next === history) return
    setHistory(next)
    onChange(next.present)
  }

  const copy = async (cut: boolean) => {
    const { start, end } = target()
    const text = value.slice(start, end)
    if (!text) return
    if (!(await copyText(text))) return say('Couldn’t copy')
    if (cut) replace(start, end, '')
    say(cut ? 'Cut' : 'Copied')
  }

  const paste = async () => {
    const text = await readClipboardText()
    if (text === null) return say('Press Ctrl/⌘ + V to paste')
    const el = textarea.current
    replace(el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, text)
  }

  const changeFontSize = (delta: number) => {
    const size = Math.min(MAX_FONT, Math.max(MIN_FONT, settings.fontSize + delta))
    if (size !== settings.fontSize) void updateSettings({ fontSize: size })
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return
    const key = event.key.toLowerCase()
    if (key === 'enter') {
      event.preventDefault()
      onSubmit()
    } else if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) redoStep()
      else undoStep()
    } else if (key === 'y') {
      event.preventDefault()
      redoStep()
    }
  }

  const empty = value.length === 0

  return (
    <>
      <textarea
        ref={textarea}
        className="recallify-popover-grow"
        autoFocus
        spellCheck={spellcheck}
        placeholder={placeholder}
        value={value}
        onChange={(event) => commit(event.target.value, TYPING_STEP_MS)}
        onKeyDown={onKeyDown}
      />

      <div className="recallify-tools" role="toolbar" aria-label="Note tools">
        <Tool label="Cut" icon="cut" disabled={empty} onClick={() => void copy(true)} />
        <Tool label="Copy" icon="copy" disabled={empty} onClick={() => void copy(false)} />
        <Tool label="Paste" icon="paste" onClick={() => void paste()} />
        <Tool label="Select all" icon="selectAll" disabled={empty} onClick={() => textarea.current?.select()} />
        <Tool
          label="Clear"
          icon="trash"
          disabled={empty}
          onClick={() => {
            commit('')
            say('Cleared — press undo to bring it back')
          }}
        />
        <Divider />
        <Tool label="Undo" icon="undo" disabled={history.past.length === 0} onClick={undoStep} />
        <Tool label="Redo" icon="redo" disabled={history.future.length === 0} onClick={redoStep} />
        <Divider />
        <Tool label="Check spelling" icon="spell" pressed={spellcheck} onClick={() => setSpellcheck((on) => !on)} />
        <Tool label="Smaller text" disabled={settings.fontSize <= MIN_FONT} onClick={() => changeFontSize(-1)}>
          A−
        </Tool>
        <Tool label="Larger text" disabled={settings.fontSize >= MAX_FONT} onClick={() => changeFontSize(1)}>
          A+
        </Tool>
        <Tool
          label="Change case"
          disabled={empty}
          onClick={() => {
            const { start, end } = target()
            replace(start, end, cycleCase(value.slice(start, end)), true)
          }}
        >
          Aa
        </Tool>
        <Divider />
        <SharedTools
          source={source}
          note={value}
          starred={starred}
          onStarChange={onStarChange}
          onOpenDashboard={onOpenDashboard}
          say={say}
          speakText={() => {
            const { start, end } = target()
            return value.slice(start, end) || source.selectedText
          }}
          showHelp={showHelp}
          onToggleHelp={() => setShowHelp((on) => !on)}
        />
      </div>

      {showHelp && <Help />}
      <div className="recallify-tools-status" aria-live="polite">
        {status || `${countWords(value)} words · ${value.length} characters`}
      </div>
    </>
  )
}

interface ReadToolsProps {
  source: Source
  note: string
  starred: boolean
  onStarChange: (starred: boolean) => void
  onOpenDashboard: () => void
}

/** A smaller toolbar for reading a saved note. */
export function ReadTools({ source, note, starred, onStarChange, onOpenDashboard }: ReadToolsProps) {
  const [showHelp, setShowHelp] = useState(false)
  const [status, say] = useStatus()

  return (
    <>
      <div className="recallify-tools" role="toolbar" aria-label="Note tools">
        <SharedTools
          source={source}
          note={note}
          starred={starred}
          onStarChange={onStarChange}
          onOpenDashboard={onOpenDashboard}
          say={say}
          speakText={() => note || source.selectedText}
          showHelp={showHelp}
          onToggleHelp={() => setShowHelp((on) => !on)}
        />
      </div>
      {showHelp && <Help />}
      <div className="recallify-tools-status" aria-live="polite">
        {status || `${countWords(note)} words`}
      </div>
    </>
  )
}
