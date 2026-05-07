import Layout from '../components/layout/Layout'
import CalendarView from '../components/views/CalendarView'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses', 'events']

export default function CalendarPage() {
  const t = useT()
  return (
    <Layout title={t('calendar.pageTitle')} fixedHeight syncKeys={SYNC_KEYS}>
      <CalendarView />
    </Layout>
  )
}
