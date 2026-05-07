import Layout from '../components/layout/Layout'
import TimelineView from '../components/views/TimelineView'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses', 'events']

export default function Timeline() {
  const t = useT()
  return (
    <Layout title={t('timeline.pageTitle')} syncKeys={SYNC_KEYS}>
      <TimelineView />
    </Layout>
  )
}
