import type { TFn } from '../i18n'
import type { WeeklySchedule } from './types'

// Minutes since midnight from an HH:MM[:SS] time string.
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function formatDuration(mins: number, t: TFn): string {
  if (mins < 1) return t('duration.lessThanMinute')
  if (mins < 60) return t('duration.minutes', { n: mins })
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0
    ? t('duration.hours', { n: h })
    : t('duration.hoursMinutes', { h, m })
}

// Group a flat WeeklySchedule[] by day_of_week (0=Sun..6=Sat). Sessions
// within each day are sorted by start_time so `arr[0]` is the first class.
export function scheduleByDow(
  schedule: WeeklySchedule[],
): Map<number, WeeklySchedule[]> {
  const m = new Map<number, WeeklySchedule[]>()
  for (const s of schedule) {
    const arr = m.get(s.day_of_week) ?? []
    arr.push(s)
    m.set(s.day_of_week, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.start_time.localeCompare(b.start_time))
  }
  return m
}

export interface CurrentAndNext {
  currentSession: WeeklySchedule | null
  nextSession: WeeklySchedule | null
  // 0 = today, 1..7 = tomorrow..next-same-weekday. Only offset 0 gets a
  // minute countdown; higher offsets should render a weekday label instead.
  nextOffset: number
  minsRemaining: number
  minsUntil: number
}

// Given a weekly schedule (indexed by day_of_week) and wall-clock time,
// compute what's currently in progress and what the next session is. If
// today has no remaining sessions, walks forward up to 7 days to find the
// earliest class on the next day that has one.
export function computeCurrentAndNext(
  scheduleByDay: Map<number, WeeklySchedule[]>,
  now: Date,
): CurrentAndNext {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayDow = now.getDay()
  const daySchedule = scheduleByDay.get(todayDow) ?? []

  const cur =
    daySchedule.find(
      (s) => nowMin >= toMin(s.start_time) && nowMin < toMin(s.end_time),
    ) ?? null
  const afterMin = cur ? toMin(cur.end_time) : nowMin

  const todayNext =
    daySchedule.find((s) => toMin(s.start_time) >= afterMin) ?? null

  let nxt: WeeklySchedule | null = todayNext
  let offset = 0
  if (!todayNext) {
    for (let i = 1; i <= 7; i++) {
      const dow = (todayDow + i) % 7
      const arr = scheduleByDay.get(dow) ?? []
      if (arr.length > 0) {
        nxt = arr[0]
        offset = i
        break
      }
    }
  }

  return {
    currentSession: cur,
    nextSession: nxt,
    nextOffset: offset,
    minsRemaining: cur ? toMin(cur.end_time) - nowMin : 0,
    minsUntil: nxt && offset === 0 ? toMin(nxt.start_time) - nowMin : 0,
  }
}

const DAY_SHORT_KEYS = [
  'dayShort.sun',
  'dayShort.mon',
  'dayShort.tue',
  'dayShort.wed',
  'dayShort.thu',
  'dayShort.fri',
  'dayShort.sat',
] as const

// Human label for a next-session offset. 0 is "today" (don't use this —
// countdown is more useful there); 1 = 明天, 2..6 = 周X, 7 = 下周X.
export function relativeDayLabel(
  offset: number,
  sessionDow: number,
  t: TFn,
): string {
  if (offset === 1) return t('relativeDay.tomorrow')
  const day = t(DAY_SHORT_KEYS[sessionDow])
  if (offset >= 2 && offset <= 6) return t('relativeDay.thisWeek', { day })
  if (offset === 7) return t('relativeDay.nextWeek', { day })
  return ''
}
