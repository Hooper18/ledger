import Layout from '../components/layout/Layout'
import ImportView from '../components/views/ImportView'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function Import() {
  const t = useT()
  return (
    <Layout title={t('import.pageTitle')} syncKeys={SYNC_KEYS}>
      <ImportView />
    </Layout>
  )
}
