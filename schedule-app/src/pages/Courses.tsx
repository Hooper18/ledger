import Layout from '../components/layout/Layout'
import CoursesView from '../components/views/CoursesView'
import type { SyncKey } from '../lib/lastSync'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function Courses() {
  return (
    <Layout title="Courses" syncKeys={SYNC_KEYS}>
      <CoursesView />
    </Layout>
  )
}
