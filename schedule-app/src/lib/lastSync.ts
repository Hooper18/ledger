// 每个数据 hook 拉取成功后写一次时间戳，OfflineBanner 据此显示
// "数据更新于 X"。
//
// 键名故意不带 user/semester 后缀：
//  · 同一台浏览器同一时刻只有一个登录用户。
//  · 一个用户日常只看 active semester，写就是覆盖，读就是当前。
//  · 这样 Page 不用关心怎么拼 key，直接传 ['events','courses'] 即可。
//  · 用户切换 semester / 切换账号属于罕见操作，timestamp 短暂偏旧可接受。

const PREFIX = 'schedule:lastSync:'
const EVENT_NAME = 'schedule:sync-recorded'

export type SyncKey =
  | 'semester'
  | 'courses'
  | 'events'
  | 'calendar'
  | 'balance'

export function recordSync(key: SyncKey): string {
  const ts = new Date().toISOString()
  try {
    localStorage.setItem(PREFIX + key, ts)
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key, ts } }))
  } catch {
    // localStorage 不可用（隐私模式 / 配额满），静默失败；hook 内的 state 仍然更新。
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

/**
 * 从一组 ISO 时间戳里挑最早的一个（最旧的数据）。
 * 用在一个页面同时显示多个数据源时，banner 显示最旧那一份的时间戳，
 * 不会因为某一类刚刷新就让用户误以为整页都是最新的。
 */
export function oldestSync(...stamps: (string | null | undefined)[]): string | null {
  let oldest: string | null = null
  for (const s of stamps) {
    if (!s) continue
    if (oldest === null || s < oldest) oldest = s
  }
  return oldest
}

/**
 * 订阅 recordSync 事件。OfflineBanner 用这个让"数据更新于 X"
 * 在数据刷新后实时变化，不需要 Page 通过 prop 把时间戳传下来。
 */
export function subscribeSync(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}
