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

interface Props {
  open: boolean
  onClose: () => void
}

const ADVANCE_OPTIONS: { value: AdvanceMinutes; label: string }[] = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
]

export default function NotificationSettingsModal({ open, onClose }: Props) {
  const { semester } = useSemester()
  const { events } = useEvents(semester?.id)
  const [settings, setSettings] = useState<NotificationSettings>(getSettings)
  const [permGranted, setPermGranted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  // 模态打开时刷新最新设置 + 权限状态
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

    // 如果切到 enabled 但还没权限，先要权限
    if (next.enabled && native && permGranted !== true) {
      const granted = await requestPermission()
      setPermGranted(granted)
      if (!granted) {
        // 用户拒了 — 把开关回滚
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
    <Modal open={open} title="事件提醒" onClose={onClose} size="md">
      <div className="space-y-4">
        {!native && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            事件提醒只在安装的 Android APP 里生效，浏览器版本无效。
            <a href="/apps" className="underline ml-1" target="_blank" rel="noopener">
              下载 APP
            </a>
          </div>
        )}

        {native && permGranted === false && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            没有通知权限。打开下面的开关时会请求；如果之前拒过，需要去系统设置里手动开启。
          </div>
        )}

        <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm text-text">
              <Bell size={14} className="text-dim" />
              开启提醒
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
              <span className="text-sm text-text shrink-0">提前提醒</span>
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
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-dim leading-relaxed px-1">
          带具体时间的事件会提前 {settings.advanceMinutes} 分钟提醒；
          全天事件统一在前一天 09:00 提醒。已完成或取消的事件不提醒。
        </div>
      </div>
    </Modal>
  )
}
