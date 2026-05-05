import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

interface Props {
  /** 当前页所代表数据的最后一次成功拉取时间（ISO）。null 表示从未拉到过。 */
  lastSyncedAt?: string | null
}

/**
 * 形容词级别的"刚刚 / 5 分钟前 / 2 小时前 / 昨天 14:32 / 12-30 14:32"。
 * 离线场景的人最关心"这份数据有多旧"，相对时间在 24h 内最有用，
 * 超过就直接显示日期，避免"3 天前"这种到底准不准的疑惑。
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

export default function OfflineBanner({ lastSyncedAt }: Props) {
  const online = useOnlineStatus()
  // 让 banner 上的相对时间随时间自动刷新（每分钟一次足够）。
  const [, setTick] = useState(0)
  useEffect(() => {
    if (online) return
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [online])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-1.5 flex items-center gap-2 text-xs text-dim bg-hover border-b border-border"
    >
      <CloudOff size={12} className="shrink-0" aria-hidden />
      <span className="shrink-0">离线</span>
      {lastSyncedAt && (
        <>
          <span className="text-muted" aria-hidden>·</span>
          <span className="truncate">数据更新于 {formatRelative(lastSyncedAt)}</span>
        </>
      )}
    </div>
  )
}
