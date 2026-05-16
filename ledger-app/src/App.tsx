import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import { syncReminder } from './lib/notifications'
import { migratePetToFruit } from './lib/categoryMigrations'
import Layout from './components/layout/Layout'
import Auth from './pages/Auth'
import Home from './pages/Home'
// AddTransaction 是 App 最高频的入口，打进主 bundle 避免任何 chunk fetch /
// Suspense fallback —— 弱网 + precache 偶尔失效时也不会出现"点了记一笔
// 但首屏白屏 / 类目空白"的情况。chunk gzip 仅 ~3KB。
import AddTransaction from './pages/AddTransaction'

const Calendar = lazy(() => import('./pages/Calendar'))
const Charts = lazy(() => import('./pages/Charts'))
const Settings = lazy(() => import('./pages/Settings'))
const Budget = lazy(() => import('./pages/Budget'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const About = lazy(() => import('./pages/About'))
const CategoryOrder = lazy(() => import('./pages/CategoryOrder'))

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  // 启动时同步提醒计划 — 系统通知队列在重启/卸载后会丢，每次开 App 重新挂上。
  useEffect(() => {
    syncReminder({
      title: t('reminderNotifyTitle'),
      body: t('reminderNotifyBody'),
    }).catch(() => {})
  }, [t])

  // 用户就绪后跑一次"宠物 → 水果"分类改名（幂等，已完成则即刻 return）
  useEffect(() => {
    if (!user) return
    void migratePetToFruit(user.id)
  }, [user])

  if (loading) return <LoadingScreen />

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route
          path="/auth"
          element={user ? <Navigate to="/" replace /> : <Auth />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Home />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute>
              <Layout hideNav>
                <AddTransaction />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Layout>
                <Calendar />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/charts"
          element={
            <ProtectedRoute>
              <Layout>
                <Charts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/budget"
          element={
            <ProtectedRoute>
              <Layout hideNav>
                <Budget />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/category-order"
          element={
            <ProtectedRoute>
              <Layout hideNav>
                <CategoryOrder />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <CurrencyProvider>
            <AppRoutes />
          </CurrencyProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
