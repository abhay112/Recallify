import { useEffect, useRef, useState } from 'react'
import { addCategory, getCategories, rankCategoriesByUsage, getAllMemories } from '@/lib/storage'
import type { Category } from '@/lib/types'

interface CategoryPickerProps {
  categoryId: string | undefined
  onChange: (categoryId: string | undefined) => void
}

export function CategoryPicker({ categoryId, onChange }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getCategories(), getAllMemories()]).then(([cats, memories]) => {
      setCategories(rankCategoriesByUsage(cats, memories).slice(0, 6))
    })
  }, [])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const createCategory = async () => {
    const name = newName.trim()
    if (!name) {
      setCreating(false)
      return
    }
    const category = await addCategory(name)
    setCategories((prev) => (prev.some((c) => c.id === category.id) ? prev : [category, ...prev]))
    onChange(category.id)
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="recallify-category-picker">
      <button
        type="button"
        className={`recallify-category-chip ${!categoryId ? 'active' : ''}`}
        onClick={() => onChange(undefined)}
      >
        No category
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`recallify-category-chip ${categoryId === cat.id ? 'active' : ''}`}
          style={categoryId === cat.id ? { background: cat.color, borderColor: cat.color, color: '#fff' } : { borderColor: cat.color, color: cat.color }}
          onClick={() => onChange(cat.id)}
        >
          {cat.name}
        </button>
      ))}
      {creating ? (
        <input
          ref={inputRef}
          className="recallify-category-input"
          placeholder="Category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void createCategory()
            } else if (e.key === 'Escape') {
              setCreating(false)
              setNewName('')
            }
          }}
          onBlur={() => void createCategory()}
        />
      ) : (
        <button type="button" className="recallify-category-chip add" onClick={() => setCreating(true)}>
          + New
        </button>
      )}
    </div>
  )
}
