import { useCallback, useEffect, useState } from 'react'
import type { TransactionType } from '../types'

// 记账类目展示顺序的两种模式，本地偏好（不跨设备）。
//   · custom：用户在「管理类目顺序」里上下移动决定的顺序；没排过就保留
//             useCategories 返回的服务端 created_at 升序，跟早期版本对齐。
//   · recent：最近一次记账用过的类目排最前。"最近"由 caller 从交易记录
//             表（useTransactions）算出 `lastUsedAt: { [categoryId]: ISO }`
//             传进来 —— 比单独维护一份 localStorage map 准（自动覆盖历史
//             交易），且少一处状态需要同步。
//
// 多个组件（Settings / AddTransaction / CategoryOrder）会同时挂这个 hook，
// 写操作通过 window 事件广播，让所有实例都 re-read localStorage。

const MODE_KEY = 'ledger_category_sort_mode'
const CUSTOM_ORDER_KEY = 'ledger_category_custom_order'
const CHANGE_EVENT = 'ledger:category-sort-changed'

export type CategorySortMode = 'custom' | 'recent'
export type CustomOrderMap = Record<TransactionType, string[]>

const EMPTY_CUSTOM: CustomOrderMap = { expense: [], income: [], transfer: [] }

function readMode(): CategorySortMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'recent' ? 'recent' : 'custom'
  } catch {
    return 'custom'
  }
}

function readCustom(): CustomOrderMap {
  try {
    const s = localStorage.getItem(CUSTOM_ORDER_KEY)
    if (!s) return { ...EMPTY_CUSTOM }
    const p = JSON.parse(s) as Partial<CustomOrderMap>
    return {
      expense: Array.isArray(p.expense) ? p.expense : [],
      income: Array.isArray(p.income) ? p.income : [],
      transfer: Array.isArray(p.transfer) ? p.transfer : [],
    }
  } catch {
    return { ...EMPTY_CUSTOM }
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

interface SortableCategory {
  id: string
  name: string
  icon: string
}

export function useCategorySort() {
  const [mode, setModeState] = useState<CategorySortMode>(readMode)
  const [customOrder, setCustomOrderState] = useState<CustomOrderMap>(readCustom)

  useEffect(() => {
    const handler = () => {
      setModeState(readMode())
      setCustomOrderState(readCustom())
    }
    window.addEventListener(CHANGE_EVENT, handler)
    return () => window.removeEventListener(CHANGE_EVENT, handler)
  }, [])

  const setMode = useCallback((m: CategorySortMode) => {
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // localStorage 不可用：UI 仍能切换，刷新后回到默认
    }
    setModeState(m)
    notify()
  }, [])

  const setCustomOrder = useCallback(
    (type: TransactionType, ids: string[]) => {
      setCustomOrderState((prev) => {
        const next = { ...prev, [type]: ids }
        try {
          localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(next))
        } catch {
          // 同上
        }
        return next
      })
      notify()
    },
    [],
  )

  // 排序：
  // · recent 模式：按 lastUsedAt 倒序排；caller 从 useTransactions() 的
  //   transactions 数组算出 { [categoryId]: max(created_at) } 传进来。
  //   没记录的统一排到后面，保持入参相对顺序（稳定排序）。
  // · custom 模式：按用户存的 ID 顺序；没排过就保留入参顺序（=服务端
  //   created_at 升序，跟早期版本完全一致）。
  const applySort = useCallback(
    <T extends SortableCategory>(
      cats: T[],
      type: TransactionType,
      lastUsedAt?: Record<string, string>,
    ): T[] => {
      if (cats.length === 0) return cats
      if (mode === 'recent') {
        const map = lastUsedAt ?? {}
        return [...cats].sort((a, b) => {
          const ta = map[a.id] ?? ''
          const tb = map[b.id] ?? ''
          if (tb > ta) return 1
          if (tb < ta) return -1
          return 0
        })
      }
      const order = customOrder[type] ?? []
      if (order.length === 0) return cats
      const idx = new Map(order.map((id, i) => [id, i]))
      return [...cats].sort((a, b) => {
        const ia = idx.has(a.id) ? idx.get(a.id)! : Number.MAX_SAFE_INTEGER
        const ib = idx.has(b.id) ? idx.get(b.id)! : Number.MAX_SAFE_INTEGER
        return ia - ib
      })
    },
    [mode, customOrder],
  )

  return { mode, setMode, customOrder, setCustomOrder, applySort }
}
