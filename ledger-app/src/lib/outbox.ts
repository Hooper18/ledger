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
