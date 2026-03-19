import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DomainsPage from './pages/DomainsPage'
import ContactsPage from './pages/ContactsPage'
import CampaignListPage from './pages/CampaignListPage'
import CampaignBuilderPage from './pages/CampaignBuilderPage'
import CampaignStatsPage from './pages/CampaignStatsPage'
import WarmupPage from './pages/WarmupPage'
import BouncesPage from './pages/BouncesPage'
import LogsPage from './pages/LogsPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="domains" element={<DomainsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="campaigns" element={<CampaignListPage />} />
        <Route path="campaigns/new" element={<CampaignBuilderPage />} />
        <Route path="campaigns/:id/edit" element={<CampaignBuilderPage />} />
        <Route path="campaigns/:id/stats" element={<CampaignStatsPage />} />
        <Route path="warmup" element={<WarmupPage />} />
        <Route path="bounces" element={<BouncesPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
