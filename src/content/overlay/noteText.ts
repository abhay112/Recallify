/** Text helpers for the note editor's tools. All pure. */

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function toTitleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s\-"([])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toUpperCase())
}

/** Cycles UPPER → lower → Title Case → UPPER. Text without letters is returned unchanged. */
export function cycleCase(text: string): string {
  const upper = text.toUpperCase()
  const lower = text.toLowerCase()
  if (upper === lower) return text
  if (text === upper) return lower
  if (text === lower) return toTitleCase(text)
  return upper
}

interface NoteSource {
  selectedText: string
  note: string
  pageTitle: string
  url: string
}

/** The quote, where it came from, and the user's note, as plain text for copying or saving. */
export function formatWithSource({ selectedText, note, pageTitle, url }: NoteSource): string {
  const source = [pageTitle && `— ${pageTitle}`, url].filter(Boolean).join('\n')
  return [`“${selectedText}”`, source, note.trim()].filter(Boolean).join('\n\n')
}

export function fileNameFor(pageTitle: string): string {
  const slug = pageTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return `recallify-${slug || 'note'}.txt`
}
