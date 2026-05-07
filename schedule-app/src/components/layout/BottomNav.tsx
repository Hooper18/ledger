import { NavLink } from 'react-router-dom'
import { Home, ListChecks, Calendar, Plus } from 'lucide-react'
import { useT } from '../../i18n'
import type { TKey } from '../../i18n'

// Bottom navigation for mobile. 课表 is intentionally NOT here — the Home
// page surfaces "今日课程" + a "查看完整课表" shortcut, which covers the
// in-situ use cases without burning a permanent nav slot.
const items: Array<{
  to: string
  labelKey: TKey
  Icon: typeof Home
  end?: boolean
}> = [
  { to: '/', labelKey: 'nav.home', Icon: Home, end: true },
  { to: '/todo', labelKey: 'nav.todo', Icon: ListChecks },
  { to: '/calendar', labelKey: 'nav.calendar', Icon: Calendar },
  { to: '/import', labelKey: 'nav.import', Icon: Plus },
]

export default function BottomNav() {
  const t = useT()
  return (
    <nav className="safe-bottom fixed bottom-0 inset-x-0 z-20 bg-main/95 backdrop-blur border-t border-border md:hidden">
      <div className="grid grid-cols-4 h-14">
        {items.map(({ to, labelKey, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <Icon size={20} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
