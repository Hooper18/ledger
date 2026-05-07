import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useT } from '../i18n'

type Props = {
  onClose: () => void
}

export default function TermsModal({ onClose }: Props) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-main border border-border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold">{t('terms.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-hover text-dim"
            aria-label={t('terms.closeAria')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-dim space-y-3">
          <p>{t('terms.intro')}</p>

          <h3 className="font-semibold text-text mt-4">{t('terms.featuresHeading')}</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('terms.feature1')}</li>
            <li>{t('terms.feature2')}</li>
            <li>{t('terms.feature3')}</li>
            <li>{t('terms.feature4')}</li>
          </ul>

          <h3 className="font-semibold text-text mt-4">{t('terms.feeHeading')}</h3>
          <p>{t('terms.feeBody')}</p>

          <h3 className="font-semibold text-text mt-4">{t('terms.disclaimerHeading')}</h3>
          <p>
            {t('terms.disclaimerPre')}
            <span className="font-semibold text-text">{t('terms.disclaimerEm')}</span>
            {t('terms.disclaimerPost')}
          </p>
          <p>{t('terms.disclaimerThird')}</p>
          <p>{t('terms.disclaimerRefund')}</p>
          <p>{t('terms.disclaimerFinal')}</p>
        </div>
      </div>
    </div>
  )
}
