// 数据 hook 的本地快照层。每次成功拉到数据后存一份到 localStorage，hook
// 下次初始化（包括重载、下拉刷新）直接从快照读，先把上次的数据渲染出来，
// 再在背景悄悄发请求更新。
//
// 这是 Workbox 缓存之上的二级兜底：
//  · Workbox 在 SW 层面缓存 HTTP 响应，但需要走"hook 调 supabase → fetch
//    → SW 拦截 → 返回缓存"这一整条链路，再回到 React 设置 state，几百
//    毫秒的延迟里页面是空的。
//  · 这一层让 React 在第一次 render 时就有数据 —— 重载完几乎瞬间出内容。
//
// 不按 user.id 区分键名：同一时刻一台浏览器只一个登录用户，切账号时新
// 用户的 fetch 会瞬间覆盖快照，体验上至多是"切完账号闪一下旧数据"，可接受。

const PREFIX = 'schedule:cache:'

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
