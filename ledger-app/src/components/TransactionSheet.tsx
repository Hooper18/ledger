import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Edit2, Trash2 } from 'lucide-react'
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTransactions } from '../hooks/useTransactions'
import { CURRENCY_SYMBOLS } from '../types'
import type { TxDetail, Currency } from '../types'

interface Props {
  tx: TxDetail
  displayCurrency: Currency
  onClose: () => void
  onDeleted: (id: string) => void
}

export default function TransactionSheet({ tx, displayCurrency, onClose, onDeleted }: Props) {
  const navigate = useNavigate()
  const { rates } = useCurrency()
  const { t } = useLanguage()
  const { remove: removeTx } = useTransactions()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function convertTo(amount: number, from: string): number {
    if (from === displayCurrency) return amount
    return (amount / (rates[from] ?? 1)) * (rates[displayCurrency] ?? 1)
  }

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const dispSymbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const origSymbol = CURRENCY_SYMBOLS[tx.currency as Currency] ?? tx.currency
  const converted  = convertTo(tx.amount, tx.currency)
  const isExpense  = tx.type === 'expense'
  const isIncome   = tx.type === 'income'

  const typeLabel = tx.type === 'expense' ? t('expense') : tx.type === 'income' ? t('income') : t('transfer')

  async function handleDelete() {
    setDeleting(true)
    await removeTx(tx.id)
    setDeleting(false)
    onDeleted(tx.id)
    onClose()
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Sheet — flex column with max height so buttons never go off-screen */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-2xl z-50 flex flex-col max-h-[85vh]"
        style={{ animation: 'slideUp .25s ease' }}
      >
        {/* ── Sticky top: handle + header ── */}
        <div className="shrink-0 bg-white rounded-t-2xl">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3">
            <span className="text-base font-semibold text-gray-800">{t('txDetail')}</span>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Amount card */}
          <div className="flex flex-col items-center py-5 bg-gray-50 mx-4 rounded-2xl mb-4">
            <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-3xl mb-2">
              {tx.categories?.icon ?? '📦'}
            </div>
            <p className="text-sm text-gray-500 mb-1">{tx.categories?.name ?? t('uncategorized')}</p>
            <p className={`text-3xl font-bold ${isExpense ? 'text-red-500' : isIncome ? 'text-green-500' : 'text-blue-500'}`}>
              {isExpense ? '-' : isIncome ? '+' : ''}{dispSymbol} {fmt(converted)}
            </p>
            {tx.currency !== displayCurrency && (
              <p className="text-xs text-gray-400 mt-1">{t('originalLabel')}{origSymbol} {fmt(tx.amount)}</p>
            )}
          </div>

          {/* Detail rows */}
          <div className="mx-4 mb-4 border border-gray-100 rounded-xl overflow-hidden">
            {[
              { label: t('typeLabel'),     value: typeLabel },
              { label: t('currencyLabel'), value: `${origSymbol} ${tx.currency}` },
              { label: t('dateLabel'),     value: tx.date },
              { label: t('noteLabel'),     value: tx.description || '—' },
            ].map((row, i) => (
              <div key={row.label}
                className={`flex justify-between items-center px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <span className="text-sm text-gray-400">{row.label}</span>
                <span className="text-sm text-gray-800 font-medium max-w-[60%] text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sticky bottom: action buttons ── */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 pt-3 pb-8">
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/add', { state: { tx } })}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-500 rounded-xl font-semibold text-sm active:bg-blue-100 transition-colors"
            >
              <Edit2 size={15} /> {t('edit')}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-500 rounded-xl font-semibold text-sm active:bg-red-100 transition-colors"
            >
              <Trash2 size={15} /> {t('delete')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm — z-[100] ensures it renders above the sheet (z-50) */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[100]" />
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-xl">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-base font-semibold text-gray-800 mb-1">{t('confirmDelete')}</h3>
              <p className="text-sm text-gray-500 mb-5">{t('confirmDeleteMsg')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {deleting ? t('deleting') : t('confirmDelete')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </>,
    document.body,
  )
}
