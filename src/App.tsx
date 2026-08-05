import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import { SettingsProvider } from '@/hooks/useSettings'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import History from '@/pages/History'
import Admin from '@/pages/Admin'
import Reports from '@/pages/Reports'
import Fuel from '@/pages/Fuel'
import Documentacion from '@/pages/Documentacion'
import Incidencias from '@/pages/Incidencias'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/historial" element={<History />} />
              <Route path="/combustible" element={<Fuel />} />
              <Route path="/documentacion" element={<Documentacion />} />
              <Route path="/incidencias" element={<Incidencias />} />
              <Route path="/reportes" element={<Reports />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
