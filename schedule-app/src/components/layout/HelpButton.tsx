import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import HelpModal from '../HelpModal'
import { useT } from '../../i18n'

export default function HelpButton() {
  const [open, setOpen] = useState(false)
  const t = useT()
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-hover text-dim transition-colors"
        aria-label={t('help.tutorial')}
      >
        <HelpCircle size={18} />
      </button>
      <HelpModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
