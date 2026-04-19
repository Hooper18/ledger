import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronRight, X, Check, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS } from '../types'
import type { Currency } from '../types'
import type { Lang } from '../lib/i18n'
import { exportTransactionsCsv } from '../utils/exportCsv'
import type { ExportRange } from '../utils/exportCsv'
import PasswordInput from '../components/PasswordInput'

type ModalType = 'preferred' | 'default' | 'language' | 'changePwd' | 'export' | null

export default function Settings() {
  const navigate = useNavigate()
  const { user, signIn, signOut, updatePassword } = useAuth()
  const { baseCurrency, defaultCurrency, setBaseCurrency, setDefaultCurrency } = useCurrency()
  const { t, lang, setLang } = useLanguage()

  const [modal, setModal] = useState<ModalType>(null)
  const [saving, setSaving] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const [exportRange, setExportRange] = useState<ExportRange>('all')
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportLoading, setExportLoading] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'nodata' | 'error'; text: string } | null>(null)

  async function handleSelect(c: Currency) {
    setSaving(true)
    try {
      if (modal === 'preferred') await setBaseCurrency(c)
      if (modal === 'default')   await setDefaultCurrency(c)
      setModal(null)
    } catch {
      // error already logged in CurrencyContext; UI reverted by setBase/setDefault(prev)
    } finally {
      setSaving(false)
    }
  }

  function handleSelectLang(l: Lang) {
    setLang(l)
    setModal(null)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/auth', { replace: true })
  }

  function openExport() {
    setExportRange('all')
    setExportFrom('')
    setExportTo('')
    setExportLoading(false)
    setExportMsg(null)
    setModal('export')
  }

  async function handleExport() {
    if (!user) return
    if (exportRange === 'custom' && (!exportFrom || !exportTo)) return
    setExportLoading(true)
    setExportMsg(null)
    const result = await exportTransactionsCsv({
      userId: user.id,
      baseCurrency,
      range: exportRange,
      customFrom: exportFrom || undefined,
      customTo: exportTo || undefined,
    })
    setExportLoading(false)
    if (!result.success) {
      setExportMsg({ type: 'error', text: t('exportFailed') + (result.error ? ': ' + result.error : '') })
    } else if (result.rowCount === 0) {
      setExportMsg({ type: 'nodata', text: t('exportNoData') })
    } else {
      setExportMsg({ type: 'success', text: t('exportSuccess', { count: result.rowCount! }) })
    }
  }

  function openChangePwd() {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwdError('')
    setPwdSuccess('')
    setPwdLoading(false)
    setModal('changePwd')
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')

    if (newPassword.length < 6) { setPwdError(t('passwordTooShort')); return }
    if (newPassword !== confirmPassword) { setPwdError(t('passwordMismatch')); return }
    if (newPassword === oldPassword) { setPwdError(t('changePwdSameAsOld')); return }

    setPwdLoading(true)

    const email = user?.email
    if (!email) { setPwdError(t('changePwdUpdateFailed')); setPwdLoading(false); return }

    const { error: verifyError } = await signIn(email, oldPassword)
    if (verifyError) {
      setPwdLoading(false)
      setPwdError(t('changePwdWrongCurrent'))
      return
    }

    const { error: updateError } = await updatePassword(newPassword)
    if (updateError) {
      setPwdLoading(false)
      setPwdError(t('changePwdUpdateFailed'))
      return
    }

    setPwdSuccess(t('changePwdSuccess'))
    setTimeout(async () => {
      await signOut()
      navigate('/auth', { replace: true })
    }, 1500)
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all'

  const currentValue = modal === 'preferred' ? baseCurrency : defaultCurrency

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100 shrink-0">
        <h1 className="text-lg font-bold text-gray-800">{t('settingsTitle')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Account card */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-11 h-11 rounded-full bg-[#e53935]/10 flex items-center justify-center shrink-0">
              <span className="text-[#e53935] font-bold text-lg">
                {user?.email?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('personalAccount')}</p>
            </div>
          </div>
        </div>

        {/* Currency settings */}
        <p className="px-5 pt-5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('currencySection')}</p>
        <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setModal('preferred')}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
          >
            <span className="text-lg shrink-0">💱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{t('preferredCurrency')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('preferredCurrencyDesc')}</p>
            </div>
            <span className="text-sm font-medium text-[#e53935] mr-1">
              {CURRENCY_SYMBOLS[baseCurrency]} {baseCurrency}
            </span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>

          <div className="border-t border-gray-50" />

          <button
            onClick={() => setModal('default')}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
          >
            <span className="text-lg shrink-0">✏️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{t('defaultCurrency')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('defaultCurrencyDesc')}</p>
            </div>
            <span className="text-sm font-medium text-[#e53935] mr-1">
              {CURRENCY_SYMBOLS[defaultCurrency]} {defaultCurrency}
            </span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Language settings */}
        <p className="px-5 pt-5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('languageSection')}</p>
        <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setModal('language')}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
          >
            <span className="text-lg shrink-0">🌐</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{t('languageLabel')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('languageDesc')}</p>
            </div>
            <span className="text-sm font-medium text-[#e53935] mr-1">
              {lang === 'zh' ? t('langZh') : t('langEn')}
            </span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Account Security */}
        <p className="px-5 pt-5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('changePwdSection')}</p>
        <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={openChangePwd}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
          >
            <Lock size={18} className="text-gray-500 shrink-0" />
            <span className="flex-1 text-sm text-gray-800">{t('changePwdLabel')}</span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Other settings */}
        <p className="px-5 pt-5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('otherSection')}</p>
        <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => navigate('/budget')}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left"
          >
            <span className="text-lg shrink-0">🎯</span>
            <span className="flex-1 text-sm text-gray-800">{t('budgetManagement')}</span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
          <div className="border-t border-gray-50" />
          <button onClick={openExport} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left">
            <span className="text-lg shrink-0">📤</span>
            <span className="flex-1 text-sm text-gray-800">{t('dataExport')}</span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Sign out */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-red-50 text-left"
          >
            <LogOut size={18} className="text-[#e53935] shrink-0" />
            <span className="text-sm font-medium text-[#e53935]">{t('signOut')}</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 my-6">{t('appVersion')}</p>
      </div>

      {/* Bottom sheet (currency picker + language picker) */}
      {modal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => !(saving || pwdLoading || exportLoading) && setModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-2xl z-50 flex flex-col max-h-[70vh]"
            style={{ animation: 'slideUp .22s ease' }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-800">
                {modal === 'preferred'  ? t('selectPreferredCurrency')
                : modal === 'default'   ? t('selectDefaultCurrency')
                : modal === 'language'  ? t('selectLanguage')
                : modal === 'export'    ? t('dataExport')
                : t('changePwdTitle')}
              </h2>
              <button onClick={() => !(saving || pwdLoading || exportLoading) && setModal(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            {modal === 'export' ? (
              <div className="overflow-y-auto flex-1 px-4 pt-3 pb-6">
                <div className="space-y-3">
                  {/* Range options */}
                  {(['all', 'thisMonth', 'custom'] as ExportRange[]).map(value => {
                    const label = value === 'all' ? t('exportRangeAll')
                      : value === 'thisMonth' ? t('exportRangeThisMonth')
                      : t('exportRangeCustom')
                    const selected = exportRange === value
                    return (
                      <button
                        key={value}
                        onClick={() => { setExportRange(value); setExportMsg(null) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-sm ${
                          selected ? 'bg-red-50 border-[#e53935] text-[#e53935] font-medium' : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected ? 'border-[#e53935]' : 'border-gray-300'
                        }`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-[#e53935]" />}
                        </div>
                        {label}
                      </button>
                    )
                  })}

                  {/* Custom date inputs */}
                  {exportRange === 'custom' && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('exportFromLabel')}</label>
                        <input
                          type="date"
                          value={exportFrom}
                          max={exportTo || undefined}
                          onChange={e => setExportFrom(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('exportToLabel')}</label>
                        <input
                          type="date"
                          value={exportTo}
                          min={exportFrom || undefined}
                          onChange={e => setExportTo(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {/* Result message */}
                  {exportMsg && (
                    <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
                      exportMsg.type === 'success' ? 'bg-green-50 text-green-700'
                      : exportMsg.type === 'nodata' ? 'bg-gray-50 text-gray-600'
                      : 'bg-red-50 text-red-600'
                    }`}>
                      <span className="shrink-0 mt-0.5">
                        {exportMsg.type === 'success' ? '✅' : exportMsg.type === 'nodata' ? '📭' : '⚠️'}
                      </span>
                      <span>{exportMsg.text}</span>
                    </div>
                  )}

                  {/* Export button */}
                  <button
                    onClick={handleExport}
                    disabled={exportLoading || (exportRange === 'custom' && (!exportFrom || !exportTo))}
                    className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm tracking-wide active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mt-1"
                  >
                    {exportLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {t('exporting')}
                      </span>
                    ) : t('exportBtn')}
                  </button>
                </div>
              </div>
            ) : modal === 'changePwd' ? (
              <form onSubmit={handleChangePwd} className="overflow-y-auto flex-1 px-4 pt-3 pb-6">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('changePwdCurrentLabel')}</label>
                    <PasswordInput
                      value={oldPassword}
                      onChange={setOldPassword}
                      placeholder={t('changePwdCurrentPlaceholder')}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('changePwdNewLabel')}</label>
                    <PasswordInput
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder={t('changePwdNewPlaceholder')}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('changePwdConfirmLabel')}</label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t('changePwdConfirmPlaceholder')}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {pwdError && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                      <span className="shrink-0 mt-0.5">⚠️</span>
                      <span>{pwdError}</span>
                    </div>
                  )}
                  {pwdSuccess && (
                    <div className="flex items-start gap-2 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
                      <span className="shrink-0 mt-0.5">✅</span>
                      <span>{pwdSuccess}</span>
                    </div>
                  )}
                  {!pwdSuccess && (
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm tracking-wide active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mt-1"
                    >
                      {pwdLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          {t('changePwdSaving')}
                        </span>
                      ) : t('changePwdSaveBtn')}
                    </button>
                  )}
                </div>
              </form>
            ) : modal === 'language' ? (
              <div className="overflow-y-auto flex-1">
                {(['zh', 'en'] as Lang[]).map((l, i) => (
                  <button
                    key={l}
                    onClick={() => handleSelectLang(l)}
                    className={`w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 transition-colors ${
                      l === lang ? 'bg-red-50' : ''
                    } ${i > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <span className="flex-1 text-sm text-gray-700 text-left">
                      {l === 'zh' ? t('langZh') : t('langEn')}
                    </span>
                    {l === lang && <Check size={16} className="text-[#e53935] shrink-0" />}
                  </button>
                ))}
                <div className="h-6" />
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {SUPPORTED_CURRENCIES.map((c, i) => {
                  const selected = c === currentValue
                  return (
                    <button
                      key={c}
                      onClick={() => handleSelect(c)}
                      disabled={saving}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 disabled:opacity-50 transition-colors ${
                        selected ? 'bg-red-50' : ''
                      } ${i > 0 ? 'border-t border-gray-50' : ''}`}
                    >
                      <span className="w-10 text-base font-bold text-gray-500 shrink-0">
                        {CURRENCY_SYMBOLS[c]}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 text-left">{CURRENCY_LABELS[c]}</span>
                      {selected && (
                        <Check size={16} className="text-[#e53935] shrink-0" />
                      )}
                    </button>
                  )
                })}
                <div className="h-6" />
              </div>
            )}
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
        </>
      )}
    </div>
  )
}
