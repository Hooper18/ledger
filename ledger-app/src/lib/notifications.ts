// 每日记账提醒 — 仅在 Capacitor 原生上下文工作；浏览器版 no-op。
// 用 Capacitor 的 daily repeating notification（指定 hour/minute）。
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const STORAGE_KEY = 'ledger.reminder.settings'
const NOTIFICATION_ID = 10001 // 单条固定 id，重新 schedule 即覆盖

export interface ReminderSettings {
  enabled: boolean
  hour: number   // 0-23
  minute: number // 0-59
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 22,
  minute: 0,
}

export function getReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const hour = Number.isInteger(parsed.hour) && parsed.hour >= 0 && parsed.hour <= 23
        ? parsed.hour
        : DEFAULT_SETTINGS.hour
      const minute = Number.isInteger(parsed.minute) && parsed.minute >= 0 && parsed.minute <= 59
        ? parsed.minute
        : DEFAULT_SETTINGS.minute
      return { enabled: !!parsed.enabled, hour, minute }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

export function saveReminderSettings(s: ReminderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function isNativeAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export async function checkPermission(): Promise<boolean> {
  if (!isNativeAvailable()) return false
  const result = await LocalNotifications.checkPermissions()
  return result.display === 'granted'
}

export async function requestPermission(): Promise<boolean> {
  if (!isNativeAvailable()) return false
  const result = await LocalNotifications.requestPermissions()
  return result.display === 'granted'
}

interface I18nStrings {
  title: string
  body: string
}

export async function syncReminder(strings: I18nStrings): Promise<void> {
  if (!isNativeAvailable()) return
  const settings = getReminderSettings()

  // 不管开关状态，先取消上一条 — 关 → 不再有；开 → 重新 schedule
  await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] }).catch(() => {})

  if (!settings.enabled) return

  const granted = await checkPermission()
  if (!granted) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: strings.title,
        body: strings.body,
        schedule: {
          on: { hour: settings.hour, minute: settings.minute },
          // allowWhileIdle 让 Doze 模式下也能响（某些 Android 节电策略会拦）。
          allowWhileIdle: true,
        },
      },
    ],
  })
}
