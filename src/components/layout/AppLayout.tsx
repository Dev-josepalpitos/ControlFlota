import { Navigate, Outlet } from 'react-router-dom'
import { Car } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import Navbar from './Navbar'

export default function AppLayout() {
  const { session, loading } = useAuth()
  const { systemName } = useSettings()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-background relative">
      {/* Marca de agua: fija, detrás de todo el contenido, no interactuable */}
      <div className="fixed inset-0 z-0 flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden">
        <Car className="h-[45vw] w-[45vw] max-h-[420px] max-w-[420px] text-foreground/[0.04]" strokeWidth={1} />
        <span className="mt-2 text-[8vw] sm:text-5xl font-bold text-foreground/[0.04] text-center px-6 break-words">
          {systemName}
        </span>
      </div>

      <div className="relative z-10">
        <Navbar />
        <main className="container px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
