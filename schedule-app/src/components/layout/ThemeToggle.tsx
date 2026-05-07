import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, getStoredTheme, type Theme } from '../../lib/theme'
import { useT } from '../../i18n'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const t = useT()

  useEffect(() => {
    const t0 = getStoredTheme()
    setTheme(t0)
    applyTheme(t0)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg hover:bg-hover text-dim transition-colors"
      aria-label={t('theme.toggle')}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
