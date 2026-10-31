import type { Category, Memory, NewMemoryInput } from './types'

const INDEX_KEY = 'recallify:mem-index'
/** Memories too large for a sync-storage item always live here, regardless of the sync toggle. */
const LOCAL_ONLY_INDEX_KEY = 'recallify:mem-local-only-index'
const CATEGORIES_KEY = 'recallify:categories'
const SYNC_FLAG_KEY = 'recallify:sync-enabled'

const CATEGORY_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2']

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function memKey(id: string): string {
  return `recallify:mem:${id}`
}

export async function isSyncEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(SYNC_FLAG_KEY)
  return Boolean(result[SYNC_FLAG_KEY])
}

function activeArea(sync: boolean): chrome.storage.StorageArea {
  return sync ? chrome.storage.sync : chrome.storage.local
}

async function getIndex(area: chrome.storage.StorageArea, key: string): Promise<string[]> {
  const result = await area.get(key)
  return (result[key] as string[] | undefined) ?? []
}

async function addToIndex(area: chrome.storage.StorageArea, key: string, id: string): Promise<void> {
  const ids = await getIndex(area, key)
  if (!ids.includes(id)) await area.set({ [key]: [...ids, id] })
}

async function removeFromIndex(area: chrome.storage.StorageArea, key: string, id: string): Promise<void> {
  const ids = await getIndex(area, key)
  const next = ids.filter((existing) => existing !== id)
  if (next.length !== ids.length) await area.set({ [key]: next })
}

/**
 * Writes a memory to whichever area is active (local or sync). If it's too big
 * for a single sync-storage item, it's kept local-only instead of being lost —
 * it just won't follow the user to another device.
 */
async function writeOne(memory: Memory): Promise<void> {
  const sync = await isSyncEnabled()
  const primary = activeArea(sync)
  try {
    await primary.set({ [memKey(memory.id)]: memory })
    await addToIndex(primary, INDEX_KEY, memory.id)
    if (sync) await removeFromIndex(chrome.storage.local, LOCAL_ONLY_INDEX_KEY, memory.id)
  } catch (err) {
    if (!sync) throw err
    // Likely QUOTA_BYTES_PER_ITEM — this note is too long to sync. Keep it locally.
    await chrome.storage.local.set({ [memKey(memory.id)]: memory })
    await addToIndex(chrome.storage.local, LOCAL_ONLY_INDEX_KEY, memory.id)
  }
}

async function readAll(): Promise<Memory[]> {
  const sync = await isSyncEnabled()
  const primary = activeArea(sync)
  const primaryIds = await getIndex(primary, INDEX_KEY)
  const localOnlyIds = await getIndex(chrome.storage.local, LOCAL_ONLY_INDEX_KEY)

  const results: Memory[] = []
  if (primaryIds.length) {
    const fetched = await primary.get(primaryIds.map(memKey))
    for (const id of primaryIds) {
      const memory = fetched[memKey(id)] as Memory | undefined
      if (memory) results.push(memory)
    }
  }
  if (localOnlyIds.length) {
    const fetched = await chrome.storage.local.get(localOnlyIds.map(memKey))
    for (const id of localOnlyIds) {
      if (results.some((m) => m.id === id)) continue
      const memory = fetched[memKey(id)] as Memory | undefined
      if (memory) results.push(memory)
    }
  }
  return results
}

export async function getAllMemories(): Promise<Memory[]> {
  return readAll()
}

export async function getMemoriesForUrl(urlNoHash: string): Promise<Memory[]> {
  const all = await readAll()
  return all.filter((m) => m.urlNoHash === urlNoHash)
}

export async function getMemoriesForDomain(domain: string): Promise<Memory[]> {
  const all = await readAll()
  return all.filter((m) => m.domain === domain)
}

export async function addMemory(input: NewMemoryInput): Promise<Memory> {
  const now = Date.now()
  const memory: Memory = { ...input, id: uid(), createdAt: now, updatedAt: now }
  await writeOne(memory)
  return memory
}

export async function updateMemory(id: string, patch: Partial<Memory>): Promise<Memory | null> {
  const existing = (await readAll()).find((m) => m.id === id)
  if (!existing) return null
  const updated: Memory = { ...existing, ...patch, updatedAt: Date.now() }
  await writeOne(updated)
  return updated
}

export async function deleteMemory(id: string): Promise<void> {
  const key = memKey(id)
  // Local must succeed; sync is best-effort (it can throw if sync storage is
  // unavailable), so a sync hiccup should never block deleting the local copy.
  await Promise.all([
    chrome.storage.local.remove(key),
    removeFromIndex(chrome.storage.local, INDEX_KEY, id),
    removeFromIndex(chrome.storage.local, LOCAL_ONLY_INDEX_KEY, id),
  ])
  await Promise.allSettled([chrome.storage.sync.remove(key), removeFromIndex(chrome.storage.sync, INDEX_KEY, id)])
}

