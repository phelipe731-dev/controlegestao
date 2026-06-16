import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { AccountPage } from './pages/AccountPage'
import { CommunicationsPage } from './pages/CommunicationsPage'
import { DashboardPage } from './pages/DashboardPage'
import { EventsPage } from './pages/EventsPage'
import { ForgotPasswordPage, LoginPage } from './pages/AuthPages'
import { LeaderFormPage, LeaderListPage } from './pages/LeaderPages'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SupervisorFormPage, SupervisorListPage } from './pages/SupervisorPages'
import { SupporterFormPage, SupporterListPage } from './pages/SupporterPages'
import { TerritoriesPage } from './pages/TerritoriesPage'

export function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/supporters" element={<SupporterListPage />} />
          <Route path="/supporters/new" element={<SupporterFormPage />} />
          <Route path="/supporters/:id/edit" element={<SupporterFormPage />} />
          <Route path="/communications" element={<CommunicationsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/territories" element={<TerritoriesPage />} />
          <Route path="/leaders" element={<LeaderListPage />} />
          <Route path="/leaders/new" element={<LeaderFormPage />} />
          <Route path="/leaders/:id/edit" element={<LeaderFormPage />} />
          <Route path="/supervisors" element={<SupervisorListPage />} />
          <Route path="/supervisors/new" element={<SupervisorFormPage />} />
          <Route path="/supervisors/:id/edit" element={<SupervisorFormPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}
