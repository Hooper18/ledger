import { useEffect, useRef, useState } from 'react'
import {
  User,
  Bell,
  LogOut,
  Wallet,
  HelpCircle,
  Ticket,
  Languages,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useBalance } from '../../hooks/useBalance'
import { formatUSD, LOW_BALANCE_THRESHOLD_USD } from '../../lib/balance'
import { useLocale, useT } from '../../i18n'
import type { Locale } from '../../i18n'
import TopupModal from '../TopupModal'
import HelpModal from '../HelpModal'
import RedeemInviteModal from '../RedeemInviteModal'
import NotificationSettingsModal from '../NotificationSettingsModal'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const { balance } = useBalance()
  const { locale, setLocale } = useLocale()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const low = balance !== null && balance < LOW_BALANCE_THRESHOLD_USD

  const langOptions: Array<{ value: Locale; label: string }> = [
    { value: 'zh', label: t('language.zh') },
    { value: 'en', label: t('language.en') },
  ]

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-lg hover:bg-hover transition-colors ${
          open ? 'bg-hover text-text' : 'text-dim'
        }`}
        aria-label={t('userMenu.menuLabel')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 rounded-xl bg-main border border-border shadow-lg overflow-hidden z-30"
        >
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              {t('userMenu.currentAccount')}
            </div>
            <div className="text-xs text-text truncate mt-0.5">
              {user?.email ?? '—'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setTopupOpen(true)
            }}
            className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-text hover:bg-hover transition-colors"
          >
            <Wallet size={14} className={low ? 'text-red-500' : 'text-dim'} />
            <span>{t('userMenu.balance')}</span>
            <span
              className={`ml-auto text-xs ${low ? 'text-red-500 font-medium' : 'text-dim'}`}
            >
              {balance === null ? '…' : formatUSD(balance)}
              <span className="ml-1 text-[9px] text-muted font-normal">
                USD
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setRedeemOpen(true)
            }}
            className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-text hover:bg-hover transition-colors"
          >
            <Ticket size={14} className="text-dim" />
            <span>{t('userMenu.redeemInvite')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setHelpOpen(true)
            }}
            className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-text hover:bg-hover transition-colors"
          >
            <HelpCircle size={14} className="text-dim" />
            <span>{t('userMenu.help')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setNotifOpen(true)
            }}
            className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-text hover:bg-hover transition-colors"
          >
            <Bell size={14} className="text-dim" />
            <span>{t('userMenu.notifications')}</span>
          </button>

          <div className="px-3 py-2.5 flex items-center gap-2 text-sm text-text">
            <Languages size={14} className="text-dim" />
            <span>{t('userMenu.language')}</span>
            <div
              role="radiogroup"
              aria-label={t('userMenu.language')}
              className="ml-auto inline-flex rounded-lg bg-hover p-0.5"
            >
              {langOptions.map((opt) => {
                const active = locale === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLocale(opt.value)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-main text-text shadow-xs'
                        : 'text-dim hover:text-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-border" />

          <button
            type="button"
            onClick={async () => {
              setOpen(false)
              await signOut()
            }}
            className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={14} />
            <span>{t('userMenu.signOut')}</span>
          </button>
        </div>
      )}

      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} />}
      <RedeemInviteModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <NotificationSettingsModal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </div>
  )
}