export function onMemoriesChanged(callback: (memories: Memory[]) => void): () => void {
  let cancelled = false
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' && area !== 'sync') return
    const relevant = Object.keys(changes).some((k) => k.startsWith('recallify:mem'))
    if (!relevant) return
    readAll().then((list) => {
      if (!cancelled) callback(list)
    })
  }
  chrome.storage.onChanged.addListener(listener)
  return () => {
    cancelled = true
    chrome.storage.onChanged.removeListener(listener)
  }
}

export interface SyncMigrationResult {
  moved: number
  keptLocalOnly: number
}

/** Enables sync and copies existing local memories into chrome.storage.sync (best-effort). */
export async function enableSync(): Promise<SyncMigrationResult> {
  const localIds = await getIndex(chrome.storage.local, INDEX_KEY)
  let moved = 0
  let keptLocalOnly = 0

  if (localIds.length) {
    const fetched = await chrome.storage.local.get(localIds.map(memKey))
    for (const id of localIds) {
      const memory = fetched[memKey(id)] as Memory | undefined
      if (!memory) continue
      try {
        await chrome.storage.sync.set({ [memKey(id)]: memory })
        await addToIndex(chrome.storage.sync, INDEX_KEY, id)
        await chrome.storage.local.remove(memKey(id))
        await removeFromIndex(chrome.storage.local, INDEX_KEY, id)
        moved++
      } catch {
        // Too big for sync — leave it where it is, just reclassify as local-only.
        await addToIndex(chrome.storage.local, LOCAL_ONLY_INDEX_KEY, id)
        await removeFromIndex(chrome.storage.local, INDEX_KEY, id)
        keptLocalOnly++
      }
    }
  }

  await chrome.storage.local.set({ [SYNC_FLAG_KEY]: true })
  return { moved, keptLocalOnly }
}

/** Disables sync and copies any synced memories back into local storage so nothing disappears from this device. */
export async function disableSync(): Promise<void> {
  const syncIds = await getIndex(chrome.storage.sync, INDEX_KEY)
  if (syncIds.length) {
    const fetched = await chrome.storage.sync.get(syncIds.map(memKey))
    for (const id of syncIds) {
      const memory = fetched[memKey(id)] as Memory | undefined
      if (!memory) continue
      await chrome.storage.local.set({ [memKey(id)]: memory })
      await addToIndex(chrome.storage.local, INDEX_KEY, id)
      await chrome.storage.sync.remove(memKey(id))
    }
    await chrome.storage.sync.set({ [INDEX_KEY]: [] })
  }
  await chrome.storage.local.set({ [SYNC_FLAG_KEY]: false })
}

export function onSyncFlagChanged(callback: (enabled: boolean) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !(SYNC_FLAG_KEY in changes)) return
    callback(Boolean(changes[SYNC_FLAG_KEY].newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

async function readCategories(): Promise<Category[]> {
  const result = await chrome.storage.local.get(CATEGORIES_KEY)
  return (result[CATEGORIES_KEY] as Category[] | undefined) ?? []
}

async function writeCategories(categories: Category[]): Promise<void> {
  await chrome.storage.local.set({ [CATEGORIES_KEY]: categories })
}

export async function getCategories(): Promise<Category[]> {
  return readCategories()
}

export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim()
  const all = await readCategories()
  const existing = all.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing
  const category: Category = {
    id: uid(),
    name: trimmed,
    color: CATEGORY_COLORS[all.length % CATEGORY_COLORS.length],
    createdAt: Date.now(),
  }
  all.push(category)
  await writeCategories(all)
  return category
}

export async function deleteCategory(id: string): Promise<void> {
  const all = await readCategories()
  await writeCategories(all.filter((c) => c.id !== id))
  const memories = await readAll()
  await Promise.all(
    memories.filter((m) => m.categoryId === id).map((m) => writeOne({ ...m, categoryId: undefined }))
  )
}

export function onCategoriesChanged(callback: (categories: Category[]) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !(CATEGORIES_KEY in changes)) return
    callback((changes[CATEGORIES_KEY].newValue as Category[] | undefined) ?? [])
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

/** Category ids ranked by how many memories use them, most-used first. */
export function rankCategoriesByUsage(categories: Category[], memories: Memory[]): Category[] {
  const counts = new Map<string, number>()
  for (const m of memories) {
    if (!m.categoryId) continue
    counts.set(m.categoryId, (counts.get(m.categoryId) ?? 0) + 1)
  }
  return [...categories].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
}
