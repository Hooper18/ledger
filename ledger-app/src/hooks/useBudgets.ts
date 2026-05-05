import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import { subscribeRefresh, sync as runSync } from '../lib/sync'
import * as outbox from '../lib/outbox'
import type { Database } from '../lib/database.types'

export type DbBudget = Database['public']['Tables']['budgets']['Row']
type BudgetInsert = Database['public']['Tables']['budgets']['Insert']

const CACHE_KEY = 'budgets'

export function useBudgets() {
  const { user } = useAuth()
  const cached = loadCache<DbBudget[]>(CACHE_KEY) ?? []
  const [budgets, setBudgets] = useState<DbBudget[]>(cached)
  const [loading, setLoading] = useState(cached.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('budgets'),
  )

  const reload = useCallback(async () => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
    if (error) setError(error.message)
    if (!error && data) {
      const list = data as DbBudget[]
      setBudgets(list)
      saveCache(CACHE_KEY, list)
      setLastSyncedAt(recordSync('budgets'))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => subscribeRefresh(reload), [reload])

  /**
   * Upsert 一个 budget。基于 (user_id, period, category_id) 唯一性 ——
   * 同月 / 同分类已存在则覆盖，否则插入。
   */
  const upsert = useCallback(
    async (input: Omit<BudgetInsert, 'user_id' | 'id' | 'created_at'>) => {
      if (!user) return { error: '未登录' as const }
      const now = new Date().toISOString()
      // 本地：先看是否有匹配的现有记录（同 period + 同 category_id）
      const existing = budgets.find(
        (b) =>
          b.period === input.period &&
          (b.category_id ?? null) === (input.category_id ?? null),
      )
      const id = existing?.id ?? crypto.randomUUID()
      const row: DbBudget = {
        id,
        user_id: user.id,
        category_id: input.category_id ?? null,
        amount: input.amount,
        currency: input.currency,
        period: input.period,
        created_at: existing?.created_at ?? now,
      }
      setBudgets((prev) => {
        const next = existing
          ? prev.map((b) => (b.id === id ? row : b))
          : [...prev, row]
        saveCache(CACHE_KEY, next)
        return next
      })
      outbox.enqueue({
        op: 'upsert',
        table: 'budgets',
        row,
        onConflict: 'user_id,period,category_id',
      })
      void runSync()
      return { error: null, id }
    },
    [user, budgets],
  )

  const remove = useCallback(async (id: string) => {
    setBudgets((prev) => {
      const next = prev.filter((b) => b.id !== id)
      saveCache(CACHE_KEY, next)
      return next
    })
    outbox.enqueue({ op: 'delete', table: 'budgets', rowId: id })
    void runSync()
    return { error: null }
  }, [])

  return { budgets, loading, error, reload, lastSyncedAt, upsert, remove }
}
