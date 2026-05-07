import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import { syncNotifications } from '../lib/notifications'
import { syncWidget } from '../lib/widgetSync'
import type { Event, EventStatus } from '../lib/types'

export function useEvents(semesterId: string | null | undefined) {
  const { user } = useAuth()
  const cached = loadCache<Event[]>('events') ?? []
  const [events, setEvents] = useState<Event[]>(cached)
  const [loading, setLoading] = useState(cached.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('events'),
  )

  const load = useCallback(async () => {
    if (!user || !semesterId) {
      setEvents([])
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester_id', semesterId)
      .order('date', { ascending: true, nullsFirst: false })
      .order('time', { ascending: true, nullsFirst: false })
      .order('sort_order')
    if (error) setError(error.message)
    if (!error) {
      const list = (data ?? []) as Event[]
      setEvents(list)
      saveCache('events', list)
      setLastSyncedAt(recordSync('events'))
      // 拿到最新事件后顺手同步本地通知（仅在 Capacitor 原生上下文生效）。
      syncNotifications(list).catch(() => {
        // 通知失败不影响主流程，吞掉。
      })
      // 桌面 widget 同步：仅 Android 原生平台生效，函数内部已做平台判断。
      syncWidget(list).catch(() => {})
    }
    setLoading(false)
  }, [user, semesterId])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = useCallback(
    async (id: string, status: EventStatus) => {
      const { error } = await supabase
        .from('events')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        setError(error.message)
        return
      }
      setEvents((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, status } : e))
        saveCache('events', next)
        // 状态变成 completed/cancelled 后该事件不再需要提醒，widget 也要刷掉。
        syncNotifications(next).catch(() => {})
        syncWidget(next).catch(() => {})
        return next
      })
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id)
      saveCache('events', next)
      syncNotifications(next).catch(() => {})
      syncWidget(next).catch(() => {})
      return next
    })
  }, [])

  return { events, loading, error, reload: load, setStatus, remove, lastSyncedAt }
}
