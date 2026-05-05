import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

interface Props {
  /** 当前页关心数据的最后一次成功拉取时间（ISO）。 */
  lastSyncedAt?: string | null
  /** outbox 队列里待同步的条数。0 = 全部已同步。 */
  pendingCount?: number
  /** 用户点击 banner 时触发的手动同步动作；为 null 不显示按钮。 */
  onSync?: (() => void) | null
  /** 正在同步时禁用按钮。 */
  syncing?: boolean
}

/**
 * 相对时间格式：30 秒内"刚刚"、1 小时内分钟、24 小时内小时、超过用具体日期。
 * 离线场景人最关心"这份数据有多旧"，相对时间在 24h 内最有用，超过就直接
 * 显示日期，避免"3 天前"这种到底准不准的疑惑。
 */
function formatRelative(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const now = Date.now()
  const diffSec = Math.floor((now - then.getTime()) / 1000)
  if (diffSec < 30) return '刚刚'
  if (diffSec < 60) return `${diffSec} 秒前`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  const sameYear = then.getFullYear() === new Date().getFullYear()
  const m = String(then.getMonth() + 1).padStart(2, '0')
  const d = String(then.getDate()).padStart(2, '0')
  const hh = String(then.getHours()).padStart(2, '0')
  const mm = String(then.getMinutes()).padStart(2, '0')
  return sameYear
    ? `${m}-${d} ${hh}:${mm}`
    : `${then.getFullYear()}-${m}-${d} ${hh}:${mm}`
}

export default function OfflineBanner({
  lastSyncedAt,
  pendingCount = 0,
  onSync,
  syncing = false,
}: Props) {
  const online = useOnlineStatus()
  // 让相对时间随时间自动刷新，每分钟一次足够
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // 在线 + 没有待同步 + 不需要展示 = 不渲染（保持界面干净）
  if (online && pendingCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-1.5 flex items-center gap-2 text-xs text-gray-600 bg-gray-100 border-b border-gray-200"
    >
      {!online && (
        <>
          <CloudOff size={12} className="shrink-0" aria-hidden />
          <span className="shrink-0">离线</span>
        </>
      )}
      {pendingCount > 0 && (
        <>
          {!online && <span className="text-gray-400" aria-hidden>·</span>}
          <span className="shrink-0">{pendingCount} 条待同步</span>
        </>
      )}
      {!online && lastSyncedAt && (
        <>
          <span className="text-gray-400" aria-hidden>·</span>
          <span className="truncate">数据更新于 {formatRelative(lastSyncedAt)}</span>
        </>
      )}
      <span className="flex-1" />
      {online && onSync && pendingCount > 0 && (
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-1 text-blue-600 disabled:opacity-50"
        >
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中' : '立即同步'}
        </button>
      )}
    </div>
  )
}
