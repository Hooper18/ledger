import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronRight, X, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS } from '../types'
import type { Currency } from '../types'
import type { Lang } from '../lib/i18n'

type ModalType = 'preferred' | 'default' | 'language' | null

export default function Settings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { baseCurrency, defaultCurrency, setBaseCurrency, setDefaultCurrency } = useCurrency()
  const { t, lang, setLang } = useLanguage()

  const [modal, setModal] = useState<ModalType>(null)
  const [saving, setSaving] = useState(false)

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
          <button className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left opacity-40" disabled>
            <span className="text-lg shrink-0">📤</span>
            <span className="flex-1 text-sm text-gray-800">{t('dataExport')}</span>
            <span className="text-xs text-gray-400 mr-1">{t('comingSoon')}</span>
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
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => !saving && setModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-2xl z-50 flex flex-col max-h-[70vh]"
            style={{ animation: 'slideUp .22s ease' }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-800">
                {modal === 'preferred' ? t('selectPreferredCurrency')
                : modal === 'default'   ? t('selectDefaultCurrency')
                : t('selectLanguage')}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* List */}
            {modal === 'language' ? (
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
