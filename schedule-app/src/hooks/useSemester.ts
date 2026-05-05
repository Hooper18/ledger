import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import type { Semester } from '../lib/types'

export function useSemester() {
  const { user } = useAuth()
  const [semester, setSemester] = useState<Semester | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('semester'),
  )

  const load = useCallback(async () => {
    if (!user) {
      setSemester(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('semesters')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) setError(error.message)
    setSemester((data as Semester) ?? null)
    if (!error) setLastSyncedAt(recordSync('semester'))
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return { semester, loading, error, reload: load, lastSyncedAt }
}
