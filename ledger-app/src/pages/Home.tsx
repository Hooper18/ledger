import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { CURRENCY_SYMBOLS } from '../types'
import type { Currency, TxDetail, TransactionType } from '../types'
import TransactionSheet from '../components/TransactionSheet'

const DISPLAY_CURRENCIES: Currency[] = ['MYR', 'CNY', 'USD', 'SGD']
const LS_KEY = 'ledger_display_currency'
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatDateLabel(dateStr: string): string {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const yestStr = yest.toISOString().split('T')[0]
  if (dateStr === todayStr) return '今天'
  if (dateStr === yestStr)  return '昨天'
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`
}

interface FilterState {
  keyword: string
  dateFrom: string
  dateTo: string
  types: Set<TransactionType>
  categoryIds: Set<string>
}

const EMPTY_FILTER: FilterState = {
  keyword: '', dateFrom: '', dateTo: '',
  types: new Set(), categoryIds: new Set(),
}

function isFilterActive(f: FilterState) {
  return f.keyword.trim() !== '' || f.dateFrom !== '' || f.dateTo !== '' ||
    f.types.size > 0 || f.categoryIds.size > 0
}

const TX_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense',  label: '支出' },
  { value: 'income',   label: '收入' },
  { value: 'transfer', label: '转账' },
]

export default function Home() {
const { user } = useAuth()
  const { rates, ratesLoading } = useCurrency()

  // ── display currency ──
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(() =>
    (localStorage.getItem(LS_KEY) as Currency) ?? 'MYR'
  )
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem(LS_KEY, displayCurrency) }, [displayCurrency])

  useEffect(() => {
    if (!showPicker) return
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showPicker])

  function convertTo(amount: number, from: string): number {
    if (from === displayCurrency) return amount
    return (amount / (rates[from] ?? 1)) * (rates[displayCurrency] ?? 1)
  }

  // ── month navigation ──
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  function changeMonth(delta: number) {
    let m = month + delta, y = year
    if (m > 12) { m = 1;  y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  // ── fetch transactions ──
  const [transactions, setTransactions] = useState<TxDetail[]>([])
  const [loading, setLoading] = useState(true)

  function fetchTransactions() {
    if (!user) return
    setLoading(true)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const nm = month === 12 ? 1 : month + 1
    const ny = month === 12 ? year + 1 : year
    const end = `${ny}-${String(nm).padStart(2, '0')}-01`

    supabase
      .from('transactions')
      .select('id, type, amount, currency, description, date, category_id, categories(name, icon)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setTransactions(data as TxDetail[])
        setLoading(false)
      })
  }

  useEffect(() => { fetchTransactions() }, [user, year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── selected transaction sheet ──
  const [selectedTx, setSelectedTx] = useState<TxDetail | null>(null)

  function handleDeleted(id: string) {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  // ── totals (always full month, unaffected by filter) ──
  const { expenseTotal, incomeTotal } = transactions.reduce(
    (acc, tx) => {
      const v = convertTo(tx.amount, tx.currency)
      if (tx.type === 'expense') acc.expenseTotal += v
      if (tx.type === 'income')  acc.incomeTotal  += v
      return acc
    },
    { expenseTotal: 0, incomeTotal: 0 },
  )
  const balance = incomeTotal - expenseTotal
  const symbol  = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // ── total budget (for home bar) ──
  const [totalBudget, setTotalBudget] = useState<{ amount: number; currency: string } | null>(null)

  useEffect(() => {
    if (!user) return
    const period = `${year}-${String(month).padStart(2, '0')}`
    supabase.from('budgets')
      .select('amount, currency')
      .eq('user_id', user.id)
      .eq('period', period)
      .is('category_id', null)
      .maybeSingle()
      .then(({ data }) => setTotalBudget(data))
  }, [user, year, month])

  // ── search & filter state ──
  const [keyword, setKeyword]       = useState('')
  const [showFilter, setShowFilter] = useState(false)

  // draft filter (edited inside panel, applied on confirm)
  const [draft, setDraft] = useState<FilterState>({ ...EMPTY_FILTER })
  // applied filter (drives the list)
  const [applied, setApplied] = useState<FilterState>({ ...EMPTY_FILTER })

  const active = isFilterActive(applied) || keyword.trim() !== ''

  function openFilter() {
    setDraft({ ...applied })
    setShowFilter(true)
  }

  function confirmFilter() {
    setApplied({ ...draft })
    setShowFilter(false)
  }

  function resetFilter() {
    const empty = { ...EMPTY_FILTER, types: new Set<TransactionType>(), categoryIds: new Set<string>() }
    setDraft(empty)
    setApplied(empty)
    setKeyword('')
    setShowFilter(false)
  }

  function toggleDraftType(t: TransactionType) {
    setDraft(prev => {
      const s = new Set(prev.types)
      s.has(t) ? s.delete(t) : s.add(t)
      return { ...prev, types: s }
    })
  }

  function toggleDraftCat(id: string) {
    setDraft(prev => {
      const s = new Set(prev.categoryIds)
      s.has(id) ? s.delete(id) : s.add(id)
      return { ...prev, categoryIds: s }
    })
  }

  // unique categories from current month's transactions (for filter panel)
  const uniqueCats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string }>()
    for (const tx of transactions) {
      if (!map.has(tx.category_id) && tx.categories) {
        map.set(tx.category_id, { id: tx.category_id, name: tx.categories.name, icon: tx.categories.icon })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [transactions])

  // ── filtered transactions ──
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return transactions.filter(tx => {
      if (kw && !(tx.description ?? '').toLowerCase().includes(kw)) return false
      if (applied.dateFrom && tx.date < applied.dateFrom) return false
      if (applied.dateTo   && tx.date > applied.dateTo)   return false
      if (applied.types.size > 0 && !applied.types.has(tx.type as TransactionType)) return false
      if (applied.categoryIds.size > 0 && !applied.categoryIds.has(tx.category_id)) return false
      return true
    })
  }, [transactions, keyword, applied])

  // ── group by date ──
  const grouped: Record<string, TxDetail[]> = {}
  for (const tx of filtered) {
    if (!grouped[tx.date]) grouped[tx.date] = []
    grouped[tx.date].push(tx)
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="text-white px-5 pt-4 pb-16 relative overflow-hidden safe-top"
        style={{ background: 'linear-gradient(135deg, #e53e3e 0%, #c0392b 100%)' }}>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold">{year}年{month}月</span>
          <button onClick={() => changeMonth(1)} disabled={isCurrentMonth}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>

        <p className="text-xs text-red-200 mb-1">本月支出</p>

        <div className="flex items-baseline gap-2 mb-4">
          <div className="relative" ref={pickerRef}>
            <button onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-0.5 bg-white/20 hover:bg-white/30 active:bg-white/30 rounded-lg px-2 py-1 transition-colors">
              <span className="text-base font-semibold">{displayCurrency}</span>
              <ChevronDown size={13} className={`transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>
            {showPicker && (
              <div className="absolute top-full left-0 mt-1.5 bg-white rounded-xl shadow-xl overflow-hidden z-50 min-w-[110px]">
                {DISPLAY_CURRENCIES.map(c => (
                  <button key={c} onClick={() => { setDisplayCurrency(c); setShowPicker(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                      c === displayCurrency ? 'text-primary font-semibold bg-red-50' : 'text-gray-700'
                    }`}>
                    <span className="w-7 text-gray-400">{CURRENCY_SYMBOLS[c]}</span>
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-4xl font-bold tracking-tight">
            {ratesLoading ? '…' : fmt(expenseTotal)}
          </span>
        </div>

        <div className="flex gap-8">
          <div>
            <p className="text-xs text-red-200 mb-0.5">收入</p>
            <p className="text-base font-semibold">{symbol} {fmt(incomeTotal)}</p>
          </div>
          <div className="w-px bg-red-400/40" />
          <div>
            <p className="text-xs text-red-200 mb-0.5">结余</p>
            <p className={`text-base font-semibold ${balance < 0 ? 'text-red-200' : ''}`}>
              {symbol} {fmt(balance)}
            </p>
          </div>
        </div>

        {/* Budget bar */}
        {totalBudget && !ratesLoading && (() => {
          const budgetAmt = convertTo(totalBudget.amount, totalBudget.currency)
          const pct = Math.min((expenseTotal / budgetAmt) * 100, 100)
          const isOver = expenseTotal > budgetAmt
          return (
            <div className="mt-3 pt-3 border-t border-red-400/30">
              <div className="flex justify-between text-xs text-red-200 mb-1.5">
                <span>月度预算</span>
                <span className={isOver ? 'text-white font-semibold' : ''}>
                  {isOver ? '⚠ 超出预算' : `${Math.round(pct)}% 已使用`}
                </span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-white' : 'bg-white/80'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── Transaction list ── */}
      <div className="flex-1 -mt-8 mx-4 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">

        {/* List header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <span className="text-sm font-semibold text-gray-700">账单明细</span>
          <span className="text-xs text-gray-400">{filtered.length} 笔</span>
        </div>

        {/* ── Search bar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索备注关键词..."
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="shrink-0">
                <X size={13} className="text-gray-400" />
              </button>
            )}
          </div>
          {/* Filter button */}
          <button
            onClick={openFilter}
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              active ? 'bg-[#e53935] text-white' : 'bg-gray-50 text-gray-500'
            }`}
          >
            <SlidersHorizontal size={16} />
            {isFilterActive(applied) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#e53935] rounded-full border-2 border-white" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-4xl mb-3">{transactions.length === 0 ? '📋' : '🔍'}</span>
              <p className="text-sm">{transactions.length === 0 ? '本月暂无记录' : '没有符合条件的记录'}</p>
              {transactions.length === 0
                ? <p className="text-xs mt-1">点击底部 + 开始记账吧</p>
                : <button onClick={resetFilter} className="text-xs mt-2 text-[#e53935]">清除筛选</button>
              }
            </div>
          ) : (
            sortedDates.map(date => {
              const dayTxs = grouped[date]
              const dayExpense = dayTxs
                .filter(t => t.type === 'expense')
                .reduce((s, t) => s + convertTo(t.amount, t.currency), 0)

              return (
                <div key={date}>
                  <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs text-gray-500">{formatDateLabel(date)}</span>
                    {dayExpense > 0 && (
                      <span className="text-xs text-red-400">{symbol} {fmt(dayExpense)}</span>
                    )}
                  </div>

                  {dayTxs.map(tx => {
                    const converted = convertTo(tx.amount, tx.currency)
                    const isExpense = tx.type === 'expense'
                    const isIncome  = tx.type === 'income'
                    const origSymbol = CURRENCY_SYMBOLS[tx.currency as Currency] ?? tx.currency

                    return (
                      <button key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="w-full flex items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50 text-left">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl shrink-0 mr-3">
                          {tx.categories?.icon ?? '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {tx.categories?.name ?? '未分类'}
                          </p>
                          {tx.description && (
                            <p className="text-xs text-gray-400 truncate">{tx.description}</p>
                          )}
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <p className={`text-sm font-semibold ${
                            isExpense ? 'text-red-500' : isIncome ? 'text-green-500' : 'text-blue-500'
                          }`}>
                            {isExpense ? '-' : '+'}{symbol} {fmt(converted)}
                          </p>
                          {tx.currency !== displayCurrency && (
                            <p className="text-[10px] text-gray-400">{origSymbol} {fmt(tx.amount)}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

      </div>

      <div className="h-4 shrink-0" />

      {/* Transaction detail sheet */}
      {selectedTx && (
        <TransactionSheet
          tx={selectedTx}
          displayCurrency={displayCurrency}
          onClose={() => setSelectedTx(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── Filter panel (bottom sheet via portal) ── */}
      {showFilter && createPortal(
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowFilter(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-2xl z-50 flex flex-col max-h-[85vh]"
            style={{ animation: 'slideUp .22s ease' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-800">筛选</h2>
              <button onClick={() => setShowFilter(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* Date range */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">日期范围</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={draft.dateFrom}
                    max={draft.dateTo || undefined}
                    onChange={e => setDraft(p => ({ ...p, dateFrom: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-[#e53935] transition-colors"
                  />
                  <span className="text-gray-400 text-sm shrink-0">至</span>
                  <input
                    type="date"
                    value={draft.dateTo}
                    min={draft.dateFrom || undefined}
                    onChange={e => setDraft(p => ({ ...p, dateTo: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-[#e53935] transition-colors"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">类型</p>
                <div className="flex gap-2">
                  {TX_TYPES.map(({ value, label }) => {
                    const on = draft.types.has(value)
                    return (
                      <button key={value} onClick={() => toggleDraftType(value)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          on ? 'bg-[#e53935] border-[#e53935] text-white' : 'bg-white border-gray-200 text-gray-500'
                        }`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Category */}
              {uniqueCats.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">分类</p>
                  <div className="grid grid-cols-5 gap-1">
                    {uniqueCats.map(cat => {
                      const on = draft.categoryIds.has(cat.id)
                      return (
                        <button key={cat.id} onClick={() => toggleDraftCat(cat.id)}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors ${on ? 'bg-red-50' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${
                            on ? 'bg-[#e53935]' : 'bg-gray-100'
                          }`}>
                            {cat.icon}
                          </div>
                          <span className={`text-[10px] leading-tight text-center break-all ${
                            on ? 'text-[#e53935] font-semibold' : 'text-gray-500'
                          }`}>
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="shrink-0 border-t border-gray-100 px-4 pt-3 pb-8 flex gap-3">
              <button onClick={resetFilter}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold active:bg-gray-200 transition-colors">
                重置
              </button>
              <button onClick={confirmFilter}
                className="flex-1 py-3 bg-[#e53935] text-white rounded-xl text-sm font-semibold active:opacity-90 transition-opacity">
                确认筛选
              </button>
            </div>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
        </>,
        document.body,
      )}
    </div>
  )
}
