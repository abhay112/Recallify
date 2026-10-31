export type MemoryMode = 'inline' | 'hide'

export interface Category {
  id: string
  name: string
  color: string
  createdAt: number
}

export interface Memory {
  id: string
  url: string
  urlNoHash: string
  domain: string
  pageTitle: string
  mode: MemoryMode
  selectedText: string
  contextBefore: string
  contextAfter: string
  categoryId?: string
  /** User's own explanation, for inline mode */
  note?: string
  /** User's last recall attempt, for hide mode */
  recallAttempt?: string
  revealed?: boolean
  /** Marked as a favourite. Absent on memories saved before this existed. */
  starred?: boolean
  createdAt: number
  updatedAt: number
}

export type NewMemoryInput = Pick<
  Memory,
  | 'url'
  | 'urlNoHash'
  | 'domain'
  | 'pageTitle'
  | 'mode'
  | 'selectedText'
  | 'contextBefore'
  | 'contextAfter'
  | 'note'
  | 'categoryId'
  | 'starred'
>

export interface ContentToBackgroundMessage {
  type: 'recallify:open-dashboard'
}

export interface SelectionContext {
  selectedText: string
  contextBefore: string
  contextAfter: string
  range: Range
}

export interface RecallifySettings {
  accentColor: string
  popoverWidth: number
  fontSize: number
  highlightOpacity: number
  popoverTheme: 'light' | 'dark'
}

export const DEFAULT_SETTINGS: RecallifySettings = {
  accentColor: '#7c3aed',
  popoverWidth: 420,
  fontSize: 15,
  highlightOpacity: 0.18,
  popoverTheme: 'light',
}
