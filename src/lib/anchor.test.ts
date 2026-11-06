import { beforeEach, describe, expect, it } from 'vitest'
import { captureCurrentSelection, getDomain, locateRange, normalizeUrl } from './anchor'

function textOf(id: string): Text {
  return document.getElementById(id)!.firstChild as Text
}

function select(start: Text, startOffset: number, end: Text, endOffset: number): void {
  const range = document.createRange()
  range.setStart(start, startOffset)
  range.setEnd(end, endOffset)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function selectAll(node: Text): void {
  select(node, 0, node, node.length)
}

/** Id of the element that holds the text node a range boundary sits in. */
function hostId(container: Node): string | undefined {
  return (container.parentElement ?? undefined)?.id
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

beforeEach(() => {
  window.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
})

describe('locateRange', () => {
  it('matches text whose HTML source wraps across lines', () => {
    document.body.innerHTML = `<p id="a">The mitochondria is the
        powerhouse of the cell.</p>`

    const range = locateRange('The mitochondria is the powerhouse of the cell.', '', '')

    expect(range).not.toBeNull()
    expect(collapse(range!.toString())).toBe('The mitochondria is the powerhouse of the cell.')
  })

  it('matches a selection that spans two paragraphs', () => {
    document.body.innerHTML = `<p id="c1">First paragraph ends here.</p><p id="c2">Second paragraph starts here.</p>`

    // This is what Chrome's selection.toString() produces across blocks.
    const range = locateRange('paragraph ends here.\n\nSecond', '', '')

    expect(range).not.toBeNull()
    expect(hostId(range!.startContainer)).toBe('c1')
    expect(hostId(range!.endContainer)).toBe('c2')
  })

  it('matches across inline element boundaries', () => {
    document.body.innerHTML = `<p id="d">Remember <b>this <i>carefully</i></b>, please</p>`

    const range = locateRange('this carefully, please', '', '')

    expect(range).not.toBeNull()
  })

  it('ignores case, since CSS text-transform changes what the user selected', () => {
    document.body.innerHTML = `<p id="e">paris is the capital of France.</p>`

    const range = locateRange('PARIS IS THE CAPITAL', '', '')

    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('paris is the capital')
  })

  it('returns null when the text is not on the page', () => {
    document.body.innerHTML = `<p>Something else entirely.</p>`

    expect(locateRange('not here', '', '')).toBeNull()
    expect(locateRange('   ', '', '')).toBeNull()
  })

  it('uses surrounding context to choose between duplicate matches', () => {
    document.body.innerHTML = `
      <p id="b1">Alpha intro. Paris is the capital of France. Beta outro.</p>
      <p id="b2">Gamma intro. Paris is the capital of France. Delta outro.</p>`

    const second = locateRange('Paris is the capital of France.', 'Gamma intro.', 'Delta outro.')
    const first = locateRange('Paris is the capital of France.', 'Alpha intro.', 'Beta outro.')

    expect(hostId(second!.startContainer)).toBe('b2')
    expect(hostId(first!.startContainer)).toBe('b1')
  })

  it('still disambiguates with context saved by older versions (raw innerText newlines)', () => {
    document.body.innerHTML = `
      <p id="b1">Alpha intro. Paris is the capital of France. Beta outro.</p>
      <p id="b2">Gamma intro. Paris is the capital of France. Delta outro.</p>`

    const range = locateRange('Paris is the capital of France.', 'Gamma intro. ', '\n\nDelta outro.')

    expect(hostId(range!.startContainer)).toBe('b2')
  })

  it('returns a tight range that does not spill into the next text node', () => {
    document.body.innerHTML = `<p><span id="g1">hello</span><span id="g2">world</span></p>`

    const range = locateRange('hello', '', '')!

    expect(range.startContainer).toBe(textOf('g1'))
    expect(range.startOffset).toBe(0)
    expect(range.endContainer).toBe(textOf('g1'))
    expect(range.endOffset).toBe(5)
  })

  it('skips Recallify-owned UI and non-content elements', () => {
    document.body.innerHTML = `
      <script>var secret = "needle text"</script>
      <textarea>needle text</textarea>
      <span data-recallify-ignore="true">needle text</span>`

    expect(locateRange('needle text', '', '')).toBeNull()
  })
})

describe('captureCurrentSelection', () => {
  it('returns null when nothing is selected', () => {
    document.body.innerHTML = `<p id="a">Some text</p>`

    expect(captureCurrentSelection()).toBeNull()
  })

  it('collapses whitespace in the saved text', () => {
    document.body.innerHTML = `<p id="a">The mitochondria is the
        powerhouse of the cell.</p>`
    selectAll(textOf('a'))

    const captured = captureCurrentSelection()!

    expect(captured.selectedText).toBe('The mitochondria is the powerhouse of the cell.')
  })

  it('captures context around the selected occurrence, not the first match on the page', () => {
    document.body.innerHTML = `
      <p id="b1">Alpha intro. Paris is the capital of France. Beta outro.</p>
      <p id="b2">Gamma intro. Paris is the capital of France. Delta outro.</p>`
    const node = textOf('b2')
    const start = node.data.indexOf('Paris')
    select(node, start, node, start + 'Paris is the capital of France.'.length)

    const captured = captureCurrentSelection()!

    expect(captured.selectedText).toBe('Paris is the capital of France.')
    expect(captured.contextBefore.endsWith('Gamma intro.')).toBe(true)
    expect(captured.contextAfter.startsWith('Delta outro.')).toBe(true)
  })

  it('keeps context to a bounded length', () => {
    const filler = 'lorem ipsum dolor sit amet '.repeat(20)
    document.body.innerHTML = `<p id="a">${filler}TARGET${filler}</p>`
    const node = textOf('a')
    const at = node.data.indexOf('TARGET')
    select(node, at, node, at + 6)

    const captured = captureCurrentSelection()!

    expect(captured.contextBefore.length).toBeLessThanOrEqual(40)
    expect(captured.contextAfter.length).toBeLessThanOrEqual(40)
  })

  it('round-trips: a captured selection is relocated to the same place', () => {
    document.body.innerHTML = `
      <p id="b1">Alpha intro. Paris is the capital of France. Beta outro.</p>
      <p id="b2">Gamma intro. Paris is the capital of France. Delta outro.</p>`
    const node = textOf('b2')
    const start = node.data.indexOf('Paris')
    select(node, start, node, start + 'Paris is the capital of France.'.length)
    const captured = captureCurrentSelection()!

    const restored = locateRange(captured.selectedText, captured.contextBefore, captured.contextAfter)!

    expect(hostId(restored.startContainer)).toBe('b2')
    expect(restored.toString()).toBe('Paris is the capital of France.')
  })

  it('trims a triple-click selection that ends at the start of the next block', () => {
    document.body.innerHTML = `<p id="a">First paragraph.</p><p id="b">Second paragraph.</p>`
    const range = document.createRange()
    range.setStart(textOf('a'), 0)
    range.setEnd(document.getElementById('b')!, 0)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    const captured = captureCurrentSelection()!

    expect(captured.selectedText).toBe('First paragraph.')
    expect(captured.range.endContainer).toBe(textOf('a'))
    expect(captured.range.endOffset).toBe('First paragraph.'.length)
  })

  it('keeps a selection that spans paragraphs inside the first one', () => {
    document.body.innerHTML = `<p id="c1">First paragraph ends here.</p><p id="c2">Second paragraph starts here.</p>`
    select(textOf('c1'), 6, textOf('c2'), 6)

    const captured = captureCurrentSelection()!
    const restored = locateRange(captured.selectedText, captured.contextBefore, captured.contextAfter)!

    expect(captured.selectedText).toBe('paragraph ends here.')
    expect(hostId(restored.startContainer)).toBe('c1')
    expect(hostId(restored.endContainer)).toBe('c1')
  })

  it('still spans inline elements within one block', () => {
    document.body.innerHTML = `<p id="d">Plain <b id="bold">bold</b> text</p>`
    select(textOf('d'), 0, document.getElementById('d')!.lastChild as Text, 5)

    expect(captureCurrentSelection()!.selectedText).toBe('Plain bold text')
  })
})

describe('url helpers', () => {
  it('normalizeUrl drops the hash but keeps path and query', () => {
    expect(normalizeUrl('https://example.com/a?b=1#section')).toBe('https://example.com/a?b=1')
  })

  it('getDomain returns the hostname', () => {
    expect(getDomain('https://docs.example.com:8080/x')).toBe('docs.example.com')
  })
})
