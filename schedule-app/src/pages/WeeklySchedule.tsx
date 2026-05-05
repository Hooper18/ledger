import Layout from '../components/layout/Layout'
import WeeklyScheduleView from '../components/views/WeeklyScheduleView'
import type { SyncKey } from '../lib/lastSync'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function WeeklySchedulePage() {
  return (
    <Layout title="课表" fixedHeight syncKeys={SYNC_KEYS}>
      <WeeklyScheduleView />
    </Layout>
  )
}
