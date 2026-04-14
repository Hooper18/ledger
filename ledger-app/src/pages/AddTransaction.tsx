import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import type { TransactionType, Currency, TxDetail } from '../types'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORIES,
  CATEGORY_ICONS,
} from '../types'

interface Category { id: string; name: string; type: string; icon: string }

function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const ALL_CURRENCIES: Currency[] = ['MYR', 'CNY', 'USD', 'SGD', 'HKD', 'JPY', 'EUR', 'GBP', 'THB', 'TWD', 'AUD', 'KHR']

const CURRENCY_SYMBOLS: Record<string, string> = {
  MYR: 'RM', CNY: '¥', USD: '$', SGD: 'S$',
  HKD: 'HK$', JPY: '¥', EUR: '€', GBP: '£',
  THB: '฿', KHR: '₫', TWD: 'NT$', AUD: 'A$',
}

function buildFallback(type: TransactionType): Category[] {
  const names =
    type === 'expense' ? EXPENSE_CATEGORIES :
    type === 'income'  ? INCOME_CATEGORIES  : TRANSFER_CATEGORIES
  return names.map((name, i) => ({ id: String(i), name, type, icon: CATEGORY_ICONS[name] ?? '📦' }))
}

export default function AddTransaction() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { defaultCurrency, baseCurrency, rates } = useCurrency()
  const { t } = useLanguage()

  // Edit mode: location.state.tx is set when navigating from TransactionSheet
  const editTx = (location.state as { tx?: TxDetail } | null)?.tx

  const [type, setType]         = useState<TransactionType>((editTx?.type as TransactionType) ?? 'expense')
  const [amount, setAmount]     = useState(editTx ? String(editTx.amount) : '0')
  const [selectedCategory, setSelected] = useState(editTx?.category_id ?? '')
  const [date, setDate]         = useState(editTx?.date ?? localDateStr())
  const [note, setNote]         = useState(editTx?.description ?? '')
  const [currency, setCurrency] = useState<Currency>((editTx?.currency as Currency) ?? defaultCurrency)
  const [categories, setCategories] = useState<Category[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showCurrencyPicker, setShowCPicker] = useState(false)
  const [toast, setToast] = useState('')

  // Date quick-select
  function dateOffset(offset: number) {
    const d = new Date(); d.setDate(d.getDate() + offset)
    return localDateStr(d)
  }
  const today = dateOffset(0)
  const yesterday = dateOffset(-1)
  const dayBefore = dateOffset(-2)

  type DateMode = 'today' | 'yesterday' | 'dayBefore' | 'other'
  function initDateMode(): DateMode {
    if (!editTx) return 'today'
    if (editTx.date === today)     return 'today'
    if (editTx.date === yesterday) return 'yesterday'
    if (editTx.date === dayBefore) return 'dayBefore'
    return 'other'
  }
  const [dateMode, setDateMode] = useState<DateMode>(initDateMode)

  const TYPE_CONFIG = {
    expense:  { label: t('expense'), active: 'text-red-500 border-red-500'    },
    income:   { label: t('income'),  active: 'text-green-500 border-green-500' },
    transfer: { label: t('transfer'), active: 'text-blue-500 border-blue-500'  },
  }

  // Load categories; do NOT reset selectedCategory here — that's handled by type tab clicks
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await supabase
          .from('categories')
          .select('id, name, type, icon')
          .eq('type', type)
          .order('name')
        if (cancelled) return
        setCategories(data && data.length > 0 ? (data as Category[]) : buildFallback(type))
      } catch {
        if (!cancelled) setCategories(buildFallback(type))
      }
    }
    load()
    return () => { cancelled = true }
  }, [type])

  // ─── Numpad ──────────────────────────────────────────────────────────────

  function numPress(key: string) {
    setAmount(prev => {
      if (key === '.') return prev.includes('.') ? prev : prev + '.'
      const dotIdx = prev.indexOf('.')
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev
      if (prev === '0') return key === '00' ? '0' : key
      return prev + key
    })
  }

  function numDel() {
    setAmount(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function handleSave(continueAdding: boolean) {
    if (!user) return
    if (!amount || parseFloat(amount) === 0) { showToast(t('amountRequired')); return }
    if (!selectedCategory)                    { showToast(t('categoryRequired')); return }

    setSubmitting(true)

    const exchange_rate = currency !== baseCurrency
      ? (rates[currency] ?? 1) / (rates[baseCurrency] ?? 1)
      : null

    const payload = {
      type, amount: parseFloat(amount), currency,
      category_id: selectedCategory,
      description: note.trim() || null, date,
      exchange_rate,
    }

    let error
    if (editTx) {
      ;({ error } = await supabase.from('transactions').update(payload).eq('id', editTx.id))
    } else {
      ;({ error } = await supabase.from('transactions').insert({ ...payload, user_id: user.id }))
    }

    setSubmitting(false)
    if (error) { showToast(t('saveFailed') + error.message); return }

    if (editTx) {
      navigate(-1)   // return to wherever edit was triggered from
    } else if (continueAdding) {
      setAmount('0'); setNote(''); setSelected('')
      showToast(t('savedContinue'))
    } else {
      navigate('/')
    }
  }

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <X size={22} className="text-gray-600" />
        </button>
        <h1 className="text-base font-semibold">{editTx ? t('editTx') : t('addTx')}</h1>
        <div className="w-9" />
      </div>

      {/* Type tabs */}
      <div className="flex border-b border-gray-100">
        {(Object.keys(TYPE_CONFIG) as TransactionType[]).map(tp => (
          <button key={tp}
            onClick={() => { setType(tp); setSelected('') }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              type === tp ? TYPE_CONFIG[tp].active : 'text-gray-400 border-transparent'
            }`}
          >
            {TYPE_CONFIG[tp].label}
          </button>
        ))}
      </div>

      {/* Content area — fixed height, no outer scroll */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Category grid — fixed height, inner scroll */}
        <div className="relative shrink-0">
          <div className="grid grid-cols-5 gap-1 px-3 py-3 max-h-48 overflow-y-auto no-scrollbar">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelected(cat.id)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors ${
                selectedCategory === cat.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl transition-colors ${
                selectedCategory === cat.id ? 'bg-blue-500' : 'bg-gray-100'
              }`}>
                {cat.icon}
              </div>
              <span className={`text-[10px] leading-tight text-center break-all ${
                selectedCategory === cat.id ? 'text-blue-500 font-semibold' : 'text-gray-500'
              }`}>
                {cat.name}
              </span>
            </button>
          ))}
          </div>
          {/* Bottom fade — hints more rows below */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>

        {/* Note */}
        <div className="px-4 mb-2">
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder={t('notePlaceholder')} maxLength={50}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>

        {/* Date + Currency */}
        <div className="px-4 pb-3 shrink-0">
          {/* Quick date buttons + currency on same row */}
          <div className="flex gap-1 items-center">
            {([
              { mode: 'today',     label: t('today'),           d: today     },
              { mode: 'yesterday', label: t('yesterday'),       d: yesterday },
              { mode: 'dayBefore', label: t('dayBeforeYesterday'), d: dayBefore },
              { mode: 'other',     label: t('other'),           d: null      },
            ] as { mode: DateMode; label: string; d: string | null }[]).map(({ mode, label, d }) => (
              <button key={mode}
                onClick={() => {
                  setDateMode(mode)
                  if (d) setDate(d)
                }}
                className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  dateMode === mode
                    ? 'bg-[#e53935] border-[#e53935] text-white'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
            {/* Currency picker — inline with date buttons */}
            <div className="relative shrink-0 ml-1">
              <button onClick={() => setShowCPicker(v => !v)}
                className="flex items-center gap-0.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs font-medium whitespace-nowrap">
                {currency}<ChevronDown size={12} className="text-gray-400" />
              </button>
              {showCurrencyPicker && (
                <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 min-w-[80px] max-h-[180px] overflow-y-auto">
                  {ALL_CURRENCIES.map(c => (
                    <button key={c} onClick={() => { setCurrency(c); setShowCPicker(false) }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                        currency === c ? 'text-red-500 font-semibold' : 'text-gray-700'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Custom date input — only shown when "其他/Other" is active */}
          {dateMode === 'other' && (
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mt-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          )}
        </div>
      </div>

      {/* Fixed bottom: amount + numpad */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-2 pb-2">

        {/* Amount display */}
        <div className="flex items-baseline gap-1 bg-gray-50 rounded-xl px-4 py-1.5 mb-1.5">
          <span className="text-lg text-gray-400">{symbol}</span>
          <span className="text-3xl font-bold text-gray-800 tracking-tight flex-1 truncate">{amount}</span>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-4 gap-1">
          {['7','8','9'].map(k => (
            <button key={k} onClick={() => numPress(k)}
              className="py-[7px] bg-gray-50 rounded-xl text-lg font-medium text-gray-800 active:scale-95 transition-transform">
              {k}
            </button>
          ))}
          <button onClick={numDel}
            className="py-[7px] bg-white border border-gray-100 rounded-xl text-base text-gray-500 active:scale-95 transition-transform">
            ⌫
          </button>

          {['4','5','6'].map(k => (
            <button key={k} onClick={() => numPress(k)}
              className="py-[7px] bg-gray-50 rounded-xl text-lg font-medium text-gray-800 active:scale-95 transition-transform">
              {k}
            </button>
          ))}
          {/* "再记/More" only shown in add mode */}
          {editTx ? (
            <div className="py-[7px] bg-gray-50 rounded-xl" />
          ) : (
            <button onClick={() => handleSave(true)} disabled={submitting}
              className="py-[7px] bg-blue-500 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50">
              {t('addAgain')}
            </button>
          )}

          {['1','2','3'].map(k => (
            <button key={k} onClick={() => numPress(k)}
              className="py-[7px] bg-gray-50 rounded-xl text-lg font-medium text-gray-800 active:scale-95 transition-transform">
              {k}
            </button>
          ))}
          {/* Save/update spans 2 rows */}
          <button onClick={() => handleSave(false)} disabled={submitting}
            className="row-span-2 bg-red-500 text-white rounded-xl text-[15px] font-semibold active:scale-95 transition-transform disabled:opacity-50">
            {submitting ? '…' : editTx ? t('update') : t('save')}
          </button>

          <button onClick={() => numPress('0')}
            className="py-[7px] bg-gray-50 rounded-xl text-lg font-medium text-gray-800 active:scale-95 transition-transform">
            0
          </button>
          <button onClick={() => numPress('00')}
            className="py-[7px] bg-gray-50 rounded-xl text-lg font-medium text-gray-800 active:scale-95 transition-transform">
            00
          </button>
          <button onClick={() => numPress('.')}
            className="py-[7px] bg-white border border-gray-100 rounded-xl text-lg text-gray-600 active:scale-95 transition-transform">
            .
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-black/75 text-white px-5 py-2.5 rounded-full text-sm whitespace-nowrap z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
