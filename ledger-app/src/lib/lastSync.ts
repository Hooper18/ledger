// 数据 hook 拉到新数据后写一次时间戳，OfflineBanner 据此显示
// "数据更新于 X"。键名不带 user 后缀：同一时刻一台浏览器只一个登录
// 用户，切账号时新的 fetch 会覆盖。

const PREFIX = 'ledger:lastSync:'
const EVENT_NAME = 'ledger:sync-recorded'

export type SyncKey = 'transactions' | 'categories' | 'budgets' | 'profile'

export function recordSync(key: SyncKey): string {
  const ts = new Date().toISOString()
  try {
    localStorage.setItem(PREFIX + key, ts)
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key, ts } }))
  } catch {
    // localStorage 不可用（隐私模式 / 配额满），静默
  }
  return ts
}

export function readSync(key: SyncKey): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function oldestSync(...stamps: (string | null | undefined)[]): string | null {
  let oldest: string | null = null
  for (const s of stamps) {
    if (!s) continue
    if (oldest === null || s < oldest) oldest = s
  }
  return oldest
}

export function subscribeSync(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}
