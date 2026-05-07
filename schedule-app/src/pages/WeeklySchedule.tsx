import { useState } from 'react'
import Layout from '../components/layout/Layout'
import WeeklyScheduleView from '../components/views/WeeklyScheduleView'
import { useNewEventControl } from '../components/shared/useNewEventControl'
import { useSemester } from '../hooks/useSemester'
import { useCourses } from '../hooks/useCourses'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function WeeklySchedulePage() {
  const t = useT()
  const { semester } = useSemester()
  const { courses } = useCourses(semester?.id)
  const [refreshKey, setRefreshKey] = useState(0)

  const newEvent = useNewEventControl({
    semesterId: semester?.id ?? '',
    courses,
    onSaved: () => setRefreshKey((k) => k + 1),
  })

  return (
    <Layout
      title={t('weekly.pageTitle')}
      fixedHeight
      syncKeys={SYNC_KEYS}
      headerRight={semester ? newEvent.headerButton : undefined}
    >
      <WeeklyScheduleView key={refreshKey} />
      {semester && newEvent.fab}
      {semester && newEvent.modal}
    </Layout>
  )
}
