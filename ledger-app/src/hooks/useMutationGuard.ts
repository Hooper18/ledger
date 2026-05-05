import { useOnlineStatus } from './useOnlineStatus'

/**
 * 写操作守门 —— 注意 ledger-app 的语义跟 schedule-app 不同：
 * 这里离线**仍允许写**（写入 outbox，恢复网络后同步），所以 disabled 永远
 * 是 false。保留这个 hook 是为了将来可能想限制特定操作（比如重置密码、
 * 充值这类必须在线的）时有统一入口。
 */
export function useMutationGuard() {
  const online = useOnlineStatus()
  return {
    online,
    disabled: false,
    title: undefined,
  } as const
}
