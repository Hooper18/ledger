// 桌面 Widget 数据同步：把未来 7 天内未完成的事件序列化成精简快照，
// 通过自定义 Capacitor 插件 WidgetSync 写到 Android SharedPreferences。
// AppWidgetProvider 启动时读这份 JSON 渲染卡片。
//
// 设计要点：
// - Web / iOS：no-op（widget 是 Android 独有功能）
// - 不直连 Supabase：widget 后台跑网络请求耗电，所有数据流向走 app 内
//   useEvents → 这里 → SharedPreferences。app 没打开时 widget 显示
//   上次同步的快照（足够支撑"今天还有什么 DDL"这个使用场景）
// - 截至 7 天 horizon：广 widget 显示更长期的 DDL 反而让重要的近期被
//   挤出可视区
//
// 数据 schema 与 ScheduleWidgetProvider.java 互为镜像，改一边要改另一边。
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Event } from './types'

interface WidgetSyncPlugin {
  snapshot(data: { json: string }): Promise<void>
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync')

// 课程代码识别：与 TimelineView 的 COURSE_CODE_RE 同步——widget 上
// 给每条事件一个课程徽章，没识别到就留空让 Java 端兜底显示连字符。
const COURSE_CODE_RE = /\b[A-Z]{2,4}\d{3,}[A-Z]?\b/

function extractCourseCode(e: Event): string | null {
  const m =
    e.title.match(COURSE_CODE_RE) ||
    (e.notes ? e.notes.match(COURSE_CODE_RE) : null) ||
    (e.source_file ? e.source_file.match(COURSE_CODE_RE) : null)
  return m ? m[0] : null
}

interface WidgetEvent {
  id: string
  title: string
  courseCode: string | null
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  type: string
}

interface WidgetSnapshot {
  updatedAt: number
  events: WidgetEvent[]
}

const HORIZON_DAYS = 7
const MAX_EVENTS = 10

export async function syncWidget(events: Event[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + HORIZON_DAYS)
  const todayStr = isoDate(today)
  const horizonStr = isoDate(horizon)

  const filtered = events
    .filter((e) => e.status !== 'completed' && e.status !== 'cancelled')
    .filter((e) => !!e.date && e.date >= todayStr && e.date < horizonStr)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date!.localeCompare(b.date!)
      return (a.time ?? '').localeCompare(b.time ?? '')
    })
    .slice(0, MAX_EVENTS)
    .map<WidgetEvent>((e) => ({
      id: e.id,
      title: e.title,
      courseCode: extractCourseCode(e),
      date: e.date!,
      time: e.time ? e.time.slice(0, 5) : null,
      type: e.type,
    }))

  const snapshot: WidgetSnapshot = {
    updatedAt: Date.now(),
    events: filtered,
  }

  try {
    await WidgetSync.snapshot({ json: JSON.stringify(snapshot) })
  } catch {
    // 插件未注册（如旧版 APK）/ 写盘失败：吞错，不影响主流程
  }
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
