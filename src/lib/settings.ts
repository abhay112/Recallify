import { DEFAULT_SETTINGS, type RecallifySettings } from './types'

const SETTINGS_KEY = 'recallify:settings'

export async function getSettings(): Promise<RecallifySettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<RecallifySettings> | undefined) }
}

export async function updateSettings(patch: Partial<RecallifySettings>): Promise<RecallifySettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  await chrome.storage.local.set({ [SETTINGS_KEY]: next })
  return next
}

export function onSettingsChanged(callback: (settings: RecallifySettings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !(SETTINGS_KEY in changes)) return
    callback({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<RecallifySettings> | undefined) })
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
