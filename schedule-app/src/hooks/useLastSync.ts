import { useEffect, useMemo, useState } from 'react'
import {
  oldestSync,
  readSync,
  subscribeSync,
  type SyncKey,
} from '../lib/lastSync'

/**
 * 给定一组数据 key，返回它们里最旧的一次成功拉取时间。
 * 数据 hook 拉到新数据时会派发 schedule:sync-recorded 事件，
 * 这里订阅事件保证 banner "数据更新于 X" 实时反映最新状态。
 */
export function useLastSync(keys: SyncKey[]): string | null {
  // join 一下作为 effect 的依赖，避免每次渲染都重新订阅。
  const dep = useMemo(() => keys.slice().sort().join('|'), [keys])

  const [stamp, setStamp] = useState<string | null>(() =>
    oldestSync(...keys.map((k) => readSync(k))),
  )

  useEffect(() => {
    const recompute = () => {
      setStamp(oldestSync(...keys.map((k) => readSync(k))))
    }
    recompute()
    return subscribeSync(recompute)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  return stamp
}
