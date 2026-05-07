import { useState } from 'react'
import {
  Copy,
  Check,
  RefreshCw,
  Ticket,
  Wallet,
  MessageCircle,
} from 'lucide-react'
import Modal from './shared/Modal'
import { supabase } from '../lib/supabase'
import { useBalance, type BalanceTransaction } from '../hooks/useBalance'
import { formatUSD, LOW_BALANCE_THRESHOLD_USD } from '../lib/balance'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../i18n'
import type { TFn } from '../i18n'

type Props = {
  onClose: () => void
}

const DEV_WECHAT = 'hituchenguang'

function friendlyRedeemError(raw: string, t: TFn): string {
  if (raw.includes('already redeemed')) return t('topup.redeemErrAlreadyDone')
  if (raw.includes('invalid or used code')) return t('topup.redeemErrInvalid')
  if (raw.includes('not authenticated')) return t('topup.redeemErrAuth')
  return raw
}

export default function TopupModal({ onClose }: Props) {
  const { user } = useAuth()
  const { balance, transactions, loading, reload } = useBalance()
  const t = useT()
  const low = balance !== null && balance < LOW_BALANCE_THRESHOLD_USD

  return (
    <Modal open title={t('topup.title')} onClose={onClose} size="md">
      <div className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted flex items-center gap-1.5">
              <Wallet size={12} /> {t('topup.currentBalance')}
            </div>
            <div
              className={`text-2xl font-semibold mt-1 ${low ? 'text-red-500' : 'text-text'}`}
            >
              {balance === null ? '…' : formatUSD(balance)}
              <span className="ml-1.5 text-xs text-muted font-normal align-baseline">
                USD
              </span>
            </div>
            <div className="text-[10px] text-muted mt-1">
              {t('topup.usdNote')}
            </div>
            {low && (
              <div className="text-xs text-red-500 mt-1">{t('topup.lowBalance')}</div>
            )}
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-hover text-dim disabled:opacity-50"
            aria-label={t('topup.refreshAria')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <RedeemSection onRedeemed={reload} />

        <TopupSection userEmail={user?.email ?? null} />

        <TransactionsSection transactions={transactions} />
      </div>
    </Modal>
  )
}

function RedeemSection({ onRedeemed }: { onRedeemed: () => void }) {
  const t = useT()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const redeem = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      setErr(t('topup.redeemEmpty'))
      return
    }
    setSubmitting(true)
    setErr(null)
    setSuccessMsg(null)
    const { data, error } = await supabase.rpc('redeem_invite_code', {
      p_code: trimmed,
    })
    setSubmitting(false)
    if (error) {
      setErr(friendlyRedeemError(error.message, t))
      return
    }
    const newBalance =
      typeof data === 'object' && data !== null && 'new_balance' in data
        ? Number((data as { new_balance: number }).new_balance)
        : null
    setSuccessMsg(
      newBalance !== null
        ? t('topup.redeemSuccess', { balance: formatUSD(newBalance) })
        : t('topup.redeemSuccessNoBalance'),
    )
    setCode('')
    onRedeemed()
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Ticket size={14} className="text-accent" /> {t('topup.redeemHeading')}
      </h3>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/\s+/g, '')
            setCode(v)
            if (err) setErr(null)
            if (successMsg) setSuccessMsg(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !submitting) {
              e.preventDefault()
              redeem()
            }
          }}
          placeholder={t('topup.redeemPlaceholder')}
          maxLength={16}
          disabled={submitting}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-text font-mono tracking-widest placeholder:text-muted placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-accent uppercase text-sm"
        />
        <button
          type="button"
          onClick={redeem}
          disabled={submitting || !code.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60 shrink-0"
        >
          {submitting ? t('topup.redeemSubmitting') : t('topup.redeemSubmit')}
        </button>
      </div>
      {err && (
        <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {err}
        </div>
      )}
      {successMsg && (
        <div className="text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Check size={12} className="shrink-0" /> {successMsg}
        </div>
      )}
    </section>
  )
}

function TopupSection({ userEmail }: { userEmail: string | null }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  const copyWechat = async () => {
    try {
      await navigator.clipboard.writeText(DEV_WECHAT)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn('[TopupModal] clipboard write failed', e)
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <MessageCircle size={14} className="text-accent" /> {t('topup.topupHeading')}
      </h3>
      <p className="text-xs text-dim">{t('topup.topupHint')}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border font-mono text-sm text-text truncate select-all">
          {DEV_WECHAT}
        </code>
        <button
          type="button"
          onClick={copyWechat}
          className={`px-3 py-2 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1 transition-colors ${
            copied
              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
              : 'bg-card border border-border text-dim hover:bg-hover'
          }`}
        >
          {copied ? (
            <>
              <Check size={12} /> {t('topup.copiedBtn')}
            </>
          ) : (
            <>
              <Copy size={12} /> {t('topup.copyBtn')}
            </>
          )}
        </button>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        {t('topup.topupNotePre')}
        {userEmail && t('topup.topupNoteEmail', { email: userEmail })}
        {t('topup.topupNotePost')}
      </p>
    </section>
  )
}

function TransactionsSection({
  transactions,
}: {
  transactions: BalanceTransaction[]
}) {
  const t = useT()
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t('topup.txHeading')}</h3>
      {transactions.length === 0 ? (
        <div className="text-xs text-muted py-4 text-center bg-card border border-border rounded-lg">
          {t('topup.txEmpty')}
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TransactionRow({ tx }: { tx: BalanceTransaction }) {
  const isCredit = tx.type === 'topup' || tx.type === 'refund'
  const sign = isCredit ? '+' : '-'
  const color = isCredit ? 'text-emerald-500' : 'text-red-500'
  const amount = Math.abs(Number(tx.amount_cny))
  const date = new Date(tx.created_at)
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

  return (
    <li className="px-3 py-2.5 flex items-center justify-between bg-card gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">{tx.description ?? tx.type}</div>
        <div className="text-[10px] text-muted mt-0.5">{dateStr}</div>
      </div>
      <div className={`text-sm font-medium shrink-0 ${color}`}>
        {sign}
        {formatUSD(amount)}
      </div>
    </li>
  )
}
