import Layout from '../components/layout/Layout'
import CalendarView from '../components/views/CalendarView'
import type { SyncKey } from '../lib/lastSync'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses', 'events']

export default function CalendarPage() {
  return (
    <Layout title="Calendar" fixedHeight syncKeys={SYNC_KEYS}>
      <CalendarView />
    </Layout>
  )
}
