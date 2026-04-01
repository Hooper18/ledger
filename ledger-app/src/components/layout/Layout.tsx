import BottomNav from './BottomNav'

interface LayoutProps {
  children: React.ReactNode
  hideNav?: boolean
}

export default function Layout({ children, hideNav = false }: LayoutProps) {
  return (
    <div className="flex flex-col h-dvh max-w-md mx-auto bg-gray-50 relative overflow-hidden">
      {/* Page content — leaves room for bottom nav */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {children}
      </main>

      {!hideNav && <BottomNav />}
    </div>
  )
}
