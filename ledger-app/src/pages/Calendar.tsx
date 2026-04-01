import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { CURRENCY_SYMBOLS } from '../types'
import type { Currency, TxDetail } from '../types'

const LS_KEY = 'ledger_display_currency'
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** Returns a flat array of day numbers (null = padding cell) for the month grid */
function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay()  // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function pad2(n: number) { return String(n).padStart(2, '0') }

export default function Calendar() {
  const { user } = useAuth()
  const { rates } = useCurrency()

  const displayCurrency = (localStorage.getItem(LS_KEY) as Currency) ?? 'MYR'

  function convertTo(amount: number, from: string): number {
    if (from === displayCurrency) return amount
    return (amount / (rates[from] ?? 1)) * (rates[displayCurrency] ?? 1)
  }

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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

  // ── fetch transactions for current month ──
  const [transactions, setTransactions] = useState<TxDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const start = `${year}-${pad2(month)}-01`
    const nm = month === 12 ? 1 : month + 1
    const ny = month === 12 ? year + 1 : year
    const end = `${ny}-${pad2(nm)}-01`

    supabase
      .from('transactions')
      .select('id, type, amount, currency, description, date, category_id, categories(name, icon)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lt('date', end)
      .then(({ data, error }) => {
        if (!error && data) setTransactions(data as TxDetail[])
        setLoading(false)
      })
  }, [user, year, month])

  // ── aggregate by date ──
  type DaySummary = { expense: number; income: number; txList: TxDetail[] }
  const byDate: Record<string, DaySummary> = {}
  for (const tx of transactions) {
    if (!byDate[tx.date]) byDate[tx.date] = { expense: 0, income: 0, txList: [] }
    const v = convertTo(tx.amount, tx.currency)
    if (tx.type === 'expense') byDate[tx.date].expense += v
    if (tx.type === 'income')  byDate[tx.date].income  += v
    byDate[tx.date].txList.push(tx)
  }

  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  // ── selected day sheet ──
  const [selectedDate, setSelectedDate] = useState<string | null>(now.toISOString().split('T')[0])
  const selectedSummary = selectedDate ? byDate[selectedDate] : null

  const todayStr = now.toISOString().split('T')[0]
  const calDays  = buildCalendarDays(year, month)
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <button onClick={() => changeMonth(-1)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="text-base font-bold text-gray-800">{year}年{month}月</span>
          <button onClick={() => changeMonth(1)} disabled={isCurrentMonth}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 disabled:opacity-30">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Calendar (always visible) ── */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-medium ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="aspect-square border-b border-r border-gray-50" />

                const dateStr = `${year}-${pad2(month)}-${pad2(day)}`
                const summary = byDate[dateStr]
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const dow = idx % 7

                return (
                  <button key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`aspect-square flex flex-col items-center justify-start pt-1.5 px-0.5 border-b border-r border-gray-50 transition-colors ${
                      isSelected ? 'bg-red-50' : 'active:bg-gray-50'
                    }`}
                  >
                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday   ? 'bg-primary text-white' :
                      dow === 0 ? 'text-red-400' :
                      dow === 6 ? 'text-blue-400' : 'text-gray-700'
                    }`}>
                      {day}
                    </span>
                    {summary && summary.expense > 0 && (
                      <span className="text-[10px] text-red-400 font-medium leading-tight mt-0.5 w-full text-center truncate px-0.5">
                        {fmt(summary.expense)}
                      </span>
                    )}
                    {summary && summary.income > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-0.5 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Month summary */}
        {!loading && (
          <div className="mt-2 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {[
                { label: '支出', value: Object.values(byDate).reduce((s, d) => s + d.expense, 0), color: 'text-red-500' },
                { label: '收入', value: Object.values(byDate).reduce((s, d) => s + d.income,   0), color: 'text-green-500' },
                { label: '结余', value: Object.values(byDate).reduce((s, d) => s + d.income - d.expense, 0), color: 'text-blue-500' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center py-3">
                  <span className="text-xs text-gray-400 mb-1">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{symbol} {fmt(Math.abs(item.value))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Day detail (scrollable, takes remaining height) ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {selectedDate && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {new Date(selectedDate + 'T00:00:00').getMonth() + 1}月
                  {new Date(selectedDate + 'T00:00:00').getDate()}日
                </span>
                <span className="text-xs text-gray-400">
                  {WEEKDAY_LABELS[new Date(selectedDate + 'T00:00:00').getDay()]}
                </span>
              </div>
              <div className="flex gap-3">
                {selectedSummary && selectedSummary.expense > 0 && (
                  <span className="text-xs text-red-500">支出 {symbol} {fmt(selectedSummary.expense)}</span>
                )}
                {selectedSummary && selectedSummary.income > 0 && (
                  <span className="text-xs text-green-500">收入 {symbol} {fmt(selectedSummary.income)}</span>
                )}
              </div>
            </div>

            {/* Transaction list */}
            {!selectedSummary || selectedSummary.txList.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-gray-400 gap-1">
                <span className="text-2xl">🗒️</span>
                <p className="text-sm">当天没有记录</p>
              </div>
            ) : (
              selectedSummary.txList.map(tx => {
                const converted = convertTo(tx.amount, tx.currency)
                const isExpense = tx.type === 'expense'
                const isIncome  = tx.type === 'income'
                const origSymbol = CURRENCY_SYMBOLS[tx.currency as Currency] ?? tx.currency
                return (
                  <div key={tx.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
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
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
