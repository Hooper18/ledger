import { useState, useMemo } from 'react'
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
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
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
  const { baseCurrency, rates } = useCurrency()
  const { t, lang } = useLanguage()
  const { transactions: allTxs, loading: txLoading } = useTransactions()
  const { categories } = useCategories()

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

  // Locale-aware month-year label: "2026年4月" (zh) / "April 2026" (en)
  const monthYearLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1))

  const dailyTitle    = lang === 'zh' ? `${monthYearLabel}${t('tabDaily')}`    : `${t('tabDaily')} · ${monthYearLabel}`
  const categoryTitle = lang === 'zh' ? `${monthYearLabel}${t('tabCategory')}` : `${t('tabCategory')} · ${monthYearLabel}`

  // ── Tab 1: Overview (近6个月) ──────────────────────────────────────────
  type MonthBucket = { month: string; income: number; expense: number }
  const overview: MonthBucket[] = useMemo(() => {
    const buckets: Record<string, { income: number; expense: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = { income: 0, expense: 0 }
    }
    for (const tx of allTxs) {
      if (tx.type !== 'expense' && tx.type !== 'income') continue
      const key = tx.date.slice(0, 7)
      if (!buckets[key]) continue
      const v = cvtTx(tx.amount, tx.currency, tx.exchange_rate)
      if (tx.type === 'income') buckets[key].income += v
      if (tx.type === 'expense') buckets[key].expense += v
    }
    return Object.entries(buckets).map(([m, v]) => ({ month: m, ...v }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTxs, rates, baseCurrency])
  const overviewLoading = txLoading

  // ── Tabs 2 & 3: Monthly txs ───────────────────────────────────────────
  const monthlyTxs: TxDetail[] = useMemo(() => {
    const start = monthStart(year, month)
    const end = monthEnd(year, month)
    const catMap = new Map(categories.map((c) => [c.id, c]))
    return allTxs
      .filter(
        (t) =>
          t.date >= start &&
          t.date < end &&
          (t.type === 'expense' || t.type === 'income'),
      )
      .map((t) => {
        const c = catMap.get(t.category_id)
        return {
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          description: t.description,
          date: t.date,
          category_id: t.category_id,
          exchange_rate: t.exchange_rate,
          categories: c ? { name: c.name, icon: c.icon } : null,
        } as TxDetail
      })
  }, [allTxs, categories, year, month])
  const monthlyLoading = txLoading

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
      if (!map[key]) map[key] = { name: tx.categories?.name ?? t('uncategorized'), icon: tx.categories?.icon ?? '📦', total: 0 }
      map[key].total += cvtTx(tx.amount, tx.currency, tx.exchange_rate)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [monthlyTxs, catType, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chart configs ─────────────────────────────────────────────────────

  // X-axis month labels for overview: "1月"/"2月" (zh) or "Jan"/"Feb" (en)
  const overviewChartData = {
    labels: overview.map(d => {
      const m = parseInt(d.month.slice(5))
      const y = parseInt(d.month.slice(0, 4))
      if (lang === 'zh') return `${m}月`
      return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(y, m - 1))
    }),
    datasets: [
      { label: t('income'),  data: overview.map(d => d.income),  backgroundColor: GREEN, borderRadius: 4, barPercentage: 0.7 },
      { label: t('expense'), data: overview.map(d => d.expense), backgroundColor: RED,   borderRadius: 4, barPercentage: 0.7 },
    ],
  }

  const dailyChartData = {
    labels: dailyData.map(d => String(d.day)),
    datasets: [
      { label: t('expense'), data: dailyData.map(d => d.expense), backgroundColor: RED, borderRadius: 3, barPercentage: 0.8 },
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

  // TABS defined inside component so labels use t()
  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('tabOverview') },
    { key: 'daily',    label: t('tabDaily') },
    { key: 'category', label: t('tabCategory') },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header + Tabs ── */}
      <div className="bg-white px-4 pt-4 pb-0 border-b border-gray-100 shrink-0">
        <h1 className="text-lg font-bold text-gray-800 mb-3">{t('statsTitle')}</h1>
        <div className="flex">
          {TABS.map(tabItem => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === tabItem.key ? 'border-[#e53935] text-[#e53935]' : 'border-transparent text-gray-400'
              }`}>
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">{t('last6Months')}</p>
            {overviewLoading ? <Spinner /> : (
              <div className="h-52">
                <Bar key={lang} data={overviewChartData} options={barBase} />
              </div>
            )}
          </div>
        )}

        {/* ── Daily ── */}
        {tab === 'daily' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <MonthNav title={dailyTitle} />
            {monthlyLoading ? <Spinner /> : dailyData.every(d => d.expense === 0) ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">📊</span>
                <p className="text-sm">{t('noExpenseData')}</p>
              </div>
            ) : (
              <div className="h-52">
                <Bar
                  key={lang}
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
            <MonthNav title={categoryTitle} />

            {/* income / expense toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
              {(['expense', 'income'] as const).map(txType => (
                <button key={txType} onClick={() => setCatType(txType)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    catType === txType
                      ? txType === 'expense' ? 'bg-[#e53935] text-white shadow-sm' : 'bg-green-500 text-white shadow-sm'
                      : 'text-gray-500'
                  }`}>
                  {txType === 'expense' ? t('expense') : t('income')}
                </button>
              ))}
            </div>

            {monthlyLoading ? <Spinner /> : catData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">🍩</span>
                <p className="text-sm">{catType === 'expense' ? t('noExpenseData') : t('noIncomeData')}</p>
              </div>
            ) : (
              <>
                <div className="h-52 mb-4">
                  <Pie key={lang} data={pieChartData} options={pieOptions} />
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
