import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from '../types'
import type { Currency, TxDetail, TransactionType } from '../types'
import type { TranslationKey } from '../lib/i18n'
import TransactionSheet from '../components/TransactionSheet'

const DISPLAY_CURRENCIES = SUPPORTED_CURRENCIES
const LS_KEY = 'ledger_display_currency'

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

export default function Home() {
const { user } = useAuth()
  const { baseCurrency, rates, ratesLoading } = useCurrency()
  const { t, lang } = useLanguage()

  const TX_TYPES: { value: TransactionType; label: string }[] = [
    { value: 'expense',  label: t('expense') },
    { value: 'income',   label: t('income') },
    { value: 'transfer', label: t('transfer') },
  ]

  function formatDateLabel(dateStr: string): string {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const yest = new Date(now); yest.setDate(now.getDate() - 1)
    const yestStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`
    if (dateStr === todayStr) return t('today')
    if (dateStr === yestStr)  return t('yesterday')
    const d = new Date(dateStr + 'T00:00:00')
    const wd = t(`weekday${d.getDay()}` as TranslationKey)
    if (lang === 'zh') return `${d.getMonth() + 1}月${d.getDate()}日 ${wd}`
    return `${d.getMonth() + 1}/${d.getDate()} ${wd}`
  }

  // ── display currency ──
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(() =>
    (localStorage.getItem(LS_KEY) as Currency) ?? 'CNY'
  )
  const [showPicker, setShowPicker] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem(LS_KEY, displayCurrency) }, [displayCurrency])

  // Sync to baseCurrency whenever the user updates their preferred currency in Settings
  useEffect(() => { setDisplayCurrency(baseCurrency) }, [baseCurrency])

  function convertTo(amount: number, from: string): number {
    if (from === displayCurrency) return amount
    return (amount / (rates[from] ?? 1)) * (rates[displayCurrency] ?? 1)
  }

  function convertTx(tx: { amount: number; currency: string; exchange_rate?: number | null }): number {
    if (tx.exchange_rate != null) {
      const toBase = tx.amount / tx.exchange_rate
      if (displayCurrency === baseCurrency) return toBase
      return (toBase / (rates[baseCurrency] ?? 1)) * (rates[displayCurrency] ?? 1)
    }
    return convertTo(tx.amount, tx.currency)
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
      .select('id, type, amount, currency, description, date, category_id, exchange_rate, categories(name, icon)')
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
      const v = convertTx(tx)
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

  function toggleDraftType(type: TransactionType) {
    setDraft(prev => {
      const s = new Set(prev.types)
      s.has(type) ? s.delete(type) : s.add(type)
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

  const txCountLabel = t('txCountSuffix') ? `${filtered.length} ${t('txCountSuffix')}` : String(filtered.length)

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="text-white px-5 pt-4 pb-16 relative overflow-hidden safe-top"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.35)), url('/images/header-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold">{t('yearMonthFmt', { year, month })}</span>
          <button onClick={() => changeMonth(1)} disabled={isCurrentMonth}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>

        <p className="text-xs text-white/70 mb-1">{t('monthlyExpense')}</p>

        <div className="flex items-baseline gap-2 mb-4">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => {
                if (!showPicker && pickerRef.current) {
                  const r = pickerRef.current.getBoundingClientRect()
                  setPickerPos({ top: r.bottom + 6, left: r.left })
                }
                setShowPicker(v => !v)
              }}
              className="flex items-center gap-0.5 bg-white/20 hover:bg-white/30 active:bg-white/30 rounded-lg px-2 py-1 transition-colors">
              <span className="text-base font-semibold">{displayCurrency}</span>
              <ChevronDown size={13} className={`transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <span className="text-4xl font-bold tracking-tight">
            {ratesLoading ? '…' : fmt(expenseTotal)}
          </span>
        </div>

        <div className="flex gap-8">
          <div>
            <p className="text-xs text-white/70 mb-0.5">{t('income')}</p>
            <p className="text-base font-semibold">{symbol} {fmt(incomeTotal)}</p>
          </div>
          <div className="w-px bg-red-400/40" />
          <div>
            <p className="text-xs text-white/70 mb-0.5">{t('balance')}</p>
            <p className={`text-base font-semibold ${balance < 0 ? 'text-white/60' : ''}`}>
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
            <div className="mt-3 pt-3 border-t border-white/30">
              <div className="flex justify-between text-xs text-white/70 mb-1.5">
                <span>{t('monthlyBudget')}</span>
                <span className={isOver ? 'text-white font-semibold' : ''}>
                  {isOver ? t('overBudget') : t('budgetPctUsed', { pct: Math.round(pct) })}
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
          <span className="text-sm font-semibold text-gray-700">{t('billDetail')}</span>
          <span className="text-xs text-gray-400">{txCountLabel}</span>
        </div>

        {/* ── Search bar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder={t('searchPlaceholder')}
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
              <p className="text-sm">{transactions.length === 0 ? t('noRecords') : t('noFilterResults')}</p>
              {transactions.length === 0
                ? <p className="text-xs mt-1">{t('noRecordsHint')}</p>
                : <button onClick={resetFilter} className="text-xs mt-2 text-[#e53935]">{t('clearFilter')}</button>
              }
            </div>
          ) : (
            sortedDates.map(date => {
              const dayTxs = grouped[date]
              const dayExpense = dayTxs
                .filter(tx => tx.type === 'expense')
                .reduce((s, tx) => s + convertTo(tx.amount, tx.currency), 0)

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
                            {tx.categories?.name ?? t('uncategorized')}
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

      {/* ── Currency picker portal ── */}
      {showPicker && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          <div className="fixed z-50 bg-white rounded-xl shadow-xl min-w-[110px]"
            style={{ top: pickerPos.top, left: pickerPos.left, maxHeight: '60vh', overflowY: 'auto' }}>
            {DISPLAY_CURRENCIES.map(c => (
              <button key={c} onClick={() => { setDisplayCurrency(c); setShowPicker(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                  c === displayCurrency ? 'text-[#e53935] font-semibold bg-red-50' : 'text-gray-700'
                }`}>
                <span className="w-7 text-gray-400">{CURRENCY_SYMBOLS[c]}</span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
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
              <h2 className="text-base font-semibold text-gray-800">{t('filterTitle')}</h2>
              <button onClick={() => setShowFilter(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* Date range */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('filterDateRange')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={draft.dateFrom}
                    max={draft.dateTo || undefined}
                    onChange={e => setDraft(p => ({ ...p, dateFrom: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-[#e53935] transition-colors"
                  />
                  <span className="text-gray-400 text-sm shrink-0">{t('filterTo')}</span>
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
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('filterType')}</p>
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
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('filterCategory')}</p>
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
                {t('filterReset')}
              </button>
              <button onClick={confirmFilter}
                className="flex-1 py-3 bg-[#e53935] text-white rounded-xl text-sm font-semibold active:opacity-90 transition-opacity">
                {t('filterConfirm')}
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
