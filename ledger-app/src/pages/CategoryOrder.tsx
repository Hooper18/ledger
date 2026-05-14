import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react'
import { useCategories } from '../hooks/useCategories'
import { useCategorySort } from '../hooks/useCategorySort'
import { useLanguage } from '../contexts/LanguageContext'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORIES,
  CATEGORY_ICONS,
} from '../types'
import type { TransactionType } from '../types'

interface Row { id: string; name: string; icon: string }

function buildFallback(type: TransactionType): Row[] {
  const names =
    type === 'expense' ? EXPENSE_CATEGORIES :
    type === 'income'  ? INCOME_CATEGORIES  : TRANSFER_CATEGORIES
  return names.map((name, i) => ({ id: String(i), name, icon: CATEGORY_ICONS[name] ?? '📦' }))
}

export default function CategoryOrder() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { categories: allCats } = useCategories()
  const { customOrder, setCustomOrder } = useCategorySort()

  const [type, setType] = useState<TransactionType>('expense')

  // 当前 type 的展示列表：先按 useCategories 的服务端顺序拿到候选，再按
  // customOrder 排（没排过就用服务端顺序）。新出现的类目（custom 里没记
  // 的）追加到末尾，让用户能看到并调整。
  const rows = useMemo<Row[]>(() => {
    const filtered = allCats.filter((c) => c.type === type)
    const base: Row[] =
      filtered.length === 0
        ? buildFallback(type)
        : filtered.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))
    const order = customOrder[type] ?? []
    if (order.length === 0) return base
    const idx = new Map(order.map((id, i) => [id, i]))
    return [...base].sort((a, b) => {
      const ia = idx.has(a.id) ? idx.get(a.id)! : Number.MAX_SAFE_INTEGER
      const ib = idx.has(b.id) ? idx.get(b.id)! : Number.MAX_SAFE_INTEGER
      return ia - ib
    })
  }, [allCats, type, customOrder])

  function move(index: number, delta: number) {
    const next = rows.slice()
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setCustomOrder(type, next.map((r) => r.id))
  }

  const TYPE_TABS: { value: TransactionType; label: string; active: string }[] = [
    { value: 'expense',  label: t('expense'),  active: 'text-red-500 border-red-500' },
    { value: 'income',   label: t('income'),   active: 'text-green-500 border-green-500' },
    { value: 'transfer', label: t('transfer'), active: 'text-blue-500 border-blue-500' },
  ]

  return (
    <div className="anim-page flex flex-col h-full bg-white">

      {/* Header */}
      <div className="flex items-center px-2 pt-4 pb-3 border-b border-gray-100 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2" aria-label={t('backAriaLabel')}>
          <ChevronLeft size={22} className="text-gray-600" />
        </button>
        <h1 className="flex-1 text-base font-semibold text-center -ml-9">{t('categoryOrderTitle')}</h1>
      </div>

      {/* Type tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setType(tab.value)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              type === tab.value ? tab.active : 'text-gray-400 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reorderable list */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">{t('categoryOrderEmpty')}</p>
        ) : (
          <ul>
            {rows.map((row, i) => (
              <li
                key={row.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg shrink-0">
                  {row.icon}
                </span>
                <span className="flex-1 text-sm text-gray-800 truncate">{row.name}</span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={t('categoryOrderUp')}
                  className="p-2 rounded-lg active:bg-gray-100 active:scale-90 transition-transform disabled:opacity-30 disabled:active:bg-transparent disabled:active:scale-100"
                >
                  <ChevronUp size={18} className="text-gray-600" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={t('categoryOrderDown')}
                  className="p-2 rounded-lg active:bg-gray-100 active:scale-90 transition-transform disabled:opacity-30 disabled:active:bg-transparent disabled:active:scale-100"
                >
                  <ChevronDown size={18} className="text-gray-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
