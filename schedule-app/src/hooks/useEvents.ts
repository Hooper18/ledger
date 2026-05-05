import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
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
      return next
    })
  }, [])

  return { events, loading, error, reload: load, setStatus, remove, lastSyncedAt }
}
