// 离线写入队列。每次本地 insert/update/delete 都先写一份到 outbox，
// 网络恢复时按顺序冲到 Supabase。每条记录格式：
//
//   { id, op, table, row, rowId, createdAt, retries }
//
//  · id        outbox 自己的唯一 ID（区别于 row 的 ID）
//  · op        'insert' / 'update' / 'delete' / 'upsert'
//  · table     'transactions' / 'categories' / 'budgets' / 'users_profile'
//  · row       insert/upsert/update 的载荷（对 delete 是 undefined）
//  · rowId     update/delete 时目标 row 的 id
//  · retries   失败重试次数（暂时只用于日志，没做指数退避）
//
// 顺序：FIFO，确保同一条 row 上的 update 在 insert 之后到达服务器。

const STORAGE_KEY = 'ledger:outbox'
const EVENT_NAME = 'ledger:outbox-changed'

export type OutboxOp = 'insert' | 'update' | 'delete' | 'upsert'
export type OutboxTable = 'transactions' | 'categories' | 'budgets' | 'users_profile'

export interface OutboxEntry {
  id: string
  op: OutboxOp
  table: OutboxTable
  row?: Record<string, unknown>
  rowId?: string
  /** upsert 用的 onConflict 字段名，列表用逗号分隔。 */
  onConflict?: string
  createdAt: string
  retries: number
}

function read(): OutboxEntry[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? (JSON.parse(s) as OutboxEntry[]) : []
  } catch {
    return []
  }
}

function write(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    // localStorage 不可用 / 配额满；这种情况下离线写入会丢，下次拉的时候
    // 服务端没数据，体现为本地 state 也丢 —— 不过 5MB 配额够装几年，
    // 实际上不会触发。
  }
}

export function enqueue(entry: Omit<OutboxEntry, 'id' | 'createdAt' | 'retries'>): OutboxEntry {
  const full: OutboxEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retries: 0,
  }
  const list = read()
  list.push(full)
  write(list)
  return full
}

export function list(): OutboxEntry[] {
  return read()
}

export function remove(id: string): void {
  const next = read().filter((e) => e.id !== id)
  write(next)
}

export function bumpRetry(id: string): void {
  const list = read()
  const idx = list.findIndex((e) => e.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], retries: list[idx].retries + 1 }
    write(list)
  }
}

export function count(): number {
  return read().length
}

export function clear(): void {
  write([])
}

export function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}

/**
 * 把 outbox 里 pending 的写入"叠加"到服务端拉回来的数据上 —— 解决"刚写
 * 完离线，hook reload 拉回的服务端响应（实际是 SW 旧缓存）把本地写入冲
 * 没了"这种竞态。push 完成后 outbox 是空的，这函数等同于直接返回 rows。
 */
export function applyOutboxTo<T extends { id: string }>(
  table: OutboxTable,
  rows: T[],
): T[] {
  const pending = read().filter((e) => e.table === table)
  if (pending.length === 0) return rows
  const map = new Map<string, T>(rows.map((r) => [r.id, r]))
  for (const entry of pending) {
    if (entry.op === 'insert' && entry.row) {
      const r = entry.row as unknown as T
      map.set(r.id, r)
    } else if (entry.op === 'update' && entry.rowId && entry.row) {
      const existing = map.get(entry.rowId)
      if (existing) {
        map.set(entry.rowId, { ...existing, ...(entry.row as object) } as T)
      }
      // update 目标不在服务端数据里 —— 可能服务端那行已经被别的设备删掉，
      // 我们的 update 推上去会失败。保守起见这条不显示。
    } else if (entry.op === 'upsert' && entry.row) {
      const r = entry.row as unknown as T
      const existing = map.get(r.id)
      map.set(r.id, existing ? ({ ...existing, ...(entry.row as object) } as T) : r)
    } else if (entry.op === 'delete' && entry.rowId) {
      map.delete(entry.rowId)
    }
  }
  return Array.from(map.values())
}
