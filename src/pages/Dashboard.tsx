import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/skeleton'
import VehicleCard from '@/components/dashboard/VehicleCard'
import type { Vehicle, KeyLog, VehicleWithActiveLog } from '@/types/database'

type ActiveKeyLog = KeyLog & { driver: { full_name: string } }

export default function Dashboard() {
  const { profile } = useAuth()
  const [vehicles, setVehicles] = useState<VehicleWithActiveLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadVehicles = useCallback(async () => {
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (vehiclesError || !vehiclesData) {
      setLoading(false)
      return
    }

    const { data: activeLogs } = await supabase
      .from('key_logs')
      .select('*, driver:profiles!key_logs_driver_id_fkey(full_name)')
      .eq('status', 'EN_USO')

    const vehiclesList = vehiclesData as Vehicle[]
    const logsList = (activeLogs ?? []) as ActiveKeyLog[]

    const merged: VehicleWithActiveLog[] = vehiclesList.map((v) => ({
      ...v,
      active_log: logsList.find((log) => log.vehicle_id === v.id) ?? null,
    }))

    setVehicles(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadVehicles()

    const channel = supabase
      .channel('key_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'key_logs' }, () => {
        loadVehicles()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        loadVehicles()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadVehicles])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Estado de la flota en tiempo real</p>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <p className="text-muted-foreground">No hay vehículos cargados todavía.</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle, i) => {
            const yaTieneLlave = vehicles.some(
              (v) => v.active_log && v.active_log.driver_id === profile?.id && v.id !== vehicle.id,
            )
            return (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                index={i}
                disableRetiro={yaTieneLlave}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
