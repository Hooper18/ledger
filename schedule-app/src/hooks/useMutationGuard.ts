import { useOnlineStatus } from './useOnlineStatus'

/**
 * 写操作按钮统一守门：离线时返回 disabled=true + 一句解释。
 * 用法：
 *   const guard = useMutationGuard()
 *   <button disabled={saving || guard.disabled} title={guard.title}>...</button>
 *
 * 把"离线 → 不能改数据"集中到一处，加新模态时不会忘记加防呆。
 */
export function useMutationGuard() {
  const online = useOnlineStatus()
  return {
    online,
    disabled: !online,
    title: online ? undefined : '离线状态下不可用',
  } as const
}
