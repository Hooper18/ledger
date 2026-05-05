import Layout from '../components/layout/Layout'
import TimelineView from '../components/views/TimelineView'
import type { SyncKey } from '../lib/lastSync'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses', 'events']

export default function Timeline() {
  return (
    <Layout title="待办事项" syncKeys={SYNC_KEYS}>
      <TimelineView />
    </Layout>
  )
}
