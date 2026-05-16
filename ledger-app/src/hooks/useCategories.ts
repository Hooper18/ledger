import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import { subscribeRefresh } from '../lib/sync'
import * as outbox from '../lib/outbox'
import type { Database } from '../lib/database.types'

export type DbCategory = Database['public']['Tables']['categories']['Row']

const CACHE_KEY = 'categories'

// 老 DB 行里 name='宠物'（旧版叫法）在读路径统一归一为'水果'/🍎。即便
// 数据库 UPDATE 因为任何原因没跑成（被 RLS 静默吞 / 网络异常），UI 也
// 一定显示新名字 —— 不依赖任何写路径成功。
function normalizePet(rows: DbCategory[]): DbCategory[] {
  let dirty = false
  const out = rows.map((c) => {
    if (c.name === '宠物') {
      dirty = true
      return { ...c, name: '水果', icon: '🍎' }
    }
    return c
  })
  return dirty ? out : rows
}

/**
 * Categories 几乎不会变（注册时由触发器创建好默认分类，用户极少自定义），
 * 主要是为了让 UI 拿到 name + icon 跟 transactions 做 client-side join。
 */
export function useCategories() {
  const { user } = useAuth()
  const cached = normalizePet(loadCache<DbCategory[]>(CACHE_KEY) ?? [])
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
      const list = normalizePet(outbox.applyOutboxTo('categories', data as DbCategory[]))
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
