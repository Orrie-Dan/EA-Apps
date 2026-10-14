import { RuntimeConfigProvider } from './config/RuntimeConfigProvider'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import AuthGate from './auth/AuthGate'
import { PortalAccessProvider } from './auth/PortalAccessProvider'
import Layout from './components/Layout'
import Workspace from './components/Workspace'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import ModulePage from './pages/ModulePage'
import AppViewer from './pages/AppViewer'
import LegalPage from './pages/LegalPage'
import { APP_BASE_PATH } from './config/application.js'

export default function App() {
  return (
    <RuntimeConfigProvider>
      <AuthProvider>
        <PortalAccessProvider>
          <BrowserRouter basename={APP_BASE_PATH}>
            <Routes>
              <Route path="/login" element={<LandingPage />} />
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
                  <Route
                    path="/module/:moduleId/app/:solutionId"
                    element={<AppViewer />}
                  />
                </Route>
                <Route path="/legal/:page" element={<LegalPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PortalAccessProvider>
      </AuthProvider>
    </RuntimeConfigProvider>
  )
}
