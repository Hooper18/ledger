import BottomNav from './BottomNav'

interface LayoutProps {
  children: React.ReactNode
  hideNav?: boolean
}

export default function Layout({ children, hideNav = false }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 relative overflow-hidden">
      {/* Page content — leaves room for bottom nav */}
      <main className={`flex-1 overflow-y-auto no-scrollbar ${hideNav ? '' : 'pb-16'}`}>
        {children}
      </main>

      {!hideNav && <BottomNav />}
    </div>
  )
}
