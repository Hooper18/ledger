import Layout from '../components/layout/Layout'
import CoursesView from '../components/views/CoursesView'
import type { SyncKey } from '../lib/lastSync'
import { useT } from '../i18n'

const SYNC_KEYS: SyncKey[] = ['semester', 'courses']

export default function Courses() {
  const t = useT()
  return (
    <Layout title={t('courses.pageTitle')} syncKeys={SYNC_KEYS}>
      <CoursesView />
    </Layout>
  )
}
