import { createRoot } from 'react-dom/client'
import { useEffect, useState, useCallback } from 'react'
import { Overlay } from './overlay/Overlay'
import overlayStyles from './content.css?inline'
import { injectPageStyles } from './page-styles'
import { applyInlineMark, applyHideMark, restoreMemoriesOnPage } from './marks'
import { captureCurrentSelection, normalizeUrl, getDomain } from '@/lib/anchor'
import { addMemory, deleteMemory, getMemoriesForUrl, updateMemory } from '@/lib/storage'
import { getSettings, onSettingsChanged } from '@/lib/settings'
import type { ContentToBackgroundMessage, Memory, RecallifySettings, SelectionContext } from '@/lib/types'

function applySettingsToOverlay(root: HTMLElement, settings: RecallifySettings) {
  root.style.setProperty('--recallify-accent', settings.accentColor)
  root.style.setProperty('--recallify-popover-width', `${settings.popoverWidth}px`)
  root.style.setProperty('--recallify-font-size', `${settings.fontSize}px`)
  root.dataset.theme = settings.popoverTheme
}

type OverlayState =
  | { mode: 'idle' }
  | { mode: 'toolbar'; position: { top: number; left: number }; selection: SelectionContext }
  | { mode: 'editor'; position: { top: number; left: number }; selection: SelectionContext }
  | { mode: 'note'; position: { top: number; left: number }; memory: Memory }

function App() {
  const [state, setState] = useState<OverlayState>({ mode: 'idle' })

  const close = useCallback(() => {
    setState({ mode: 'idle' })
  }, [])

  useEffect(() => {
    getSettings().then(injectPageStyles)
    const unsubscribeSettings = onSettingsChanged(injectPageStyles)

    const restoreForCurrentUrl = () => {
      getMemoriesForUrl(normalizeUrl(location.href)).then((memories) => {
        restoreMemoriesOnPage(
          memories,
          (memory) => openNoteViewer(memory, setState),
          (id, patch) => updateMemory(id, patch)
        )
      })
    }

    restoreForCurrentUrl()

    // Single-page apps swap content without a full reload, so watch for URL
    // changes and re-scan the new content for memories to restore.
    let lastUrl = location.href
    const handlePossibleNavigation = () => {
      if (location.href === lastUrl) return
      lastUrl = location.href
      window.setTimeout(restoreForCurrentUrl, 400)
    }
    const originalPushState = history.pushState.bind(history)
    const originalReplaceState = history.replaceState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      originalPushState(...args)
      handlePossibleNavigation()
    }
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      originalReplaceState(...args)
      handlePossibleNavigation()
    }
    window.addEventListener('popstate', handlePossibleNavigation)

    const handleMouseUp = () => {
      window.setTimeout(() => {
        const selection = captureCurrentSelection()
        if (!selection) {
          setState((prev) => (prev.mode === 'toolbar' ? { mode: 'idle' } : prev))
          return
        }
        const rect = selection.range.getBoundingClientRect()
        setState({
          mode: 'toolbar',
          position: { top: rect.top, left: rect.left + rect.width / 2 },
          selection,
        })
      }, 0)
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest?.('[data-recallify-ignore]')) return
      setState((prev) => (prev.mode === 'toolbar' ? { mode: 'idle' } : prev))
    }

    const handleMessage = (message: { type?: string }) => {
      if (message?.type === 'recallify:open-inline-from-menu' || message?.type === 'recallify:open-hide-from-menu') {
        const selection = captureCurrentSelection()
        if (!selection) return
        const rect = selection.range.getBoundingClientRect()
        const position = { top: rect.top, left: rect.left + rect.width / 2 }
        if (message.type === 'recallify:open-inline-from-menu') {
          setState({ mode: 'editor', position, selection })
        } else {
          void handleHide(selection)
        }
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('popstate', handlePossibleNavigation)
      chrome.runtime.onMessage.removeListener(handleMessage)
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      unsubscribeSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemember = (selection: SelectionContext) => {
    const rect = selection.range.getBoundingClientRect()
    setState({ mode: 'editor', position: { top: rect.top, left: rect.left + rect.width / 2 }, selection })
  }

  const handleHide = async (selection: SelectionContext) => {
    const memory = await addMemory({
      url: location.href,
      urlNoHash: normalizeUrl(location.href),
      domain: getDomain(location.href),
      pageTitle: document.title,
      mode: 'hide',
      selectedText: selection.selectedText,
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
    })
    try {
      applyHideMark(selection.range, memory, (patch) => updateMemory(memory.id, patch))
    } catch {
      await deleteMemory(memory.id)
    }
    close()
  }

  const handleSaveNote = async (note: string, categoryId: string | undefined, starred: boolean) => {
    if (state.mode !== 'editor') return
    const { selection } = state
    const memory = await addMemory({
      url: location.href,
      urlNoHash: normalizeUrl(location.href),
      domain: getDomain(location.href),
      pageTitle: document.title,
      mode: 'inline',
      selectedText: selection.selectedText,
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
      note,
      categoryId,
      starred,
    })
    try {
      applyInlineMark(selection.range, memory, (m) => openNoteViewer(m, setState))
    } catch {
      await deleteMemory(memory.id)
    }
    close()
  }

  const handleUpdateNote = async (memory: Memory, note: string, categoryId: string | undefined, starred: boolean) => {
    await updateMemory(memory.id, { note, categoryId, starred })
    close()
  }

  const handleStarChange = (memory: Memory, starred: boolean) => {
    void updateMemory(memory.id, { starred })
  }

  const handleOpenDashboard = () => {
    const message: ContentToBackgroundMessage = { type: 'recallify:open-dashboard' }
    void chrome.runtime.sendMessage(message)
  }

  const handleDeleteNote = async (memory: Memory) => {
    await deleteMemory(memory.id)
    document.querySelector(`[data-recallify-id="${memory.id}"]`)?.remove()
    close()
  }

  return (
    <Overlay
      state={state}
      onRemember={handleRemember}
      onHide={(selection) => void handleHide(selection)}
      onSaveNote={(note, categoryId, starred) => void handleSaveNote(note, categoryId, starred)}
      onUpdateNote={(memory, note, categoryId, starred) => void handleUpdateNote(memory, note, categoryId, starred)}
      onStarChange={handleStarChange}
      onDeleteNote={(memory) => void handleDeleteNote(memory)}
      onOpenDashboard={handleOpenDashboard}
      onClose={close}
    />
  )
}

function openNoteViewer(memory: Memory, setState: (state: OverlayState) => void) {
  const el = document.querySelector(`[data-recallify-id="${memory.id}"]`)
  const rect = el?.getBoundingClientRect() ?? { top: 0, left: 0, width: 0 }
  setState({ mode: 'note', position: { top: rect.top, left: rect.left + rect.width / 2 }, memory })
}

function mount() {
  const host = document.createElement('div')
  host.id = 'recallify-host'
  host.setAttribute('data-recallify-ignore', 'true')
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = overlayStyles
  shadow.appendChild(styleEl)

  const container = document.createElement('div')
  shadow.appendChild(container)

  getSettings().then((settings) => applySettingsToOverlay(container, settings))
  onSettingsChanged((settings) => applySettingsToOverlay(container, settings))

  createRoot(container).render(<App />)
}

mount()
