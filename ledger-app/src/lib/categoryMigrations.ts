import { supabase } from './supabase'
import { loadCache, saveCache } from './dataCache'
import { triggerRefresh } from './sync'
import type { Database } from './database.types'

type DbCategory = Database['public']['Tables']['categories']['Row']

const PET_TO_FRUIT_FLAG = 'ledger_migrated_pet_to_fruit'

/**
 * 一次性把用户名为"宠物"的分类改成"水果"（含图标）。
 *
 *  · 写本地 cache：把 localStorage 里 categories 快照里的同名行就地改名 +
 *    换 icon，下次 useCategories 初始渲染就直接是新名，不会闪一帧旧名。
 *  · 写远端：supabase update 把 DB 行更新过去，跨设备生效。WHERE name='宠物'
 *    是过滤条件，重复运行命中 0 行，无副作用 —— 完全幂等。
 *  · 成功后写 localStorage flag 跳过后续轮询，避免每次冷启动多打一次 supabase。
 *    UPDATE 失败（网络/RLS）则不写 flag，下次启动重试。
 *
 *  · 只覆盖用户自己的 categories 行（RLS 自动限制）。
 *  · 如果用户从未把"宠物"建到 DB 里（只在 buildFallback 兜底里见过），
 *    UPDATE 命中 0 行也没关系，cache 同样无该项，本函数即 no-op。
 */
export async function migratePetToFruit(userId: string): Promise<void> {
  try {
    if (localStorage.getItem(PET_TO_FRUIT_FLAG) === '1') return
  } catch {
    // localStorage 不可用时直接跳过，避免每次都重试 UPDATE
    return
  }

  // 1) 先把 localStorage 快照里的"宠物"改掉，下次渲染直接拿到新名
  try {
    const cached = loadCache<DbCategory[]>('categories')
    if (cached) {
      let dirty = false
      const next = cached.map((c) => {
        if (c.name === '宠物') {
          dirty = true
          return { ...c, name: '水果', icon: '🍎' }
        }
        return c
      })
      if (dirty) saveCache('categories', next)
    }
  } catch {
    // cache 写失败不阻塞 DB UPDATE
  }

  // 2) 远端 UPDATE，跨设备生效
  try {
    const { error } = await supabase
      .from('categories')
      .update({ name: '水果', icon: '🍎' })
      .eq('user_id', userId)
      .eq('name', '宠物')
    if (error) return // 网络/RLS 错，下次重试
  } catch {
    return
  }

  // 3) 标记完成 + 触发所有 hook 重新拉取
  try {
    localStorage.setItem(PET_TO_FRUIT_FLAG, '1')
  } catch {
    // 写失败不影响主流程，下次冷启动还会跑一次（幂等）
  }
  triggerRefresh()
}
