import { useEffect, useState } from 'react'
import { getMemoriesForUrl, deleteMemory } from '@/lib/storage'
import { normalizeUrl, getDomain } from '@/lib/anchor'
import type { Memory } from '@/lib/types'

export function Popup() {
  const [memories, setMemories] = useState<Memory[] | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [domain, setDomain] = useState('')

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.url) {
        setMemories([])
        return
      }
      setPageTitle(tab.title ?? '')
      setDomain(getDomain(tab.url))
      const list = await getMemoriesForUrl(normalizeUrl(tab.url))
      setMemories(list.sort((a, b) => b.createdAt - a.createdAt))
    })
  }, [])

  const handleDelete = async (id: string) => {
    await deleteMemory(id)
    setMemories((prev) => prev?.filter((m) => m.id !== id) ?? null)
  }

  const openDashboard = (params?: string) => {
    const url = chrome.runtime.getURL('src/dashboard/index.html') + (params ? `?${params}` : '')
    chrome.tabs.create({ url })
  }

  return (
    <div className="popup">
      <header>
        <div className="brand">🧠 Recallify</div>
        <button className="link" onClick={() => openDashboard()}>Open dashboard →</button>
      </header>

      <div className="page-title" title={pageTitle}>{pageTitle || 'This page'}</div>
      {domain && (
        <button className="site-filter-link" onClick={() => openDashboard(`site=${encodeURIComponent(domain)}`)}>
          View all memories from {domain} →
        </button>
      )}

      {memories === null && <div className="empty">Loading…</div>}
      {memories !== null && memories.length === 0 && (
        <div className="empty">
          No memories on this page yet.
          <br />
          Select any text to get started.
        </div>
      )}

      <ul className="memory-list">
        {memories?.map((m) => (
          <li key={m.id}>
            <span className={`badge ${m.mode}`}>{m.mode === 'inline' ? 'Note' : 'Hidden'}</span>
            <div className="memory-text">
              <div className="selected">{m.selectedText}</div>
              {m.mode === 'inline' && m.note && <div className="note">{m.note}</div>}
            </div>
            <button className="delete" title="Delete" onClick={() => handleDelete(m.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
