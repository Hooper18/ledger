import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'
import { useLastSync } from '../../hooks/useLastSync'
import { useSync } from '../../hooks/useSync'
import type { SyncKey } from '../../lib/lastSync'

interface LayoutProps {
  children: React.ReactNode
  hideNav?: boolean
}

const ALL_KEYS: SyncKey[] = ['transactions', 'categories', 'budgets']

export default function Layout({ children, hideNav = false }: LayoutProps) {
  // Layout 是 PWA 内"全局根容器"，把 sync orchestration 挂在这里：
  //  · 用户登录后立刻 push outbox + pull 最新数据
  //  · 监听 online 事件触发同步
  //  · 暴露 pendingCount 让 OfflineBanner 显示
  const { pendingCount, syncing, triggerSync } = useSync()
  const lastSyncedAt = useLastSync(ALL_KEYS)

  return (
    <div className="flex flex-col h-dvh max-w-md mx-auto bg-gray-50 relative overflow-hidden">
      <OfflineBanner
        lastSyncedAt={lastSyncedAt}
        pendingCount={pendingCount}
        syncing={syncing}
        onSync={triggerSync}
      />
      {/* Page content — leaves room for bottom nav */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {children}
      </main>

      {!hideNav && <BottomNav />}
    </div>
  )
}
