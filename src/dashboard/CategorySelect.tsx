import { useState } from 'react'
import { addCategory } from '@/lib/storage'
import type { Category } from '@/lib/types'

interface CategorySelectProps {
  categories: Category[]
  value: string | undefined
  onChange: (categoryId: string | undefined) => void
  onCreated: (category: Category) => void
}

const CREATE_NEW = '__create_new__'

export function CategorySelect({ categories, value, onChange, onCreated }: CategorySelectProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const handleSelect = (val: string) => {
    if (val === CREATE_NEW) {
      setCreating(true)
      return
    }
    onChange(val || undefined)
  }

  const submitNew = async () => {
    const name = newName.trim()
    if (!name) {
      setCreating(false)
      return
    }
    const category = await addCategory(name)
    onCreated(category)
    onChange(category.id)
    setNewName('')
    setCreating(false)
  }

  if (creating) {
    return (
      <input
        autoFocus
        className="category-select-input"
        placeholder="New category name…"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submitNew()
          } else if (e.key === 'Escape') {
            setCreating(false)
            setNewName('')
          }
        }}
        onBlur={() => void submitNew()}
      />
    )
  }

  return (
    <select className="category-select" value={value ?? ''} onChange={(e) => handleSelect(e.target.value)}>
      <option value="">No category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
      <option value={CREATE_NEW}>+ Create new category…</option>
    </select>
  )
}
