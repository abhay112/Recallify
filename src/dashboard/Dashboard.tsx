import { useEffect, useMemo, useState } from 'react'
import {
  deleteCategory,
  deleteMemory,
  getAllMemories,
  getCategories,
  onCategoriesChanged,
  onMemoriesChanged,
  rankCategoriesByUsage,
  updateMemory,
} from '@/lib/storage'
import type { Category, Memory, MemoryMode } from '@/lib/types'
import { Practice } from './Practice'
import { Settings } from './Settings'
import { CategorySelect } from './CategorySelect'

type ModeFilter = 'all' | MemoryMode

export function Dashboard() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [domainFilter, setDomainFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined)
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    getAllMemories().then((list) => setMemories(list.sort((a, b) => b.createdAt - a.createdAt)))
    getCategories().then(setCategories)
    const unsubMemories = onMemoriesChanged((list) => setMemories(list.sort((a, b) => b.createdAt - a.createdAt)))
    const unsubCategories = onCategoriesChanged(setCategories)

    const params = new URLSearchParams(window.location.search)
    const site = params.get('site')
    const category = params.get('category')
    if (site) setDomainFilter(site)
    if (category) setCategoryFilter(category)

    return () => {
      unsubMemories()
      unsubCategories()
    }
  }, [])

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of memories) counts.set(m.domain, (counts.get(m.domain) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [memories])
  const topCategories = useMemo(() => rankCategoriesByUsage(categories, memories), [categories, memories])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memories.filter((m) => {
      if (modeFilter !== 'all' && m.mode !== modeFilter) return false
      if (domainFilter !== 'all' && m.domain !== domainFilter) return false
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'uncategorized' ? m.categoryId : m.categoryId !== categoryFilter) return false
      }
      if (!q) return true
      return (
        m.selectedText.toLowerCase().includes(q) ||
        (m.note ?? '').toLowerCase().includes(q) ||
        m.pageTitle.toLowerCase().includes(q)
      )
    })
  }, [memories, query, modeFilter, domainFilter, categoryFilter])

  const handleDelete = async (id: string) => {
    await deleteMemory(id)
  }

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id)
    setEditValue(memory.note ?? '')
    setEditCategoryId(memory.categoryId)
  }

  const saveEdit = async () => {
    if (!editingId) return
    await updateMemory(editingId, { note: editValue, categoryId: editCategoryId })
    setEditingId(null)
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Memories in it will become uncategorized.')) return
    await deleteCategory(id)
    if (categoryFilter === id) setCategoryFilter('all')
  }

  const hideCount = memories.filter((m) => m.mode === 'hide').length

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-brand">🧠 Recallify Dashboard</div>
        <div className="dash-stats">
          {memories.length} memories · {hideCount} to practice
        </div>
        <button className="settings-btn" onClick={() => setSettingsOpen(true)}>
          ⚙ Appearance
        </button>
        <button className="practice-btn" disabled={hideCount === 0} onClick={() => setPracticeOpen(true)}>
          ▶ Practice recall
        </button>
      </header>

      {domainCounts.length > 0 && (
        <div className="filter-block">
          <div className="filter-block-label">Site</div>
          <div className="category-bar">
            <button
              className={`category-pill ${domainFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDomainFilter('all')}
            >
              All sites ({memories.length})
            </button>
            {domainCounts.map(([domain, count]) => (
              <button
                key={domain}
                className={`category-pill site-pill ${domainFilter === domain ? 'active' : ''}`}
                onClick={() => setDomainFilter(domain)}
              >
                <img className="site-favicon" src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" />
                {domain} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {topCategories.length > 0 && (
        <div className="filter-block">
          <div className="filter-block-label">Category</div>
          <div className="category-bar">
            <button
              className={`category-pill ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All
            </button>
            {topCategories.map((cat) => (
              <span key={cat.id} className="category-pill-wrap">
                <button
                  className={`category-pill ${categoryFilter === cat.id ? 'active' : ''}`}
                  style={categoryFilter === cat.id ? { background: cat.color, borderColor: cat.color, color: '#fff' } : { borderColor: cat.color, color: cat.color }}
                  onClick={() => setCategoryFilter(cat.id)}
                >
                  {cat.name}
                </button>
                <button className="category-pill-remove" title="Delete category" onClick={() => handleDeleteCategory(cat.id)}>✕</button>
              </span>
            ))}
            <button
              className={`category-pill ${categoryFilter === 'uncategorized' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('uncategorized')}
            >
              Uncategorized
            </button>
          </div>
        </div>
      )}

      <div className="filter-block">
        <div className="filter-block-label">Type &amp; search</div>
        <div className="dash-filters">
          <input
            className="search"
            placeholder="Search memories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeFilter)}>
            <option value="all">All types</option>
            <option value="inline">Notes</option>
            <option value="hide">Hidden &amp; recall</option>
          </select>
        </div>
      </div>

      {(domainFilter !== 'all' || categoryFilter !== 'all' || modeFilter !== 'all' || query.trim()) && (
        <div className="active-filters">
          Showing {filtered.length} of {memories.length}
          <button className="link-btn" onClick={() => { setDomainFilter('all'); setCategoryFilter('all'); setModeFilter('all'); setQuery('') }}>
            Clear all filters
          </button>
        </div>
      )}

      {filtered.length === 0 && <div className="dash-empty">No memories found.</div>}

      <div className="memory-grid">
        {filtered.map((m) => {
          const category = m.categoryId ? categoryById.get(m.categoryId) : undefined
          return (
            <div className="memory-card" key={m.id}>
              <div className="card-top">
                <span className={`badge ${m.mode}`}>{m.mode === 'inline' ? 'Note' : 'Hidden'}</span>
                {category && (
                  <span className="category-tag" style={{ background: category.color }}>{category.name}</span>
                )}
                <button className="card-domain" title="Filter by this site" onClick={() => setDomainFilter(m.domain)}>
                  {m.domain}
                </button>
              </div>
              <div className="card-quote">{m.selectedText}</div>

              {editingId === m.id ? (
                <div className="card-edit">
                  <CategorySelect
                    categories={categories}
                    value={editCategoryId}
                    onChange={setEditCategoryId}
                    onCreated={(cat) => setCategories((prev) => [...prev, cat])}
                  />
                  {m.mode === 'inline' && (
                    <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Write your explanation…" />
                  )}
                  <div className="card-edit-actions">
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="primary" onClick={saveEdit}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  {m.mode === 'inline' && (
                    <div className="card-note" onClick={() => startEdit(m)} title="Click to edit">
                      {m.note || <em>(click to add a note)</em>}
                    </div>
                  )}
                  {m.mode === 'hide' && (
                    <div className="card-recall">
                      {m.revealed ? (
                        <span className={m.recallAttempt?.trim().toLowerCase() === m.selectedText.trim().toLowerCase() ? 'correct' : 'incorrect'}>
                          Your answer: {m.recallAttempt || '(empty)'}
                        </span>
                      ) : (
                        <span className="pending">Not attempted yet</span>
                      )}
                      <button className="link-btn" onClick={() => startEdit(m)}>Set category</button>
                    </div>
                  )}
                </>
              )}

              <div className="card-footer">
                <a className="card-page" href={m.url} target="_blank" rel="noreferrer" title={`Open: ${m.pageTitle}`}>
                  {m.pageTitle}
                </a>
                <button className="delete" onClick={() => handleDelete(m.id)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {practiceOpen && (
        <Practice memories={memories.filter((m) => m.mode === 'hide')} onClose={() => setPracticeOpen(false)} />
      )}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
