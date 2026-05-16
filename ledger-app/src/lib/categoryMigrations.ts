import { supabase } from './supabase'
import { loadCache, saveCache } from './dataCache'
import { triggerRefresh } from './sync'
import type { Database } from './database.types'

type DbCategory = Database['public']['Tables']['categories']['Row']

/**
 * 把用户名为"宠物"的分类 UPDATE 成"水果"（含图标）。每次冷启动跑一次，
 * 完全幂等：第一次成功后第二次起 UPDATE 命中 0 行无副作用。
 *
 * **不再用 localStorage flag 短路**：之前的版本可能在 UPDATE 因为 RLS 静默
 * 命中 0 行 / 网络异常时被错误地标"完成"，导致永远不重试。现在每次启动都
 * 尝试，cheap，幂等。
 *
 *  · 用 .select('id') 拿到实际更新行数；> 0 才 triggerRefresh
 *  · 本函数失败也不影响 UI —— useCategories.normalizePet 已经把 '宠物'
 *    在读路径归一为 '水果'，UI 不依赖 UPDATE 成功
 *  · 只覆盖用户自己的 categories 行（RLS 自动限制）
 */
export async function migratePetToFruit(userId: string): Promise<void> {
  // 1) 把 localStorage 快照里的"宠物"提前改掉（即便 supabase 不动也保证下次
  //    冷启动 useCategories 初始 render 就是新名）。
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

  // 2) 远端 UPDATE。用 .select('id') 是为了拿到实际命中的行数 ——
  //    不加的话 data 为 null，区分不出"没匹配到行"和"命中并改了"。
  try {
    const { data, error } = await supabase
      .from('categories')
      .update({ name: '水果', icon: '🍎' })
      .eq('user_id', userId)
      .eq('name', '宠物')
      .select('id')
    if (error) return
    if (data && data.length > 0) {
      // 真改了行：通知所有 hook 重新拉，覆盖 SW NetworkFirst 命中旧缓存的情况
      triggerRefresh()
    }
  } catch {
    // 网络/解析错；下次冷启动重试
  }
}
