import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Recallify — Remember What You Read',
  version: pkg.version,
  description:
    'Select text anywhere on the web, save your own explanation, or hide it and practice active recall.',
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icons/icon16.png',
      48: 'public/icons/icon48.png',
      128: 'public/icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/main.tsx'],
      run_at: 'document_idle',
    },
  ],
  // activeTab lets the popup read the current tab's URL and title when opened;
  // the content script's `matches` is all the page access the rest needs.
  permissions: ['storage', 'activeTab', 'contextMenus'],
  options_page: 'src/dashboard/index.html',
})
