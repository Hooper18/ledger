import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useSemesterBootstrap } from './hooks/useSemesterBootstrap'
import { useDataPrefetch } from './hooks/useDataPrefetch'
import InviteRedemptionBanner from './components/InviteRedemptionBanner'

const AuthPage = lazy(() => import('./pages/Auth'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Home = lazy(() => import('./pages/Home'))
const Timeline = lazy(() => import('./pages/Timeline'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Courses = lazy(() => import('./pages/Courses'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const Import = lazy(() => import('./pages/Import'))
const AcademicCalendar = lazy(() => import('./pages/AcademicCalendar'))
const WeeklySchedule = lazy(() => import('./pages/WeeklySchedule'))

function Loading({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-main">
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      {message && <div className="text-xs text-dim">{message}</div>}
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { done: bootstrapDone, error: bootstrapError } = useSemesterBootstrap()
  // 在登录后启动数据预取：把所有页面的读接口和懒加载 chunk 提前灌进
  // Workbox 缓存，离线时各页面才有得显示。
  useDataPrefetch()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/auth" replace />
  if (!bootstrapDone) return <Loading message="正在为你初始化学期数据…" />
  if (bootstrapError) {
    // Non-fatal — let the user into the app; each view already handles
    // the "no semester" empty state. Just log for debugging.
    console.warn('[bootstrap]', bootstrapError)
  }
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading, isRecoverySession } = useAuth()
  return (
    <>
      {user && <InviteRedemptionBanner />}
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route
            path="/auth"
            element={
              loading
                ? <Loading />
                : user && !isRecoverySession
                  ? <Navigate to="/" replace />
                  : <AuthPage />
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/todo" element={<Protected><Timeline /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
          <Route path="/timetable" element={<Protected><WeeklySchedule /></Protected>} />
          {/* Legacy URL; keeps bookmarks working after rename to /timetable. */}
          <Route path="/weekly" element={<Navigate to="/timetable" replace />} />
          <Route path="/courses" element={<Protected><Courses /></Protected>} />
          <Route path="/courses/:id" element={<Protected><CourseDetail /></Protected>} />
          <Route path="/import" element={<Protected><Import /></Protected>} />
          <Route path="/academic" element={<Protected><AcademicCalendar /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
