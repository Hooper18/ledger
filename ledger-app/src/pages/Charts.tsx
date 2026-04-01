import { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { TooltipItem } from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { CURRENCY_SYMBOLS } from '../types'
import type { Currency, TxDetail } from '../types'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const RED    = '#e53935'
const GREEN  = '#43a047'
const PIE_COLORS = [
  '#e53935','#e91e63','#9c27b0','#673ab7','#3f51b5',
  '#2196f3','#03a9f4','#00bcd4','#009688','#4caf50',
  '#8bc34a','#cddc39','#ffc107','#ff9800','#ff5722',
  '#795548','#9e9e9e','#607d8b',
]

type Tab = 'overview' | 'daily' | 'category'

const NOW = new Date()

function monthStart(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}-01`
}
function monthEnd(y: number, m: number) {
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

export default function Charts() {
  const { user } = useAuth()
  const { baseCurrency, rates } = useCurrency()

  const dispCurrency = baseCurrency
  const symbol = CURRENCY_SYMBOLS[dispCurrency as Currency] ?? dispCurrency

  function cvt(amount: number, from: string): number {
    if (from === dispCurrency) return amount
    return (amount / (rates[from] ?? 1)) * (rates[dispCurrency] ?? 1)
  }

  function cvtTx(amount: number, currency: string, exchange_rate?: number | null): number {
    if (exchange_rate != null) return amount / exchange_rate
    return cvt(amount, currency)
  }

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const [tab, setTab] = useState<Tab>('overview')

  // month nav (shared by daily + category)
  const [year, setYear]   = useState(NOW.getFullYear())
  const [month, setMonth] = useState(NOW.getMonth() + 1)
  const isCurrentMonth = year === NOW.getFullYear() && month === NOW.getMonth() + 1

  function changeMonth(d: number) {
    let m = month + d, y = year
    if (m > 12) { m = 1;  y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  // ── Tab 1: Overview (近6个月) ──────────────────────────────────────────
  type MonthBucket = { month: string; income: number; expense: number }
  const [overview, setOverview] = useState<MonthBucket[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setOverviewLoading(true)
    const start = new Date(NOW.getFullYear(), NOW.getMonth() - 5, 1)
    const startStr = monthStart(start.getFullYear(), start.getMonth() + 1)
    const endStr   = monthEnd(NOW.getFullYear(), NOW.getMonth() + 1)

    supabase
      .from('transactions')
      .select('type, amount, currency, date, exchange_rate')
      .eq('user_id', user.id)
      .gte('date', startStr)
      .lt('date', endStr)
      .in('type', ['expense', 'income'])
      .then(({ data }) => {
        const buckets: Record<string, { income: number; expense: number }> = {}
        for (let i = 5; i >= 0; i--) {
          const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          buckets[key] = { income: 0, expense: 0 }
        }
        type Row = { type: string; amount: number; currency: string; date: string; exchange_rate: number | null }
        for (const tx of (data as Row[]) ?? []) {
          const key = tx.date.slice(0, 7)
          if (!buckets[key]) continue
          const v = cvtTx(tx.amount, tx.currency, tx.exchange_rate)
          if (tx.type === 'income')  buckets[key].income  += v
          if (tx.type === 'expense') buckets[key].expense += v
        }
        setOverview(
          Object.entries(buckets).map(([m, v]) => ({ month: m, ...v }))
        )
        setOverviewLoading(false)
      })
  }, [user, rates]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tabs 2 & 3: Monthly txs ───────────────────────────────────────────
  const [monthlyTxs, setMonthlyTxs]       = useState<TxDetail[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  useEffect(() => {
    if (!user || tab === 'overview') return
    setMonthlyLoading(true)
    supabase
      .from('transactions')
      .select('id, type, amount, currency, description, date, category_id, exchange_rate, categories(name, icon)')
      .eq('user_id', user.id)
      .gte('date', monthStart(year, month))
      .lt('date', monthEnd(year, month))
      .in('type', ['expense', 'income'])
      .then(({ data }) => {
        setMonthlyTxs((data as TxDetail[]) ?? [])
        setMonthlyLoading(false)
      })
  }, [user, year, month, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // daily expense buckets
  const dailyData = useMemo(() => {
    const days = new Date(year, month, 0).getDate()
    const arr = Array.from({ length: days }, (_, i) => ({ day: i + 1, expense: 0 }))
    for (const tx of monthlyTxs) {
      if (tx.type !== 'expense') continue
      const d = parseInt(tx.date.slice(8, 10))
      arr[d - 1].expense += cvtTx(tx.amount, tx.currency, tx.exchange_rate)
    }
    return arr
  }, [monthlyTxs]) // eslint-disable-line react-hooks/exhaustive-deps

  // category buckets
  const [catType, setCatType] = useState<'expense' | 'income'>('expense')
  const catData = useMemo(() => {
    const map: Record<string, { name: string; icon: string; total: number }> = {}
    for (const tx of monthlyTxs) {
      if (tx.type !== catType) continue
      const key = tx.category_id
      if (!map[key]) map[key] = { name: tx.categories?.name ?? '未分类', icon: tx.categories?.icon ?? '📦', total: 0 }
      map[key].total += cvtTx(tx.amount, tx.currency, tx.exchange_rate)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [monthlyTxs, catType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chart configs ─────────────────────────────────────────────────────
  const overviewChartData = {
    labels: overview.map(d => `${parseInt(d.month.slice(5))}月`),
    datasets: [
      { label: '收入', data: overview.map(d => d.income),  backgroundColor: GREEN, borderRadius: 4, barPercentage: 0.7 },
      { label: '支出', data: overview.map(d => d.expense), backgroundColor: RED,   borderRadius: 4, barPercentage: 0.7 },
    ],
  }

  const dailyChartData = {
    labels: dailyData.map(d => String(d.day)),
    datasets: [
      { label: '支出', data: dailyData.map(d => d.expense), backgroundColor: RED, borderRadius: 3, barPercentage: 0.8 },
    ],
  }

  const pieChartData = {
    labels: catData.map(d => `${d.icon} ${d.name}`),
    datasets: [{
      data: catData.map(d => d.total),
      backgroundColor: PIE_COLORS.slice(0, catData.length),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  }

  const barBase = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12, padding: 12 } },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'bar'>) => ` ${symbol} ${fmt((ctx.parsed as { y: number }).y ?? 0)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 10 }, callback: (v: string | number) => `${symbol}${Math.round(Number(v))}` },
      },
    },
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'pie'>) => {
            const v = ctx.parsed as number
            const total = catData.reduce((s, d) => s + d.total, 0)
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0'
            return ` ${symbol} ${fmt(v)} (${pct}%)`
          },
        },
      },
    },
  }

  // ── Spinner helper ────────────────────────────────────────────────────
  const Spinner = () => (
    <div className="h-48 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#e53935] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Month nav bar (reused in daily + category) ────────────────────────
  const MonthNav = ({ title }: { title: string }) => (
    <div className="flex items-center justify-between mb-4">
      <button onClick={() => changeMonth(-1)}
        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
        <ChevronLeft size={16} />
      </button>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <button onClick={() => changeMonth(1)} disabled={isCurrentMonth}
        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 disabled:opacity-30">
        <ChevronRight size={16} />
      </button>
    </div>
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: '月度趋势' },
    { key: 'daily',    label: '每日支出' },
    { key: 'category', label: '分类占比' },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header + Tabs ── */}
      <div className="bg-white px-4 pt-4 pb-0 border-b border-gray-100 shrink-0">
        <h1 className="text-lg font-bold text-gray-800 mb-3">统计</h1>
        <div className="flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-[#e53935] text-[#e53935]' : 'border-transparent text-gray-400'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">近6个月收支</p>
            {overviewLoading ? <Spinner /> : (
              <div className="h-52">
                <Bar data={overviewChartData} options={barBase} />
              </div>
            )}
          </div>
        )}

        {/* ── Daily ── */}
        {tab === 'daily' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <MonthNav title={`${year}年${month}月每日支出`} />
            {monthlyLoading ? <Spinner /> : dailyData.every(d => d.expense === 0) ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">📊</span>
                <p className="text-sm">本月暂无支出记录</p>
              </div>
            ) : (
              <div className="h-52">
                <Bar
                  data={dailyChartData}
                  options={{ ...barBase, plugins: { ...barBase.plugins, legend: { display: false } } }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Category ── */}
        {tab === 'category' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <MonthNav title={`${year}年${month}月分类占比`} />

            {/* income / expense toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => setCatType(t)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    catType === t
                      ? t === 'expense' ? 'bg-[#e53935] text-white shadow-sm' : 'bg-green-500 text-white shadow-sm'
                      : 'text-gray-500'
                  }`}>
                  {t === 'expense' ? '支出' : '收入'}
                </button>
              ))}
            </div>

            {monthlyLoading ? <Spinner /> : catData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">🍩</span>
                <p className="text-sm">本月暂无{catType === 'expense' ? '支出' : '收入'}记录</p>
              </div>
            ) : (
              <>
                <div className="h-52 mb-4">
                  <Pie data={pieChartData} options={pieOptions} />
                </div>

                {/* Legend list with amounts */}
                <div className="space-y-2 pt-2 border-t border-gray-50">
                  {catData.map((d, i) => {
                    const total = catData.reduce((s, c) => s + c.total, 0)
                    const pct = total > 0 ? (d.total / total * 100).toFixed(1) : '0.0'
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-sm text-gray-700 flex-1 truncate">{d.icon} {d.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                        <span className="text-sm font-medium text-gray-800 shrink-0 w-24 text-right">
                          {symbol} {fmt(d.total)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
