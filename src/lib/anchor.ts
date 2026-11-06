import type { SelectionContext } from './types'

const CONTEXT_LENGTH = 40

/** Skip text inside elements Recallify itself injects, or non-content tags. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'])

function isRecallifyNode(node: Node): boolean {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  while (el) {
    if (el.hasAttribute?.('data-recallify-ignore')) return true
    el = el.parentElement
  }
  return false
}

function textNodesIn(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (isRecallifyNode(node)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Saved text and the DOM disagree about whitespace and case: selection.toString()
// returns *rendered* text (source newlines collapsed, "\n\n" between blocks,
// text-transform applied) while text nodes hold the raw source. So matching is done
// on a "folded" form of both sides: whitespace dropped, case lowered.
const IGNORED_NON_ASCII = /[\s\u00AD\u200B-\u200D\uFEFF]/

function foldChar(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code < 128) return code <= 32 ? '' : ch.toLowerCase()
  return IGNORED_NON_ASCII.test(ch) ? '' : ch.toLowerCase()
}

function fold(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) out += foldChar(text[i])
  return out
}

interface FoldedDocument {
  text: string
  nodes: Text[]
  /** For each char of `text`: which node it came from, and its offset in that node. */
  nodeIndex: number[]
  nodeOffset: number[]
}

function foldNodes(nodes: Text[]): FoldedDocument {
  const chars: string[] = []
  const nodeIndex: number[] = []
  const nodeOffset: number[] = []
  nodes.forEach((node, n) => {
    const data = node.data
    for (let i = 0; i < data.length; i++) {
      const folded = foldChar(data[i])
      for (let k = 0; k < folded.length; k++) {
        chars.push(folded[k])
        nodeIndex.push(n)
        nodeOffset.push(i)
      }
    }
  })
  return { text: chars.join(''), nodes, nodeIndex, nodeOffset }
}

/**
 * Text immediately before and after a range, taken from the same text nodes
 * `locateRange` searches, so the two always agree.
 */
function captureContext(range: Range): { contextBefore: string; contextAfter: string } {
  let before = ''
  let after = ''
  for (const node of textNodesIn(document.body)) {
    const length = node.data.length
    const startsHere = node === range.startContainer
    const endsHere = node === range.endContainer
    // [0, beforeEnd) lies before the selection and [afterStart, length) lies after it.
    let beforeEnd: number
    let afterStart: number
    if (startsHere || endsHere) {
      beforeEnd = startsHere ? range.startOffset : 0
      afterStart = endsHere ? range.endOffset : length
    } else {
      // Any other text node is wholly before, inside or after the range.
      let position = 0
      try {
        position = range.comparePoint(node, 0)
      } catch {
        // Node lives in a different tree (e.g. a shadow root) — treat it as inside.
      }
      beforeEnd = position < 0 ? length : 0
      afterStart = position > 0 ? 0 : length
    }
    before += node.data.slice(0, beforeEnd)
    after += node.data.slice(afterStart)
  }
  return {
    contextBefore: collapseWhitespace(before).slice(-CONTEXT_LENGTH).trimStart(),
    contextAfter: collapseWhitespace(after).slice(0, CONTEXT_LENGTH).trimEnd(),
  }
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'TD', 'TH', 'TR', 'TABLE', 'BLOCKQUOTE', 'PRE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN',
  'NAV', 'FIGURE', 'FIGCAPTION', 'BODY',
])

function blockOf(node: Node): Element | null {
  let el = node.parentElement
  while (el && !BLOCK_TAGS.has(el.tagName)) el = el.parentElement
  return el
}

/**
 * Pulls a range's edges onto the text it really covers, and keeps it inside one block.
 *
 * Triple-clicking a paragraph selects up to the *start of the next block*, and wrapping
 * such a range in an inline element splits block elements apart. Likewise a drag across
 * several paragraphs can't be wrapped in a single inline element. So the range is
 * trimmed to its first and last text, and cut off at the end of the first block if it
 * would otherwise cross into another one.
 */
function tightenRange(range: Range): Range | null {
  const covered: { node: Text; start: number; end: number }[] = []
  for (const node of textNodesIn(document.body)) {
    if (!range.intersectsNode(node)) continue
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : node.data.length
    if (end > start && node.data.slice(start, end).trim()) covered.push({ node, start, end })
  }
  if (covered.length === 0) return null

  const first = covered[0]
  const block = blockOf(first.node)
  let last = first
  for (const part of covered) {
    if (blockOf(part.node) !== block) break
    last = part
  }

  const tight = document.createRange()
  tight.setStart(first.node, first.start)
  tight.setEnd(last.node, last.end)
  return tight
}

/** Builds selection + surrounding context from the current window selection, if any. */
export function captureCurrentSelection(): SelectionContext | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !document.body) return null

  const range = tightenRange(selection.getRangeAt(0))
  if (!range) return null
  const selectedText = collapseWhitespace(range.toString())
  if (!selectedText) return null

  return { selectedText, ...captureContext(range), range }
}

/**
 * Finds the DOM Range matching a previously saved selection, using surrounding
 * context to disambiguate when the same text appears more than once on the page.
 */
export function locateRange(
  selectedText: string,
  contextBefore: string,
  contextAfter: string
): Range | null {
  const needle = fold(selectedText)
  if (!needle || !document.body) return null

  const nodes = textNodesIn(document.body)
  if (nodes.length === 0) return null
  const doc = foldNodes(nodes)

  const candidates: number[] = []
  for (let from = 0; ; ) {
    const found = doc.text.indexOf(needle, from)
    if (found === -1) break
    candidates.push(found)
    from = found + 1
  }
  if (candidates.length === 0) return null

  const first =
    candidates.length === 1
      ? candidates[0]
      : pickByContext(doc.text, candidates, needle.length, fold(contextBefore), fold(contextAfter))
  const last = first + needle.length - 1

  const range = document.createRange()
  range.setStart(doc.nodes[doc.nodeIndex[first]], doc.nodeOffset[first])
  range.setEnd(doc.nodes[doc.nodeIndex[last]], doc.nodeOffset[last] + 1)
  return range
}

/** Picks the candidate whose neighbouring text best matches the saved context. */
function pickByContext(
  text: string,
  candidates: number[],
  length: number,
  before: string,
  after: string
): number {
  let best = candidates[0]
  let bestScore = -1
  for (const candidate of candidates) {
    const score =
      (before ? commonSuffixLen(text.slice(Math.max(0, candidate - before.length), candidate), before) : 0) +
      (after ? commonPrefixLen(text.slice(candidate + length, candidate + length + after.length), after) : 0)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

function commonSuffixLen(a: string, b: string): number {
  let len = 0
  while (len < a.length && len < b.length && a[a.length - 1 - len] === b[b.length - 1 - len]) len++
  return len
}

function commonPrefixLen(a: string, b: string): number {
  let len = 0
  while (len < a.length && len < b.length && a[len] === b[len]) len++
  return len
}

export function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.toString()
}

export function getDomain(url: string): string {
  return new URL(url).hostname
}
