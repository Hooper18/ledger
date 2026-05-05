import Layout from '../components/layout/Layout'
import ImportView from '../components/views/ImportView'
import type { SyncKey } from '../lib/lastSync'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function Import() {
  return (
    <Layout title="Add" syncKeys={SYNC_KEYS}>
      <ImportView />
    </Layout>
  )
}
