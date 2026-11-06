# Privacy Policy

_Effective 31 October 2026_

Recallify is a browser extension that lets you save passages from web pages together
with your own notes, and practise recalling them later. This policy explains what it
stores, where, and who can see it.

**Short version:** your data stays in your browser. Recallify has no server, no
account system, no analytics and no ads, and it never sends your data to us or to
anyone else. If you choose to turn on sync, Chrome itself syncs your memories
through your Google account.

## What Recallify stores

When you save a memory, Recallify stores:

- the text you selected, plus about 40 characters of surrounding text on each side
  (used to find the passage again when you revisit the page)
- the page's address (URL), title and domain
- your note and category, if you add them
- your last recall attempt, for passages you chose to hide

It also stores the categories you create and your appearance settings (accent colour,
popover width, font size, highlight strength).

## Where it is stored

- **On your device**, in the browser's extension storage (`chrome.storage.local`).
  Other websites cannot read it.
- **In Chrome Sync, only if you turn sync on** in the dashboard's Appearance panel.
  Your memories are then stored in `chrome.storage.sync`, which Google syncs between
  the Chrome browsers you are signed in to. That sync is operated by Google and
  covered by Google's own privacy policy. Categories and appearance settings are not
  synced.

## What Recallify does not do

- It does not send your data to any server run by the developers.
- It does not make network requests of its own. It does not load remote code,
  fonts, images or favicons.
- The note toolbar works locally. Paste reads the clipboard only when you press
  it, Copy and Download write only what you chose, and Read aloud uses the
  voices already on your device. Nothing from these tools leaves your browser.
- It does not collect analytics or usage statistics, show ads, or sell or share
  data with third parties.

## Access to web pages

Recallify runs on every `http` and `https` page you visit so that it can show its
toolbar when you select text and re-highlight passages you saved earlier. To do that
it reads the page's text **inside your browser**. That text is not transmitted
anywhere, and nothing is stored unless you save a memory.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your memories, categories and settings, and optionally sync memories. |
| `activeTab` | Let the toolbar popup read the title and address of the tab you opened it on. |
| `contextMenus` | Add "Remember" and "Hide & Remember" to the right-click menu on selected text. |
| Access to `http`/`https` pages | Show the selection toolbar and restore saved highlights on any site. |

## Your control over your data

- Delete any memory from the dashboard or the toolbar popup.
- To remove synced data, turn sync off in the Appearance panel. Memories are copied
  back to this device and removed from Chrome Sync.
- Uninstalling the extension deletes the data it stored on this device.

## Children

Recallify is a general-purpose tool and does not knowingly collect information from
anyone, including children.

## Changes

If this policy changes, the updated version will be published in this file with a
new effective date.

## Contact

Questions or concerns: open an issue at https://github.com/abhay112/Recallify/issues
