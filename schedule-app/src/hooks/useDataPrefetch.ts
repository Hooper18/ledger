import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineStatus } from './useOnlineStatus'
import { recordSync } from '../lib/lastSync'

/**
 * 登录 + 在线时，启动阶段后台预取所有页面用到的读接口，让 Workbox 把响应
 * 存进缓存；同时把懒加载的页面 chunk 也 import() 一遍，触发 SW 缓存对应 JS。
 *
 * 没这一步的话：用户从来没在线打开过 Calendar 这页，Workbox 缓存里就没有
 * Calendar 的数据 + JS chunk，离线进 Calendar 等于白屏。
 *
 * 每个用户每次会话只预取一次（startedFor.current 守卫）。预取错误会被吞，
 * 因为正常页面流程会再请求一次，错误会在那时正常上报。
 */

const startedFor = new Set<string>()

async function prefetchData(userId: string) {
  const { data: sem, error: semErr } = await supabase
    .from('semesters')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!semErr) recordSync('semester')
  if (!sem) return

  const semesterId = (sem as { id: string }).id

  const [courseRes, eventRes, calRes, balRes, txRes] = await Promise.allSettled([
    supabase
      .from('courses')
      .select('*')
      .eq('user_id', userId)
      .eq('semester_id', semesterId)
      .order('sort_order')
      .order('code'),
    supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('semester_id', semesterId)
      .order('date', { ascending: true, nullsFirst: false })
      .order('time', { ascending: true, nullsFirst: false })
      .order('sort_order'),
    supabase
      .from('academic_calendar')
      .select('*')
      .eq('semester_id', semesterId)
      .order('date', { ascending: true }),
    supabase
      .from('user_balance')
      .select('balance_cny')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('balance_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (courseRes.status === 'fulfilled' && !courseRes.value.error) {
    recordSync('courses')
    const list = (courseRes.value.data ?? []) as { id: string }[]
    if (list.length > 0) {
      // weekly_schedule 表通过 course_id 关联，得有 courses 才能拉
      await supabase
        .from('weekly_schedule')
        .select('*')
        .in('course_id', list.map((c) => c.id))
    }
  }
  if (eventRes.status === 'fulfilled' && !eventRes.value.error) recordSync('events')
  if (calRes.status === 'fulfilled' && !calRes.value.error) recordSync('calendar')
  if (
    balRes.status === 'fulfilled' &&
    !balRes.value.error &&
    txRes.status === 'fulfilled' &&
    !txRes.value.error
  ) {
    recordSync('balance')
  }
}

function prefetchPageChunks() {
  // 触发 import 让 vite 把懒加载 chunk 拉进 Workbox cache。
  // Promise 故意不 await：这是 fire-and-forget 的预热。
  void import('../pages/Home')
  void import('../pages/Timeline')
  void import('../pages/Calendar')
  void import('../pages/Courses')
  void import('../pages/CourseDetail')
  void import('../pages/Import')
  void import('../pages/AcademicCalendar')
  void import('../pages/WeeklySchedule')
}

export function useDataPrefetch() {
  const { user } = useAuth()
  const online = useOnlineStatus()
  // 用 ref 防止 React StrictMode 双挂载导致重复预取。
  const startedRef = useRef(false)

  useEffect(() => {
    if (!user || !online) return
    if (startedRef.current) return
    if (startedFor.has(user.id)) return
    startedRef.current = true
    startedFor.add(user.id)

    // 让出主线程，不阻塞首次渲染。
    const id = window.setTimeout(() => {
      prefetchPageChunks()
      void prefetchData(user.id).catch(() => {
        // 静默：正常用户流程会再请求一次，到时候出错会正常报。
        startedFor.delete(user.id)
        startedRef.current = false
      })
    }, 500)
    return () => window.clearTimeout(id)
  }, [user, online])
}
