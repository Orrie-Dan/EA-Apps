import { RuntimeConfigProvider } from './config/RuntimeConfigProvider'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage, Layout, LegalPage, LoginPage, ModulePage, Workspace } from '@ea/ui'
import { AuthProvider } from './auth/AuthContext'
import AuthGate from './auth/AuthGate'
import { PortalAccessProvider } from './auth/PortalAccessProvider'
import AppShell from './shell.jsx'
import AppViewer from './pages/AppViewer'
import { APP_BASE_PATH } from './config/application.js'

export default function App() {
  return (
    <RuntimeConfigProvider>
      <AuthProvider>
        <PortalAccessProvider>
          <AppShell>
            <BrowserRouter basename={APP_BASE_PATH}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <AuthGate>
                      <Layout />
                    </AuthGate>
                  }
                >
                  <Route element={<Workspace />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/module/:moduleId" element={<ModulePage />} />
                    <Route path="/module/:moduleId/app/:solutionId" element={<AppViewer />} />
                  </Route>
                  <Route path="/legal/:page" element={<LegalPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AppShell>
        </PortalAccessProvider>
      </AuthProvider>
    </RuntimeConfigProvider>
  )
}
