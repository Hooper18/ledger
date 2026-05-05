import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { recordSync, readSync } from '../lib/lastSync'
import { loadCache, saveCache } from '../lib/dataCache'
import type { Course, WeeklySchedule } from '../lib/types'

export function useCourses(semesterId: string | null | undefined) {
  const { user } = useAuth()
  const cachedCourses = loadCache<Course[]>('courses') ?? []
  const cachedSchedule = loadCache<WeeklySchedule[]>('schedule') ?? []
  const [courses, setCourses] = useState<Course[]>(cachedCourses)
  const [schedule, setSchedule] = useState<WeeklySchedule[]>(cachedSchedule)
  const [loading, setLoading] = useState(cachedCourses.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readSync('courses'),
  )

  const load = useCallback(async () => {
    if (!user || !semesterId) {
      setCourses([])
      setSchedule([])
      setLoading(false)
      return
    }
    setError(null)
    const { data: courseData, error: courseErr } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester_id', semesterId)
      .order('sort_order')
      .order('code')
    if (courseErr) {
      setError(courseErr.message)
      setLoading(false)
      return
    }
    const list = (courseData ?? []) as Course[]
    setCourses(list)
    saveCache('courses', list)

    if (list.length > 0) {
      const ids = list.map((c) => c.id)
      const { data: sched, error: schedErr } = await supabase
        .from('weekly_schedule')
        .select('*')
        .in('course_id', ids)
      if (schedErr) setError(schedErr.message)
      const schedList = (sched ?? []) as WeeklySchedule[]
      setSchedule(schedList)
      if (!schedErr) saveCache('schedule', schedList)
    } else {
      setSchedule([])
      saveCache('schedule', [])
    }
    setLastSyncedAt(recordSync('courses'))
    setLoading(false)
  }, [user, semesterId])

  useEffect(() => {
    load()
  }, [load])

  return { courses, schedule, loading, error, reload: load, lastSyncedAt }
}
