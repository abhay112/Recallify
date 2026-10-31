import { useEffect, useState } from 'react'
import { getSettings, onSettingsChanged } from '@/lib/settings'
import { DEFAULT_SETTINGS, type RecallifySettings } from '@/lib/types'

/** The user's current settings, kept live as they change. */
export function useSettings(): RecallifySettings {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    let live = true
    void getSettings().then((loaded) => {
      if (live) setSettings(loaded)
    })
    const stop = onSettingsChanged(setSettings)
    return () => {
      live = false
      stop()
    }
  }, [])

  return settings
}
