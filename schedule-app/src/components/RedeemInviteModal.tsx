import { useEffect, useState } from 'react'
import { Ticket, CheckCircle2 } from 'lucide-react'
import Modal from './shared/Modal'
import { supabase } from '../lib/supabase'
import { useBalance } from '../hooks/useBalance'
import { formatUSD } from '../lib/balance'
import { useT } from '../i18n'
import type { TFn } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
}

function friendlyError(raw: string, t: TFn): string {
  if (raw.includes('already redeemed')) {
    return t('topup.redeemErrAlreadyDone')
  }
  if (raw.includes('invalid or used code')) {
    return t('topup.redeemErrInvalid')
  }
  if (raw.includes('not authenticated')) {
    return t('topup.redeemErrAuth')
  }
  return raw
}

export default function RedeemInviteModal({ open, onClose }: Props) {
  const { reload: reloadBalance } = useBalance()
  const t = useT()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [successBalance, setSuccessBalance] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setCode('')
      setErr(null)
      setSuccessBalance(null)
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (successBalance === null) return
    const tm = window.setTimeout(() => onClose(), 1800)
    return () => window.clearTimeout(tm)
  }, [successBalance, onClose])

  const redeem = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      setErr(t('redeem.empty'))
      return
    }
    setSubmitting(true)
    setErr(null)
    const { data, error } = await supabase.rpc('redeem_invite_code', {
      p_code: trimmed,
    })
    setSubmitting(false)
    if (error) {
      setErr(friendlyError(error.message, t))
      return
    }
    const newBalance =
      typeof data === 'object' && data !== null && 'new_balance' in data
        ? Number((data as { new_balance: number }).new_balance)
        : null
    setSuccessBalance(newBalance)
    reloadBalance()
  }

  return (
    <Modal open={open} title={t('redeem.title')} onClose={onClose}>
      {successBalance !== null ? (
        <div className="py-4 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 size={36} className="text-emerald-500" />
          <div className="text-text font-semibold">{t('redeem.successTitle')}</div>
          <div className="text-sm text-dim">
            {t('redeem.successDescPre')}
            <span className="text-text font-mono font-semibold">
              {formatUSD(successBalance)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-dim">
            <Ticket size={14} className="shrink-0 mt-0.5 text-accent" />
            <span>
              {t('redeem.introPre')}
              <span className="text-text font-semibold">{t('redeem.introBalance')}</span>
              {t('redeem.introPost')}
            </span>
          </div>
          <input
            autoFocus
            value={code}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/\s+/g, '')
              setCode(v)
              if (err) setErr(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !submitting) {
                e.preventDefault()
                redeem()
              }
            }}
            placeholder={t('redeem.placeholder')}
            maxLength={16}
            disabled={submitting}
            className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-text text-center font-mono text-lg tracking-[0.25em] placeholder:text-muted focus:outline-none focus:border-accent uppercase"
          />
          {err && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-2.5 rounded-lg bg-card border border-border text-dim text-sm"
            >
              {t('redeem.cancel')}
            </button>
            <button
              type="button"
              onClick={redeem}
              disabled={submitting || !code.trim()}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
            >
              {submitting ? t('redeem.submitting') : t('redeem.submit')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
