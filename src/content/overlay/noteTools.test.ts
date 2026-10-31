import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, readClipboardText } from './clipboard'
import { createHistory, edit, redo, undo } from './noteHistory'
import { countWords, cycleCase, fileNameFor, formatWithSource } from './noteText'
import { toggleSpeech } from './speech'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('noteHistory', () => {
  it('undoes and redoes edits', () => {
    let h = createHistory('')
    h = edit(h, 'a', 1000, 0)
    h = edit(h, 'ab', 2000, 0)

    h = undo(h)
    expect(h.present).toBe('a')
    h = undo(h)
    expect(h.present).toBe('')
    h = redo(h)
    expect(h.present).toBe('a')
    h = redo(h)
    expect(h.present).toBe('ab')
  })

  it('ignores undo/redo when there is nothing to do', () => {
    const h = createHistory('x')
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it('folds quick keystrokes into one undo step, but not slow ones', () => {
    let h = createHistory('')
    h = edit(h, 'h', 1000, 600)
    h = edit(h, 'he', 1200, 600)
    h = edit(h, 'hey', 1400, 600)
    h = edit(h, 'hey you', 5000, 600)

    expect(h.past).toEqual(['', 'hey'])
    expect(undo(h).present).toBe('hey')
  })

  it('starts a new undo step after an undo', () => {
    let h = createHistory('')
    h = edit(h, 'abc', 1000, 600)
    h = undo(h)
    h = edit(h, 'x', 1100, 600)

    expect(h.past).toEqual([''])
    expect(h.present).toBe('x')
  })

  it('drops the redo stack when you edit after undoing', () => {
    let h = createHistory('')
    h = edit(h, 'a', 1000, 0)
    h = undo(h)
    h = edit(h, 'b', 2000, 0)

    expect(h.future).toEqual([])
  })

  it('does nothing for an edit that changes nothing', () => {
    const h = createHistory('same')
    expect(edit(h, 'same', 1000, 0)).toBe(h)
  })
})

describe('noteText', () => {
  it('counts words', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('one')).toBe(1)
    expect(countWords(' two\nwords  here ')).toBe(3)
  })

  it('cycles UPPER, lower, Title and back', () => {
    expect(cycleCase('hello world')).toBe('Hello World')
    expect(cycleCase('Hello World')).toBe('HELLO WORLD')
    expect(cycleCase('HELLO WORLD')).toBe('hello world')
  })

  it('title-cases without capitalising after apostrophes', () => {
    expect(cycleCase("don't stop-me now")).toBe("Don't Stop-Me Now")
  })

  it('leaves text without letters alone', () => {
    expect(cycleCase('123 !?')).toBe('123 !?')
  })

  it('formats a note with its source', () => {
    const text = formatWithSource({
      selectedText: 'Elements are cheap',
      note: ' Plain objects. ',
      pageTitle: 'React docs',
      url: 'https://react.dev/x',
    })

    expect(text).toBe('“Elements are cheap”\n\n— React docs\nhttps://react.dev/x\n\nPlain objects.')
  })

  it('omits the parts that are missing', () => {
    expect(formatWithSource({ selectedText: 'q', note: '', pageTitle: '', url: '' })).toBe('“q”')
  })

  it('makes a safe file name from the page title', () => {
    expect(fileNameFor('React: Rendering Elements — React')).toBe('recallify-react-rendering-elements-react.txt')
    expect(fileNameFor('???')).toBe('recallify-note.txt')
    expect(fileNameFor('a'.repeat(100)).length).toBeLessThanOrEqual('recallify-.txt'.length + 40)
  })
})

describe('copyText', () => {
  it('uses the async clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    expect(await copyText('hi')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hi')
  })

  it('falls back to execCommand when there is no async clipboard (http pages)', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })

    expect(await copyText('hi')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports failure when nothing works', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    Object.defineProperty(document, 'execCommand', { value: () => { throw new Error('no') }, configurable: true })

    expect(await copyText('hi')).toBe(false)
  })
})

describe('readClipboardText', () => {
  it('returns the clipboard text', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn().mockResolvedValue('pasted') } })
    expect(await readClipboardText()).toBe('pasted')
  })

  it('returns null when reading is blocked or unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn().mockRejectedValue(new Error('denied')) } })
    expect(await readClipboardText()).toBeNull()
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    expect(await readClipboardText()).toBeNull()
  })
})

describe('toggleSpeech', () => {
  const voice = (name: string, lang: string, localService: boolean) => ({ name, lang, localService }) as SpeechSynthesisVoice

  function stubSpeech(voices: SpeechSynthesisVoice[], speaking = false) {
    const synth = { speaking, cancel: vi.fn(), speak: vi.fn(), getVoices: () => voices }
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} voice?: unknown; lang = '' })
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    return synth
  }

  it('speaks with an on-device voice that matches the browser language', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'en-US' })
    const synth = stubSpeech([voice('Remote', 'en-US', false), voice('De', 'de-DE', true), voice('Local', 'en-GB', true)])

    expect(toggleSpeech('hello')).toBe('speaking')
    expect(synth.speak.mock.calls[0][0].voice.name).toBe('Local')
  })

  it('refuses to use a voice that sends text to a server', () => {
    const synth = stubSpeech([voice('Remote', 'en-US', false)])

    expect(toggleSpeech('hello')).toBe('no-voice')
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('stops when already speaking', () => {
    const synth = stubSpeech([voice('Local', 'en-US', true)], true)

    expect(toggleSpeech('hello')).toBe('stopped')
    expect(synth.cancel).toHaveBeenCalled()
  })
})
