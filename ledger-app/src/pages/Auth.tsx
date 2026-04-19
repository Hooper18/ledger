import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import type { Lang } from '../lib/i18n'
import PasswordInput from '../components/PasswordInput'

type Mode = 'login' | 'register' | 'forgot'

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, resetPassword } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError(t('passwordTooShort'))
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) {
        setError(
          error.message.includes('Invalid login credentials')
            ? t('loginError')
            : error.message
        )
      } else {
        navigate('/')
      }
    } else {
      const { error } = await signUp(email, password)
      if (error) {
        setError(
          error.message.includes('already registered')
            ? t('emailExistsError')
            : error.message
        )
      } else {
        setMessage(t('registerSuccess'))
        setPassword('')
        setConfirmPassword('')
      }
    }

    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const { error } = await resetPassword(email)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setError(t('forgotRateLimit'))
      } else {
        setError(t('forgotSendFailed'))
      }
    } else {
      setMessage(t('forgotEmailSent'))
    }
    setLoading(false)
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all'

  const agreement = t('loginAgreement')
  const linkText = t('loginAgreementLinkText')
  const agreementParts = agreement.split(linkText)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-10 pb-10 text-center relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10" />
        <button
          onClick={() => setLang((lang === 'zh' ? 'en' : 'zh') as Lang)}
          className="absolute top-4 right-4 text-white/80 text-sm font-medium px-2 py-1 rounded hover:bg-white/10 transition-colors"
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-wide">{t('appName')}</h1>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-5 relative">
        <div className="bg-white rounded-2xl shadow-lg p-6">

          {mode === 'forgot' ? (
            /* ── Forgot password view ── */
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-base font-semibold text-gray-800">{t('forgotPasswordTitle')}</h2>
                <p className="text-sm text-gray-400 mt-1">{t('forgotPasswordDesc')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('emailLabel')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {message ? (
                <div className="flex items-start gap-2 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
                  <span className="shrink-0 mt-0.5">✅</span>
                  <span>{message}</span>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm tracking-wide active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mt-1"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {t('forgotSending')}
                    </span>
                  ) : t('forgotSendBtn')}
                </button>
              )}

              <p className="text-center text-xs text-gray-400 mt-2">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-primary font-medium"
                >
                  {t('forgotBackToLogin')}
                </button>
              </p>
            </form>
          ) : (
            /* ── Login / Register view ── */
            <>
              <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      mode === m
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    {m === 'login' ? t('loginTab') : t('registerTab')}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('emailLabel')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('passwordLabel')}</label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder={t('passwordPlaceholder')}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  {mode === 'login' && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-primary/70 hover:text-primary transition-colors"
                      >
                        {t('forgotPasswordLink')}
                      </button>
                    </div>
                  )}
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('confirmPasswordLabel')}</label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t('confirmPasswordPlaceholder')}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {message && (
                  <div className="flex items-start gap-2 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
                    <span className="shrink-0 mt-0.5">✅</span>
                    <span>{message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm tracking-wide active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mt-1"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {t('loadingBtn')}
                    </span>
                  ) : mode === 'login' ? t('loginBtn') : t('registerBtn')}
                </button>
              </form>

              {mode === 'login' && (
                <p className="text-center text-xs text-gray-400 mt-4">
                  {t('noAccount')}
                  <button onClick={() => switchMode('register')} className="text-primary font-medium ml-1">
                    {t('registerNow')}
                  </button>
                </p>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 px-4">
          {agreementParts.length === 2 ? (
            <>
              {agreementParts[0]}
              <Link to="/about" className="text-primary hover:underline">
                {linkText}
              </Link>
              {agreementParts[1]}
            </>
          ) : agreement}
        </p>
      </div>
    </div>
  )
}
