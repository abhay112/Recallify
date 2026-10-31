import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS, type RecallifySettings } from '@/lib/types'
import { disableSync, enableSync, isSyncEnabled } from '@/lib/storage'

const ACCENT_PRESETS = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777']

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<RecallifySettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
    isSyncEnabled().then(setSyncEnabled)
  }, [])

  const toggleSync = async () => {
    setSyncBusy(true)
    setSyncMessage(null)
    try {
      if (syncEnabled) {
        await disableSync()
        setSyncEnabled(false)
        setSyncMessage('Sync turned off. Your memories are back to this device only.')
      } else {
        const result = await enableSync()
        setSyncEnabled(true)
        setSyncMessage(
          result.keptLocalOnly > 0
            ? `Synced ${result.moved} memories. ${result.keptLocalOnly} were too long to sync and stayed on this device.`
            : `Synced ${result.moved} memories across your Chrome-signed-in devices.`
        )
      }
    } finally {
      setSyncBusy(false)
    }
  }

  const apply = async (patch: Partial<RecallifySettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await updateSettings(patch)
  }

  const reset = async () => {
    setSettings(DEFAULT_SETTINGS)
    await updateSettings(DEFAULT_SETTINGS)
  }

  if (!loaded) return null

  return (
    <div className="practice-overlay" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <button className="practice-close" onClick={onClose}>✕</button>
        <h3>Sync</h3>
        <div className="settings-row sync-row">
          <div>
            <label>Sync memories across devices</label>
            <p className="sync-hint">
              Uses Chrome's built-in sync (your Google account) — no account or server of ours needed.
              Very long notes may stay local-only if they don't fit in a single sync item (~8KB).
            </p>
          </div>
          <button className={`sync-toggle ${syncEnabled ? 'on' : ''}`} disabled={syncBusy} onClick={toggleSync}>
            {syncBusy ? 'Working…' : syncEnabled ? 'On' : 'Off'}
          </button>
        </div>
        {syncMessage && <div className="sync-message">{syncMessage}</div>}

        <h3>Appearance</h3>

        <div className="settings-row">
          <label>Accent color</label>
          <div className="accent-swatches">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                className={`swatch ${settings.accentColor === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => apply({ accentColor: color })}
              />
            ))}
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => apply({ accentColor: e.target.value })}
            />
          </div>
        </div>

        <div className="settings-row">
          <label>Popover width: {settings.popoverWidth}px</label>
          <input
            type="range"
            min={300}
            max={640}
            step={10}
            value={settings.popoverWidth}
            onChange={(e) => apply({ popoverWidth: Number(e.target.value) })}
          />
        </div>

        <div className="settings-row">
          <label>Font size: {settings.fontSize}px</label>
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={settings.fontSize}
            onChange={(e) => apply({ fontSize: Number(e.target.value) })}
          />
        </div>

        <div className="settings-row">
          <label>Highlight strength: {Math.round(settings.highlightOpacity * 100)}%</label>
          <input
            type="range"
            min={5}
            max={50}
            step={1}
            value={Math.round(settings.highlightOpacity * 100)}
            onChange={(e) => apply({ highlightOpacity: Number(e.target.value) / 100 })}
          />
        </div>

        <div
          className="settings-preview"
          style={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--preview-accent' as any]: settings.accentColor,
            fontSize: settings.fontSize,
          }}
        >
          <div className="preview-label">PREVIEW</div>
          <div className="preview-quote">This is how your popover text will look.</div>
        </div>

        <div className="card-edit-actions">
          <button onClick={reset}>Reset to defaults</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
