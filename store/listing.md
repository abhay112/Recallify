# Chrome Web Store listing

Copy these into the Web Store developer dashboard. Re-check the data-usage answers
against the dashboard's current wording before you submit.

## Basics

- **Name:** Recallify — Remember What You Read
- **Category:** Education (or Productivity)
- **Language:** English
- **Summary (max 132 characters):**
  Select text on any page, save your own explanation, or hide it and test yourself later. Everything stays in your browser.

## Detailed description

Reading is easy to forget. Recallify turns what you read into something you remember.

Select text on any web page and choose what to do with it:

• Remember — write your own explanation next to the passage. It stays highlighted on the page, and you can click it to reread your note whenever you come back.

• Hide & Remember — replace the passage with a blank. Click it, type what you remember, then check yourself against the original.

The note window is draggable and resizable, with a toolbar for copy/paste, undo/redo, spellcheck, text size, read aloud, download as text, starring and a dark theme.

Then use the dashboard to:

• Search and filter everything you've saved, across all sites
• Organise memories with categories and stars
• Run a shuffled practice session over everything you've hidden
• Customise the accent colour, popover size, font size and highlight strength

Prefer the right-click menu? Select text, right-click, and pick a Recallify action.

Your data stays yours
Memories are stored in your browser. There is no Recallify account and no server, and the extension doesn't send your data anywhere. Optional sync uses Chrome's built-in sync through your Google account, and it's off until you turn it on.

Good to know
• Highlights are restored by matching the saved text, so pages that rewrite their content heavily after loading may not always restore them.
• Sync uses Chrome's small storage quotas, so very large libraries or very long notes stay on the device they were saved on.
• Memories live in your browser profile and uninstalling the extension deletes them.

## Single purpose

Let users save passages from web pages with their own notes, or hide them for self-testing, and review those saved passages later.

## Permission justifications

- **storage** — Saves the user's memories, categories and settings in the browser. Also used for optional sync of memories through Chrome Sync, which is off by default.
- **activeTab** — When the user opens the toolbar popup, it reads the title and address of the current tab to list the memories saved on that page.
- **contextMenus** — Adds "Remember" and "Hide & Remember" actions to the right-click menu for selected text.
- **Content script on all http and https pages** — The core feature works on any site the user reads: the content script shows the selection toolbar, wraps saved passages in highlights, and re-locates them on later visits. It reads page text locally in the browser and does not transmit it.
- **Remote code** — None. All code is bundled in the package.

## Privacy practices tab

Suggested answers, based on what the code does today:

- **Data handled:** website content (text the user selects and the text around it) and web history (the address and title of pages where the user saved a memory). Both are stored in the browser; if the user turns on sync they are also stored in Chrome Sync.
- **Sold or transferred to third parties:** No.
- **Used for purposes unrelated to the item's single purpose:** No.
- **Used to determine creditworthiness or for lending:** No.
- **Privacy policy URL:** the public URL of `PRIVACY.md` once the repository is published.

## Assets you need to provide

- [x] Screenshots (1280×800) are in `store/screenshots/`.
- [x] A 128×128 store icon (`public/icons/icon128.png`).
- [ ] Optional small promo tile, 440×280.
- [x] Contact details in `PRIVACY.md`.

## Submitting

1. Run `npm run build`, then zip the **contents** of `dist/` (so `manifest.json` is at the top level of the zip).
2. Upload the zip in the developer dashboard and fill in the fields above.
3. Every later update needs a higher `version` in `package.json` than the one before.
