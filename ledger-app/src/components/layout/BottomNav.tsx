import { NavLink, useNavigate } from 'react-router-dom'
import { Home, PlusCircle, CalendarDays, BarChart2, Settings } from 'lucide-react'

const tabs = [
  { path: '/', label: '首页', Icon: Home },
  { path: '/calendar', label: '日历', Icon: CalendarDays },
  { path: '/add', label: '', Icon: PlusCircle, isCTA: true },
  { path: '/charts', label: '统计', Icon: BarChart2 },
  { path: '/settings', label: '设置', Icon: Settings },
]

export default function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav className="shrink-0 w-full bg-white border-t border-gray-100 safe-bottom z-10">
      <div className="flex items-end h-16 px-1">
        {tabs.map(({ path, label, Icon, isCTA }) => {
          if (isCTA) {
            return (
              <div key={path} className="flex-1 flex justify-center items-center -mt-5">
                <button
                  onClick={() => navigate('/add')}
                  className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
                  aria-label="记一笔"
                >
                  <Icon size={28} color="white" strokeWidth={2} />
                </button>
              </div>
            )
          }

          return (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 pb-2 pt-1 ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
