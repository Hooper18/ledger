import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import { subscribeRefresh } from '../lib/sync'
import type { Database } from '../lib/database.types'

export type DbCategory = Database['public']['Tables']['categories']['Row']

const CACHE_KEY = 'categories'

/**
 * Categories 几乎不会变（注册时由触发器创建好默认分类，用户极少自定义），
 * 主要是为了让 UI 拿到 name + icon 跟 transactions 做 client-side join。
 */
export function useCategories() {
  const { user } = useAuth()
  const cached = loadCache<DbCategory[]>(CACHE_KEY) ?? []
  const [categories, setCategories] = useState<DbCategory[]>(cached)
  const [loading, setLoading] = useState(cached.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('categories'),
  )

  const reload = useCallback(async () => {
    if (!user) {
      setCategories([])
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    if (!error && data) {
      const list = data as DbCategory[]
      setCategories(list)
      saveCache(CACHE_KEY, list)
      setLastSyncedAt(recordSync('categories'))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => subscribeRefresh(reload), [reload])

  return { categories, loading, error, reload, lastSyncedAt }
}
