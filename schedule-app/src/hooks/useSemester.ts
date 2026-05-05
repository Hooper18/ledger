import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import type { Semester } from '../lib/types'

export function useSemester() {
  const { user } = useAuth()
  // 初始 state 直接从 localStorage 读上次的快照 —— 重载/下拉刷新时
  // 第一次 render 就有数据，不会先闪一下空状态。
  const cached = loadCache<Semester>('semester')
  const [semester, setSemester] = useState<Semester | null>(cached)
  const [loading, setLoading] = useState(!cached)
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
    if (!error) {
      const next = (data as Semester) ?? null
      setSemester(next)
      saveCache('semester', next)
      setLastSyncedAt(recordSync('semester'))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return { semester, loading, error, reload: load, lastSyncedAt }
}
