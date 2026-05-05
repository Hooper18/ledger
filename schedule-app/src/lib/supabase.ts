import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  throw new Error('缺少 Supabase 环境变量：请复制 .env.example 为 .env 并填写。')
}

/**
 * 离线时让 fetch 在 100ms 内主动 abort，让 Service Worker 立刻回退到缓存。
 *
 * 不加这层的话：移动端关闭 wifi+流量后 fetch() 不会立刻 reject —— 操作
 * 系统会先做 DNS / TCP 重试，要 1~3 秒才失败。叠加 Workbox NetworkFirst
 * 的 networkTimeoutSeconds=3，串行三四个请求（bootstrap → semester →
 * courses → weekly_schedule）就要等 10 秒以上。
 *
 * 在线时不动，让 supabase / Workbox 走正常逻辑。navigator.onLine 偶尔会
 * 撒谎（captive portal 等），那种情况下不 abort，落回 Workbox 自己的
 * networkTimeoutSeconds 兜底，不会比修复前更差。
 */
function fetchWithFastOfflineAbort(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (typeof navigator === 'undefined' || navigator.onLine) {
    return fetch(input, init)
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 100)
  // 透传调用方传入的 signal —— 上游 abort 时也要 abort 我们的请求。
  const userSignal = init?.signal
  if (userSignal) {
    if (userSignal.aborted) ctrl.abort()
    else userSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() =>
    clearTimeout(timer),
  )
}

// detectSessionInUrl lets the client consume the #access_token hash that
// Supabase appends when the user returns from an email-confirmation /
// password-recovery link, so they land back already signed in.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
  global: {
    fetch: fetchWithFastOfflineAbort,
  },
})
