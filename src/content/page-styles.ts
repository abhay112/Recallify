import type { RecallifySettings } from '@/lib/types'

export const PAGE_STYLE_ID = 'recallify-page-styles'

function hexToRgb(hex: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return '124, 58, 237'
  return [match[1], match[2], match[3]].map((h) => parseInt(h, 16)).join(', ')
}

export function buildPageStyles(settings: RecallifySettings): string {
  const rgb = hexToRgb(settings.accentColor)
  const opacity = settings.highlightOpacity
  return `
.recallify-mark {
  background: rgba(${rgb}, ${opacity});
  border-bottom: 2px solid rgba(${rgb}, ${Math.min(opacity + 0.47, 1)});
  border-radius: 2px;
  cursor: pointer;
  padding: 0 1px;
}
.recallify-mark:hover {
  background: rgba(${rgb}, ${Math.min(opacity + 0.12, 1)});
}
.recallify-hide-wrap {
  position: relative;
  display: inline;
}
.recallify-hide-original {
  display: none;
}
.recallify-hide-original.is-revealed {
  display: inline;
  background: rgba(16, 185, 129, 0.18);
  border-bottom: 2px solid rgba(16, 185, 129, 0.6);
  border-radius: 2px;
  padding: 0 1px;
}
.recallify-hide-blank {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(${rgb}, 0.12);
  border: 1px dashed rgba(${rgb}, 0.6);
  border-radius: 4px;
  padding: 0 6px;
  cursor: pointer;
  font-style: italic;
  color: rgb(${rgb});
}
.recallify-hide-wrap.is-revealed .recallify-hide-blank {
  display: none;
}
.recallify-hide-input {
  font: inherit;
  border: 1px solid rgba(${rgb}, 0.6);
  border-radius: 4px;
  padding: 1px 4px;
  min-width: 60px;
}
.recallify-hide-result {
  font-size: 0.85em;
  margin-left: 4px;
}
.recallify-hide-result.correct { color: #059669; }
.recallify-hide-result.incorrect { color: #dc2626; }
`
}

export function injectPageStyles(settings: RecallifySettings): void {
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = PAGE_STYLE_ID
    style.setAttribute('data-recallify-ignore', 'true')
    document.head.appendChild(style)
  }
  style.textContent = buildPageStyles(settings)
}
