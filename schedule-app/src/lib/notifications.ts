// 事件本地通知 — 在 Capacitor 原生上下文用 @capacitor/local-notifications，
// 在浏览器里全部 no-op（远程加载场景下 web 用户也用不到）。
// 设计要点：
// - notification id 用事件 UUID 哈希成 32 位整数，CRUD 时 schedule 同 id 自然覆盖
// - 全天事件提醒在前一天 09:00；带时间事件在 advanceMinutes 分钟前
// - 同步策略：拉一次现存的 pending 列表，对比目标列表，差集走 cancel/schedule
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Event } from './types'
import { typeLabel } from './utils'
import { tStatic } from '../i18n'

const STORAGE_KEY = 'schedule.notification.settings'

export type AdvanceMinutes = 15 | 30 | 60

export interface NotificationSettings {
  enabled: boolean
  advanceMinutes: AdvanceMinutes
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  advanceMinutes: 30,
}

export function getSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        enabled: !!parsed.enabled,
        advanceMinutes: ([15, 30, 60] as AdvanceMinutes[]).includes(parsed.advanceMinutes)
          ? parsed.advanceMinutes
          : 30,
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(s: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function isNativeAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

// 把 UUID 字符串哈希成 32 位正整数 — Capacitor 通知 id 必须是 int32。
function eventToNotificationId(eventId: string): number {
  let h = 0
  for (let i = 0; i < eventId.length; i++) {
    h = ((h << 5) - h + eventId.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 2147483647
}

export async function requestPermission(): Promise<boolean> {
  if (!isNativeAvailable()) return false
  const result = await LocalNotifications.requestPermissions()
  return result.display === 'granted'
}

export async function checkPermission(): Promise<boolean> {
  if (!isNativeAvailable()) return false
  const result = await LocalNotifications.checkPermissions()
  return result.display === 'granted'
}

function computeTriggerTime(event: Event, advanceMinutes: number): Date | null {
  if (!event.date) return null
  let trigger: Date
  if (event.time) {
    // 带时间 → 提前 advanceMinutes 分钟
    trigger = new Date(`${event.date}T${event.time}`)
    trigger.setMinutes(trigger.getMinutes() - advanceMinutes)
  } else {
    // 全天 → 前一天 09:00
    trigger = new Date(`${event.date}T09:00:00`)
    trigger.setDate(trigger.getDate() - 1)
  }
  if (isNaN(trigger.getTime())) return null
  if (trigger.getTime() <= Date.now()) return null
  return trigger
}

/**
 * 把所有未来事件同步进系统通知队列。
 * - 关闭/拒权：清空所有 pending（之前可能 schedule 过的不该再响）
 * - 启用：cancel 现存里不在目标里的，schedule 目标列表（同 id 自然覆盖）
 */
export async function syncNotifications(events: Event[]): Promise<void> {
  if (!isNativeAvailable()) return

  const settings = getSettings()

  // 拿当前 pending — Capacitor 会把过期但未触发的也算在内，所以要清理
  const pendingResp = await LocalNotifications.getPending().catch(() => null)
  const pending = pendingResp?.notifications ?? []

  if (!settings.enabled) {
    if (pending.length) {
      await LocalNotifications.cancel({
        notifications: pending.map((n) => ({ id: n.id })),
      })
    }
    return
  }

  const granted = await checkPermission()
  if (!granted) return

  const desired = events
    .filter((e) => e.status !== 'completed' && e.status !== 'cancelled')
    .map((e) => {
      const trigger = computeTriggerTime(e, settings.advanceMinutes)
      if (!trigger) return null
      return {
        id: eventToNotificationId(e.id),
        title: e.title || tStatic('notif.defaultTitle'),
        body: e.time
          ? tStatic('notif.bodyTimed', {
              advance: settings.advanceMinutes,
              type: typeLabel(e.type),
            })
          : tStatic('notif.bodyAllDay', { type: typeLabel(e.type) }),
        schedule: { at: trigger },
        // 用户点通知时，listener 拿到这个 eventId 用于路由
        extra: { eventId: e.id },
      }
    })
    .filter((n): n is NonNullable<typeof n> => n !== null)

  const desiredIds = new Set(desired.map((d) => d.id))
  const toCancel = pending.filter((n) => !desiredIds.has(n.id))
  if (toCancel.length) {
    await LocalNotifications.cancel({
      notifications: toCancel.map((n) => ({ id: n.id })),
    })
  }

  if (desired.length) {
    await LocalNotifications.schedule({ notifications: desired })
  }
}

// 用户点击通知后，eventId 存这里。App 启动后读取并跳转到 /todo（清掉 sessionStorage）。
// 选 sessionStorage 而非 useNavigate：listener 在 React 上下文之外注册（main.tsx 启动时），
// 拿不到 navigate；用 sessionStorage 中转 + App.tsx 内 useEffect 消费是最小耦合。
export const PENDING_EVENT_KEY = 'schedule.pending.eventId'

let listenerRegistered = false

export async function setupNotificationClickHandler(): Promise<void> {
  if (!isNativeAvailable() || listenerRegistered) return
  listenerRegistered = true
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const eventId = (action.notification.extra as { eventId?: string } | undefined)?.eventId
    if (eventId) {
      try {
        sessionStorage.setItem(PENDING_EVENT_KEY, eventId)
      } catch {
        // sessionStorage 不可用就只能放弃 deep link，至少 app 已经被打开了
      }
    }
  })
}

export async function cancelAll(): Promise<void> {
  if (!isNativeAvailable()) return
  const pendingResp = await LocalNotifications.getPending().catch(() => null)
  const pending = pendingResp?.notifications ?? []
  if (pending.length) {
    await LocalNotifications.cancel({
      notifications: pending.map((n) => ({ id: n.id })),
    })
  }
}
