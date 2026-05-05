import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import type { AcademicCalendar } from '../lib/types'

export function useCalendar(semesterId: string | null | undefined) {
  const cached = loadCache<AcademicCalendar[]>('calendar') ?? []
  const [entries, setEntries] = useState<AcademicCalendar[]>(cached)
  const [loading, setLoading] = useState(cached.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('calendar'),
  )

  const load = useCallback(async () => {
    if (!semesterId) {
      setEntries([])
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('academic_calendar')
      .select('*')
      .eq('semester_id', semesterId)
      .order('date', { ascending: true })
    if (error) setError(error.message)
    if (!error) {
      const list = (data ?? []) as AcademicCalendar[]
      setEntries(list)
      saveCache('calendar', list)
      setLastSyncedAt(recordSync('calendar'))
    }
    setLoading(false)
  }, [semesterId])

  useEffect(() => {
    load()
  }, [load])

  return { entries, loading, error, reload: load, lastSyncedAt }
}
