// 数据 hook 的 localStorage 快照。每次成功拉到数据后存一份，hook
// 下次初始化（包括重载、下拉刷新）直接从快照读，先把上次的数据渲染
// 出来，再在背景悄悄请求更新 —— 避免重载后短暂闪空白。
//
// 不按 user.id 区分键名：同一时刻一台浏览器只一个登录用户，切账号时
// 新用户的 fetch 会瞬间覆盖快照，至多"切完账号闪一下旧数据"，可接受。

const PREFIX = 'ledger:cache:'

export function loadCache<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(PREFIX + key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

export function saveCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage 不可用 / 配额满；静默失败，下次拉到再重试。
  }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}
