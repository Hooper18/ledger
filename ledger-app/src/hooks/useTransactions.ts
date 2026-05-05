import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import { subscribeRefresh, sync as runSync } from '../lib/sync'
import * as outbox from '../lib/outbox'
import type { Database } from '../lib/database.types'

export type DbTransaction = Database['public']['Tables']['transactions']['Row']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

const CACHE_KEY = 'transactions'

/**
 * 全量加载用户的所有 transactions 一次进内存 + localStorage。数据量小
 * （一年几百条 transaction，每条 < 200B），过滤、聚合都在 JS 里做，
 * 比按月一次 query 更适合离线场景 —— 切换月份不需要再打 Supabase。
 *
 * 写操作走 outbox：先更新本地 state + cache 让 UI 立刻反应，再异步推
 * 服务器。离线时也能记账，恢复网络后自动同步。
 */
export function useTransactions() {
  const { user } = useAuth()
  const cached = loadCache<DbTransaction[]>(CACHE_KEY) ?? []
  const [transactions, setTransactions] = useState<DbTransaction[]>(cached)
  const [loading, setLoading] = useState(cached.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('transactions'),
  )

  const reload = useCallback(async () => {
    if (!user) {
      setTransactions([])
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    if (!error && data) {
      const list = data as DbTransaction[]
      setTransactions(list)
      saveCache(CACHE_KEY, list)
      setLastSyncedAt(recordSync('transactions'))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => subscribeRefresh(reload), [reload])

  /** 创建新 transaction：本地立刻显示 + 入队 outbox + 触发同步。 */
  const insert = useCallback(
    async (input: Omit<TransactionInsert, 'user_id' | 'id' | 'created_at' | 'updated_at'>) => {
      if (!user) return { error: '未登录' as const }
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const row: DbTransaction = {
        id,
        user_id: user.id,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        category_id: input.category_id,
        description: input.description ?? null,
        date: input.date,
        exchange_rate: input.exchange_rate ?? null,
        created_at: now,
        updated_at: now,
      }
      setTransactions((prev) => {
        const next = [row, ...prev]
        saveCache(CACHE_KEY, next)
        return next
      })
      outbox.enqueue({ op: 'insert', table: 'transactions', row })
      void runSync()
      return { error: null, id }
    },
    [user],
  )

  /** 更新已有 transaction。 */
  const update = useCallback(async (id: string, patch: TransactionUpdate) => {
    const now = new Date().toISOString()
    const cleaned = { ...patch, updated_at: now }
    setTransactions((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...cleaned } as DbTransaction : t))
      saveCache(CACHE_KEY, next)
      return next
    })
    outbox.enqueue({ op: 'update', table: 'transactions', rowId: id, row: cleaned })
    void runSync()
    return { error: null }
  }, [])

  const remove = useCallback(async (id: string) => {
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== id)
      saveCache(CACHE_KEY, next)
      return next
    })
    outbox.enqueue({ op: 'delete', table: 'transactions', rowId: id })
    void runSync()
    return { error: null }
  }, [])

  return {
    transactions,
    loading,
    error,
    reload,
    lastSyncedAt,
    insert,
    update,
    remove,
  }
}
