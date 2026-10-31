/** Copies text. Falls back to execCommand because navigator.clipboard is missing on http:// pages. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or document not focused — try the fallback.
  }

  const scratch = document.createElement('textarea')
  scratch.value = text
  scratch.setAttribute('readonly', '')
  scratch.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(scratch)
  scratch.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    scratch.remove()
  }
}

/** Reads the clipboard, or null if the page isn't allowed to (the user can still press Ctrl/⌘+V). */
export async function readClipboardText(): Promise<string | null> {
  try {
    return (await navigator.clipboard?.readText()) ?? null
  } catch {
    return null
  }
}
