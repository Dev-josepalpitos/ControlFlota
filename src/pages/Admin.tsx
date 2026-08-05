import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AdminVehicles from '@/components/admin/AdminVehicles'
import AdminUsers from '@/components/admin/AdminUsers'
import AdminMaintenance from '@/components/admin/AdminMaintenance'
import AdminSettings from '@/components/admin/AdminSettings'
import AdminFuelStations from '@/components/admin/AdminFuelStations'
import { cn } from '@/lib/utils'

type Tab = 'vehiculos' | 'usuarios' | 'mantenimiento' | 'estaciones' | 'configuracion'

export default function Admin() {
  const { profile, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('vehiculos')

  if (loading) return null
  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />

  const tabs: { id: Tab; label: string }[] = [
    { id: 'vehiculos', label: 'Vehículos' },
    { id: 'mantenimiento', label: 'VTV, Seguro y Trabajos' },
    { id: 'estaciones', label: 'Estaciones de Servicio' },
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'configuracion', label: 'Configuración' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-muted-foreground">Gestión de vehículos, usuarios y mantenimiento</p>
      </div>

      <div className="mb-6 flex gap-1 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vehiculos' && <AdminVehicles />}
      {tab === 'mantenimiento' && <AdminMaintenance />}
      {tab === 'estaciones' && <AdminFuelStations />}
      {tab === 'usuarios' && <AdminUsers />}
      {tab === 'configuracion' && <AdminSettings />}
    </div>
  )
}
