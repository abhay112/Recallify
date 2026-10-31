chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'recallify-remember',
    title: 'Remember this with Recallify',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'recallify-hide',
    title: 'Hide & Remember with Recallify',
    contexts: ['selection'],
  })
})

function notifyTab(tabId: number, type: string) {
  chrome.tabs.sendMessage(tabId, { type }).catch(() => {
    // No content script in this tab (e.g. page loaded before the extension did,
    // or a restricted chrome:// page) — nothing to do about it here.
  })
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return
  if (info.menuItemId === 'recallify-remember') {
    notifyTab(tab.id, 'recallify:open-inline-from-menu')
  } else if (info.menuItemId === 'recallify-hide') {
    notifyTab(tab.id, 'recallify:open-hide-from-menu')
  }
})
