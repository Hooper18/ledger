import Layout from '../components/layout/Layout'
import AcademicCalendarView from '../components/views/AcademicCalendarView'
import type { SyncKey } from '../lib/lastSync'

const SYNC_KEYS: SyncKey[] = ['semester', 'calendar']

export default function AcademicCalendar() {
  return (
    <Layout title="校历" fixedHeight syncKeys={SYNC_KEYS}>
      <AcademicCalendarView />
    </Layout>
  )
}
