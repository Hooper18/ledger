import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)
  const { updatePassword } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setExpired(false)

    if (newPassword.length < 6) {
      setError(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    setLoading(true)
    const { error } = await updatePassword(newPassword)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('session') || msg.includes('not authenticated') || msg.includes('auth session missing')) {
        setError(t('resetLinkExpired'))
        setExpired(true)
      } else {
        setError(t('resetSaveFailed'))
      }
    } else {
      setMessage(t('resetSuccess'))
      setTimeout(() => navigate('/'), 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-5">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-800">{t('resetPasswordTitle')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('resetPasswordDesc')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('resetNewPasswordLabel')}</label>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t('resetNewPasswordPlaceholder')}
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('resetConfirmPasswordLabel')}</label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t('resetConfirmPasswordPlaceholder')}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {expired && (
            <p className="text-center text-xs text-gray-400">
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="text-primary font-medium"
              >
                {t('resetGoToSignIn')}
              </button>
            </p>
          )}

          {message && (
            <div className="flex items-start gap-2 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
              <span className="shrink-0 mt-0.5">✅</span>
              <span>{message}</span>
            </div>
          )}

          {!message && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm tracking-wide active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t('resetSaving')}
                </span>
              ) : t('resetSaveBtn')}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
