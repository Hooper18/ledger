import Layout from '../components/layout/Layout'
import WeeklyScheduleView from '../components/views/WeeklyScheduleView'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function WeeklySchedulePage() {
  const t = useT()
  return (
    <Layout title={t('weekly.pageTitle')} fixedHeight syncKeys={SYNC_KEYS}>
      <WeeklyScheduleView />
    </Layout>
  )
}
