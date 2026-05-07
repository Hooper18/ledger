import Layout from '../components/layout/Layout'
import AcademicCalendarView from '../components/views/AcademicCalendarView'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'calendar']

export default function AcademicCalendar() {
  const t = useT()
  return (
    <Layout title={t('academic.pageTitle')} fixedHeight syncKeys={SYNC_KEYS}>
      <AcademicCalendarView />
    </Layout>
  )
}
