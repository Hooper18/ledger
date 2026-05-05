import { supabase } from './supabase'
import * as outbox from './outbox'
import type { OutboxEntry } from './outbox'

// 同步引擎：负责把 outbox 里的本地写操作冲到 Supabase，并在适当时机
// 让所有数据 hook 重新拉取最新数据。
//
// 触发顺序：push 先 pull 后。push 完了再 pull 才能保证服务端数据包括
// 刚刚推上去的本地写入。
//
// hooks 不直接调 supabase 拉数据 —— 而是订阅 ledger:sync-trigger 事件，
// 由这里在合适时机统一派发，避免 hooks 各自重复拉 + 时序乱掉。

const REFRESH_EVENT = 'ledger:sync-trigger'
const STATE_EVENT = 'ledger:sync-state'

export type SyncState = 'idle' | 'pushing' | 'pulling'

let currentState: SyncState = 'idle'
let inFlight: Promise<void> | null = null

function setState(s: SyncState) {
  currentState = s
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: s }))
}

export function getSyncState(): SyncState {
  return currentState
}

export function subscribeSyncState(cb: (s: SyncState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as SyncState)
  window.addEventListener(STATE_EVENT, handler)
  return () => window.removeEventListener(STATE_EVENT, handler)
}

/**
 * 触发所有数据 hook 重新拉取（hook 里要 useEffect 订阅这个事件）。
 */
export function triggerRefresh(): void {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT))
}

export function subscribeRefresh(cb: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, cb)
  return () => window.removeEventListener(REFRESH_EVENT, cb)
}

/**
 * 把单条 outbox 记录冲到 Supabase。返回 true 表示成功 / 服务端已同步。
 * 4xx 视为"失败但不应重试"（数据问题，重试也救不回来），返回 true 让
 * 队列把它移除避免一直堵在前面卡后面的请求。
 */
async function flushOne(entry: OutboxEntry): Promise<boolean> {
  try {
    if (entry.op === 'insert' && entry.row) {
      const { error } = await supabase.from(entry.table).insert(entry.row)
      if (error) return classifyError(error)
      return true
    }
    if (entry.op === 'update' && entry.row && entry.rowId) {
      const { error } = await supabase
        .from(entry.table)
        .update(entry.row)
        .eq('id', entry.rowId)
      if (error) return classifyError(error)
      return true
    }
    if (entry.op === 'upsert' && entry.row) {
      const { error } = await supabase
        .from(entry.table)
        .upsert(entry.row, entry.onConflict ? { onConflict: entry.onConflict } : undefined)
      if (error) return classifyError(error)
      return true
    }
    if (entry.op === 'delete' && entry.rowId) {
      const { error } = await supabase
        .from(entry.table)
        .delete()
        .eq('id', entry.rowId)
      if (error) return classifyError(error)
      return true
    }
    // 不认识的 op，直接 drop 避免堵队列
    return true
  } catch {
    // 网络异常 / fetch 抛错；保留重试
    return false
  }
}

function classifyError(err: { message?: string; code?: string }): boolean {
  // PostgREST 网络层错误一般有 message "Failed to fetch"；这种保留重试。
  // 业务错误（PGRST 系列、约束违反等）保留 false 让用户感知，但为了不
  // 死锁队列，这里仍然返回 true 让它出队。错误信息会被吞掉，可后续接 toast。
  const msg = (err.message ?? '').toLowerCase()
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return false
  }
  // 其它错误视为已确认失败（例如 RLS 拒绝 / 唯一约束冲突），直接出队
  console.warn('[sync] outbox entry rejected:', err)
  return true
}

/**
 * 顺序刷 outbox 队列。失败的留在原位，下次再试。
 */
export async function pushOutbox(): Promise<void> {
  setState('pushing')
  try {
    // 复制 list，因为期间可能有新条目入队
    const snapshot = outbox.list()
    for (const entry of snapshot) {
      const ok = await flushOne(entry)
      if (ok) {
        outbox.remove(entry.id)
      } else {
        outbox.bumpRetry(entry.id)
        // 一旦遇到网络失败，停止后续尝试 —— 网都断了再发也是徒劳
        break
      }
    }
  } finally {
    setState('idle')
  }
}

/**
 * 触发所有 hook 重新拉数据。
 */
export async function pullAll(): Promise<void> {
  setState('pulling')
  try {
    triggerRefresh()
    // 让 hooks 有机会响应这个事件并各自跑 reload；不阻塞返回
  } finally {
    // 状态立即回到 idle，hooks 自己内部 loading 才是数据的"是否在加载"
    setState('idle')
  }
}

/**
 * 一次完整的同步：先 push 再 pull。
 * 同一时刻只允许一个 sync 在跑，避免并发跑两次 push 把同一条记录提交两次。
 */
export async function sync(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // 离线：跳过 push（fetch 会被 fast-abort），只触发本地缓存读取
        return
      }
      await pushOutbox()
      await pullAll()
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}
