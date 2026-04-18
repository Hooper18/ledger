import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Pencil, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { CURRENCY_SYMBOLS } from '../types'
import type { Currency } from '../types'

interface CategoryRow {
  id: string
  name: string
  icon: string
}

interface BudgetRow {
  id: string
  category_id: string | null
  amount: number
  currency: string
}

export default function Budget() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { baseCurrency, rates } = useCurrency()
  const { t, lang } = useLanguage()

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const period = 'monthly'

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [budgets, setBudgets]         = useState<BudgetRow[]>([])
  const [catSpending, setCatSpending] = useState<Map<string, number>>(new Map())
  const [totalSpent, setTotalSpent]   = useState(0)
  const [loading, setLoading]         = useState(true)

  // Edit sheet: null = closed, '' = total budget, UUID = category budget
  const [editing, setEditing]     = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving]       = useState(false)

  const symbol = CURRENCY_SYMBOLS[baseCurrency as Currency] ?? baseCurrency

  // Locale-aware month-year label: "2026年4月" (zh) / "April 2026" (en)
  const monthYearLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1))

  function convertTo(amount: number, from: string): number {
    if (from === baseCurrency) return amount
    return (amount / (rates[from] ?? 1)) * (rates[baseCurrency] ?? 1)
  }

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  async function fetchData() {
    if (!user) return
    setLoading(true)

    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const nm    = month === 12 ? 1  : month + 1
    const ny    = month === 12 ? year + 1 : year
    const end   = `${ny}-${String(nm).padStart(2, '0')}-01`

    const [catsRes, budgetsRes, txRes] = await Promise.all([
      supabase.from('categories')
        .select('id, name, icon')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name'),
      supabase.from('budgets')
        .select('id, category_id, amount, currency')
        .eq('user_id', user.id)
        .eq('period', period),
      supabase.from('transactions')
        .select('amount, currency, category_id, exchange_rate')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', start)
        .lt('date', end),
    ])

    console.log('[Budget] fetchData budgetsRes:', JSON.stringify(budgetsRes.data), 'error:', JSON.stringify(budgetsRes.error))
    if (catsRes.data)    setCategories(catsRes.data as CategoryRow[])
    if (budgetsRes.data) setBudgets(budgetsRes.data as BudgetRow[])

    if (txRes.data) {
      let total = 0
      const map = new Map<string, number>()
      for (const tx of txRes.data as { amount: number; currency: string; category_id: string; exchange_rate: number | null }[]) {
        const v = tx.exchange_rate != null
          ? tx.amount / tx.exchange_rate
          : convertTo(tx.amount, tx.currency)
        total += v
        map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + v)
      }
      setTotalSpent(total)
      setCatSpending(map)
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // category_id: null = total budget, UUID = category budget
  function getBudget(categoryId: string | null): BudgetRow | null {
    return budgets.find(b => b.category_id === categoryId) ?? null
  }

  function openEdit(categoryId: string | null) {
    const b = getBudget(categoryId)
    setEditValue(b ? String(b.amount) : '')
    setEditing(categoryId ?? '') // null → '' (total), UUID → UUID
  }

  async function saveEdit() {
    if (!user || editing === null) return
    const amount = parseFloat(editValue)
    if (isNaN(amount) || amount <= 0) return

    setSaving(true)
    const category_id = editing === '' ? null : editing

    console.log('[Budget] saving period:', period, '| category_id:', category_id, '| amount:', amount)

    const { data, error } = await supabase.from('budgets').upsert(
      { user_id: user.id, category_id, amount, currency: baseCurrency as string, period } as any,
      { onConflict: 'user_id,period,category_id' },
    ).select()

    console.error('[Budget] error:', JSON.stringify(error))
    console.log('[Budget] data:', data)

    if (error) {
      setSaving(false)
      return
    }

    await fetchData()
    console.log('[Budget] fetchData done, budgets state will update')
    setSaving(false)
    setEditing(null)
  }

  async function deleteBudget() {
    if (editing === null) return
    const category_id = editing === '' ? null : editing
    const b = getBudget(category_id)
    if (!b) return

    const { error } = await supabase.from('budgets').delete().eq('id', b.id)
    if (error) {
      console.error('[Budget] delete error:', error)
      return
    }
    await fetchData()
    setEditing(null)
  }

  // ── Derived data ──
  const totalBudgetRow = getBudget(null)
  const totalBudgetAmt = totalBudgetRow ? convertTo(totalBudgetRow.amount, totalBudgetRow.currency) : null
  const totalIsOver    = totalBudgetAmt !== null && totalSpent > totalBudgetAmt
  const totalPct       = totalBudgetAmt ? Math.min((totalSpent / totalBudgetAmt) * 100, 100) : 0

  const catRows = categories.map(cat => {
    const b         = getBudget(cat.id)
    const spent     = catSpending.get(cat.id) ?? 0
    const budgetAmt = b ? convertTo(b.amount, b.currency) : null
    const isOver    = budgetAmt !== null && spent > budgetAmt
    const pct       = budgetAmt ? Math.min((spent / budgetAmt) * 100, 100) : 0
    return { id: cat.id, name: cat.name, icon: cat.icon, spent, budgetAmt, isOver, pct }
  })

  const withBudgetOrSpending = catRows.filter(c => c.budgetAmt !== null || c.spent > 0)
  const noBudgetNoSpending   = catRows.filter(c => c.budgetAmt === null  && c.spent === 0)

  // For delete button visibility and sheet title
  const editingCategoryId: string | null = editing === '' ? null : editing
  const editingCatName = editing === ''
    ? t('monthlyTotalBudget')
    : categories.find(c => c.id === editing)?.name ?? t('categoryBudget')

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-full active:bg-gray-100">
            <ChevronLeft size={22} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{t('budgetTitle')}</h1>
            <p className="text-xs text-gray-400">{monthYearLabel} · {baseCurrency}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#e53935]" />
          </div>
        ) : (
          <>
            {/* ── Total budget ── */}
            <div className="mx-4 mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{t('monthlyTotalBudget')}</p>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-2xl font-bold ${totalIsOver ? 'text-[#e53935]' : 'text-gray-800'}`}>
                      {symbol} {fmt(totalSpent)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {totalBudgetAmt !== null
                        ? <>{t('budgetLimit')} {symbol} {fmt(totalBudgetAmt)}{totalIsOver && <span className="text-[#e53935] font-semibold ml-1.5">{t('overLimit')}</span>}</>
                        : t('noBudgetSet')
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => openEdit(null)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-xl active:bg-gray-200 mt-1"
                  >
                    <Pencil size={12} className="text-gray-500" />
                    <span className="text-xs text-gray-600 font-medium">
                      {totalBudgetAmt !== null ? t('edit') : t('set')}
                    </span>
                  </button>
                </div>

                {totalBudgetAmt !== null && (
                  <>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${totalIsOver ? 'bg-[#e53935]' : 'bg-[#4caf50]'}`}
                        style={{ width: `${totalPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                      <span>{t('pctUsed', { pct: Math.round(totalPct) })}</span>
                      {totalIsOver
                        ? <span className="text-[#e53935] font-medium">{t('over')} {symbol} {fmt(totalSpent - totalBudgetAmt)}</span>
                        : <span>{t('remaining')} {symbol} {fmt(totalBudgetAmt - totalSpent)}</span>
                      }
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Category budgets ── */}
            <div className="mx-4 mt-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{t('categoryBudget')}</p>

              {withBudgetOrSpending.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
                  {withBudgetOrSpending.map((cat, i) => (
                    <div key={cat.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                      <div className="px-4 py-3.5">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-base">
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                              <button onClick={() => openEdit(cat.id)} className="p-1 rounded-lg active:bg-gray-100">
                                <Pencil size={13} className="text-gray-400" />
                              </button>
                            </div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className={`text-sm font-semibold ${cat.isOver ? 'text-[#e53935]' : 'text-gray-700'}`}>
                                {symbol} {fmt(cat.spent)}
                              </span>
                              {cat.budgetAmt !== null && (
                                <span className="text-xs text-gray-400">/ {symbol} {fmt(cat.budgetAmt)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {cat.budgetAmt !== null && (
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${cat.isOver ? 'bg-[#e53935]' : 'bg-[#e53935]/60'}`}
                              style={{ width: `${cat.pct}%` }}
                            />
                          </div>
                        )}

                        {cat.isOver && (
                          <p className="text-[11px] text-[#e53935] mt-1 font-medium">
                            ⚠ {t('over')} {symbol} {fmt(cat.spent - cat.budgetAmt!)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm p-6 text-center mb-4">
                  <p className="text-3xl mb-2">🎯</p>
                  <p className="text-sm text-gray-500">{t('noCategoryBudget')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('addCategoryBudgetHint')}</p>
                </div>
              )}

              {/* Add budget for unconfigured categories */}
              {noBudgetNoSpending.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{t('addCategoryBudgetSection')}</p>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="grid grid-cols-4">
                      {noBudgetNoSpending.map((cat, i) => (
                        <button
                          key={cat.id}
                          onClick={() => openEdit(cat.id)}
                          className={`flex flex-col items-center py-3.5 px-2 active:bg-gray-50 ${
                            i % 4 !== 0 ? 'border-l border-gray-50' : ''
                          } ${i >= 4 ? 'border-t border-gray-50' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg mb-1 relative">
                            {cat.icon}
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#e53935]/10 flex items-center justify-center">
                              <Plus size={9} className="text-[#e53935]" />
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 text-center leading-tight">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Edit budget sheet ── */}
      {editing !== null && createPortal(
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => !saving && setEditing(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-2xl z-50"
            style={{ animation: 'slideUp .22s ease' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">{editingCatName}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="px-4 py-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">
                  {t('monthlyLimitLabel', { currency: baseCurrency })}
                </label>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3 border border-gray-100 focus-within:border-[#e53935] transition-colors">
                  <span className="text-gray-400 font-medium text-lg">{symbol}</span>
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 bg-transparent outline-none text-xl font-semibold text-gray-800"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {getBudget(editingCategoryId) && (
                  <button
                    onClick={deleteBudget}
                    disabled={saving}
                    className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium disabled:opacity-50 active:bg-gray-200"
                  >
                    {t('delete')}
                  </button>
                )}
                <button
                  onClick={saveEdit}
                  disabled={saving || !editValue || parseFloat(editValue) <= 0}
                  className="flex-1 py-3 bg-[#e53935] text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-90"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </div>

            <div className="h-6" />
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
        </>,
        document.body,
      )}
    </div>
  )
}
