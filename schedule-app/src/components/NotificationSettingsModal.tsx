import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import Modal from './shared/Modal'
import {
  type AdvanceMinutes,
  type NotificationSettings,
  checkPermission,
  getSettings,
  isNativeAvailable,
  requestPermission,
  saveSettings,
  syncNotifications,
} from '../lib/notifications'
import { useEvents } from '../hooks/useEvents'
import { useSemester } from '../hooks/useSemester'
import { useT } from '../i18n'
import type { TKey } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
}

const ADVANCE_OPTIONS: { value: AdvanceMinutes; labelKey: TKey }[] = [
  { value: 15, labelKey: 'notifSettings.advance15' },
  { value: 30, labelKey: 'notifSettings.advance30' },
  { value: 60, labelKey: 'notifSettings.advance60' },
]

export default function NotificationSettingsModal({ open, onClose }: Props) {
  const { semester } = useSemester()
  const { events } = useEvents(semester?.id)
  const t = useT()
  const [settings, setSettings] = useState<NotificationSettings>(getSettings)
  const [permGranted, setPermGranted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setSettings(getSettings())
    if (isNativeAvailable()) {
      checkPermission().then(setPermGranted)
    } else {
      setPermGranted(false)
    }
  }, [open])

  const native = isNativeAvailable()

  const update = async (next: NotificationSettings) => {
    setBusy(true)
    setSettings(next)
    saveSettings(next)

    if (next.enabled && native && permGranted !== true) {
      const granted = await requestPermission()
      setPermGranted(granted)
      if (!granted) {
        const fallback = { ...next, enabled: false }
        setSettings(fallback)
        saveSettings(fallback)
        setBusy(false)
        return
      }
    }

    await syncNotifications(events).catch(() => {})
    setBusy(false)
  }

  return (
    <Modal open={open} title={t('notifSettings.title')} onClose={onClose} size="md">
      <div className="space-y-4">
        {!native && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            {t('notifSettings.nativeOnly')}
            <a href="/apps" className="underline ml-1" target="_blank" rel="noopener">
              {t('notifSettings.downloadApp')}
            </a>
          </div>
        )}

        {native && permGranted === false && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            {t('notifSettings.needPerm')}
          </div>
        )}

        <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm text-text">
              <Bell size={14} className="text-dim" />
              {t('notifSettings.enable')}
            </span>
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={busy || !native}
              onChange={(e) => update({ ...settings, enabled: e.target.checked })}
              className="accent-accent w-5 h-5"
            />
          </label>

          {settings.enabled && (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-text shrink-0">{t('notifSettings.advance')}</span>
              <select
                value={settings.advanceMinutes}
                disabled={busy || !native}
                onChange={(e) =>
                  update({ ...settings, advanceMinutes: Number(e.target.value) as AdvanceMinutes })
                }
                className="flex-1 min-w-0 bg-transparent text-text text-sm text-right focus:outline-none"
              >
                {ADVANCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-dim leading-relaxed px-1">
          {t('notifSettings.explain', { n: settings.advanceMinutes })}
        </div>
      </div>
    </Modal>
  )
}
