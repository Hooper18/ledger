import { useState } from 'react'
import Layout from '../components/layout/Layout'
import TimelineView from '../components/views/TimelineView'
import { useNewEventControl } from '../components/shared/useNewEventControl'
import { useSemester } from '../hooks/useSemester'
import { useCourses } from '../hooks/useCourses'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses', 'events']

export default function Timeline() {
  const t = useT()
  const { semester } = useSemester()
  const { courses } = useCourses(semester?.id)
  // TimelineView 内部自己 useEvents，新事件保存后用 refreshKey 触发其
  // 重挂载 → 刷新事件列表。比把 events state 提到这里再透传简单。
  const [refreshKey, setRefreshKey] = useState(0)

  const newEvent = useNewEventControl({
    semesterId: semester?.id ?? '',
    courses,
    onSaved: () => setRefreshKey((k) => k + 1),
  })

  return (
    <Layout
      title={t('timeline.pageTitle')}
      syncKeys={SYNC_KEYS}
      headerRight={semester ? newEvent.headerButton : undefined}
    >
      <TimelineView key={refreshKey} />
      {semester && newEvent.fab}
      {semester && newEvent.modal}
    </Layout>
  )
}
