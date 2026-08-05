import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { exportTableToPDF } from '@/lib/pdf'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatKm, formatMoney } from '@/lib/utils'
import type { KeyLogWithRelations, FuelLog, Vehicle } from '@/types/database'

interface FuelLogWithRelations extends FuelLog {
  vehicle: Pick<Vehicle, 'name' | 'plate'>
  driver: { full_name: string }
}

type Preset = 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function rangoDesdePreset(preset: Preset): { from: string; to: string } {
  const hoy = new Date()
  const to = isoDate(hoy)

  if (preset === 'hoy') return { from: to, to }

  if (preset === 'semana') {
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - 6)
    return { from: isoDate(inicio), to }
  }

  if (preset === 'mes') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return { from: isoDate(inicio), to }
  }

  if (preset === 'mes_anterior') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    return { from: isoDate(inicio), to: isoDate(fin) }
  }

  return { from: to, to }
}

interface StatRow {
  key: string
  label: string
  sublabel: string
  viajes: number
  km: number
  horas: number
}

function toCSV(rows: StatRow[]): string {
  const header = 'Nombre,Detalle,Viajes,Km Recorridos,Horas de Uso\n'
  const body = rows
    .map((r) => `"${r.label}","${r.sublabel}",${r.viajes},${r.km},${r.horas.toFixed(1)}`)
    .join('\n')
  return header + body
}

interface FuelStatRow {
  key: string
  label: string
  sublabel: string
  cargas: number
  litros: number
  monto: number
}

function toCSVFuel(rows: FuelStatRow[]): string {
  const header = 'Nombre,Detalle,Cargas,Litros,Monto\n'
  const body = rows
    .map((r) => `"${r.label}","${r.sublabel}",${r.cargas},${r.litros.toFixed(1)},${r.monto.toFixed(2)}`)
    .join('\n')
  return header + body
}

function descargarCSV(csv: string, nombreArchivo: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivo
  link.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { profile, loading: authLoading } = useAuth()
  const [preset, setPreset] = useState<Preset>('mes')
  const [{ from, to }, setRango] = useState(() => rangoDesdePreset('mes'))
  const [logs, setLogs] = useState<KeyLogWithRelations[]>([])
  const [fuelLogs, setFuelLogs] = useState<FuelLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (preset !== 'personalizado') {
      setRango(rangoDesdePreset(preset))
    }
  }, [preset])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('key_logs')
        .select(
          `*,
          vehicle:vehicles(name, plate),
          driver:profiles!key_logs_driver_id_fkey(full_name),
          requested_by:profiles!key_logs_requested_by_id_fkey(full_name),
          returned_by:profiles!key_logs_returned_by_id_fkey(full_name)`,
        )
        .eq('status', 'DEVUELTA')
        .gte('out_at', `${from}T00:00:00`)
        .lte('out_at', `${to}T23:59:59`)
        .order('out_at', { ascending: false })

      if (!error && data) setLogs(data as unknown as KeyLogWithRelations[])

      const { data: fuelData, error: fuelError } = await supabase
        .from('fuel_logs')
        .select('*, vehicle:vehicles(name, plate), driver:profiles!fuel_logs_driver_id_fkey(full_name)')
        .gte('loaded_at', `${from}T00:00:00`)
        .lte('loaded_at', `${to}T23:59:59`)
        .order('loaded_at', { ascending: false })

      if (!fuelError && fuelData) setFuelLogs(fuelData as unknown as FuelLogWithRelations[])

      setLoading(false)
    }
    load()
  }, [from, to])

  const { porVehiculo, porChofer } = useMemo(() => {
    const vehMap = new Map<string, StatRow>()
    const drvMap = new Map<string, StatRow>()

    for (const log of logs) {
      const km = log.km_returned != null && log.km_out != null ? log.km_returned - log.km_out : 0
      const horas =
        log.return_at && log.out_at
          ? (new Date(log.return_at).getTime() - new Date(log.out_at).getTime()) / (1000 * 60 * 60)
          : 0

      const vKey = log.vehicle_id
      const vPrev = vehMap.get(vKey) ?? {
        key: vKey,
        label: log.vehicle.name,
        sublabel: log.vehicle.plate,
        viajes: 0,
        km: 0,
        horas: 0,
      }
      vPrev.viajes += 1
      vPrev.km += km
      vPrev.horas += horas
      vehMap.set(vKey, vPrev)

      const dKey = log.driver_id
      const dPrev = drvMap.get(dKey) ?? {
        key: dKey,
        label: log.driver.full_name,
        sublabel: '',
        viajes: 0,
        km: 0,
        horas: 0,
      }
      dPrev.viajes += 1
      dPrev.km += km
      dPrev.horas += horas
      drvMap.set(dKey, dPrev)
    }

    return {
      porVehiculo: Array.from(vehMap.values()).sort((a, b) => b.km - a.km),
      porChofer: Array.from(drvMap.values()).sort((a, b) => b.km - a.km),
    }
  }, [logs])

  const { fuelPorVehiculo, fuelPorChofer } = useMemo(() => {
    const vehMap = new Map<string, FuelStatRow>()
    const drvMap = new Map<string, FuelStatRow>()

    for (const f of fuelLogs) {
      const vKey = f.vehicle_id
      const vPrev = vehMap.get(vKey) ?? {
        key: vKey,
        label: f.vehicle.name,
        sublabel: f.vehicle.plate,
        cargas: 0,
        litros: 0,
        monto: 0,
      }
      vPrev.cargas += 1
      vPrev.litros += f.liters
      vPrev.monto += f.cost
      vehMap.set(vKey, vPrev)

      const dKey = f.driver_id
      const dPrev = drvMap.get(dKey) ?? {
        key: dKey,
        label: f.driver.full_name,
        sublabel: '',
        cargas: 0,
        litros: 0,
        monto: 0,
      }
      dPrev.cargas += 1
      dPrev.litros += f.liters
      dPrev.monto += f.cost
      drvMap.set(dKey, dPrev)
    }

    return {
      fuelPorVehiculo: Array.from(vehMap.values()).sort((a, b) => b.monto - a.monto),
      fuelPorChofer: Array.from(drvMap.values()).sort((a, b) => b.monto - a.monto),
    }
  }, [fuelLogs])

  const presets: { id: Preset; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: 'Últimos 7 días' },
    { id: 'mes', label: 'Este mes' },
    { id: 'mes_anterior', label: 'Mes anterior' },
    { id: 'personalizado', label: 'Rango personalizado' },
  ]

  if (authLoading) return null
  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">Estadísticas por vehículo y por chofer</p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                preset === p.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input hover:bg-accent',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'personalizado' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Input type="date" value={from} onChange={(e) => setRango((r) => ({ ...r, from: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setRango((r) => ({ ...r, to: e.target.value }))} />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Mostrando viajes devueltos entre {from} y {to} ({logs.length} en total)
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <StatsTable
            title="Por Vehículo"
            rows={porVehiculo}
            onExport={() => descargarCSV(toCSV(porVehiculo), `reporte-vehiculos_${from}_${to}.csv`)}
            onExportPDF={() =>
              exportTableToPDF({
                title: 'Reporte por Vehículo',
                subtitle: `Del ${from} al ${to}`,
                columns: ['Vehículo', 'Patente', 'Viajes', 'Km Recorridos', 'Horas de Uso'],
                rows: porVehiculo.map((r) => [r.label, r.sublabel, r.viajes, formatKm(r.km), r.horas.toFixed(1)]),
                fileName: `reporte-vehiculos_${from}_${to}.pdf`,
              })
            }
          />
          <StatsTable
            title="Por Chofer"
            rows={porChofer}
            onExport={() => descargarCSV(toCSV(porChofer), `reporte-choferes_${from}_${to}.csv`)}
            onExportPDF={() =>
              exportTableToPDF({
                title: 'Reporte por Chofer',
                subtitle: `Del ${from} al ${to}`,
                columns: ['Chofer', 'Viajes', 'Km Recorridos', 'Horas de Uso'],
                rows: porChofer.map((r) => [r.label, r.viajes, formatKm(r.km), r.horas.toFixed(1)]),
                fileName: `reporte-choferes_${from}_${to}.pdf`,
              })
            }
          />
          <FuelStatsTable
            title="Combustible por Vehículo"
            rows={fuelPorVehiculo}
            onExport={() => descargarCSV(toCSVFuel(fuelPorVehiculo), `combustible-vehiculos_${from}_${to}.csv`)}
            onExportPDF={() =>
              exportTableToPDF({
                title: 'Combustible por Vehículo',
                subtitle: `Del ${from} al ${to}`,
                columns: ['Vehículo', 'Patente', 'Cargas', 'Litros', 'Monto'],
                rows: fuelPorVehiculo.map((r) => [r.label, r.sublabel, r.cargas, r.litros.toFixed(1), r.monto.toFixed(2)]),
                fileName: `combustible-vehiculos_${from}_${to}.pdf`,
              })
            }
          />
          <FuelStatsTable
            title="Combustible por Chofer"
            rows={fuelPorChofer}
            onExport={() => descargarCSV(toCSVFuel(fuelPorChofer), `combustible-choferes_${from}_${to}.csv`)}
            onExportPDF={() =>
              exportTableToPDF({
                title: 'Combustible por Chofer',
                subtitle: `Del ${from} al ${to}`,
                columns: ['Chofer', 'Cargas', 'Litros', 'Monto'],
                rows: fuelPorChofer.map((r) => [r.label, r.cargas, r.litros.toFixed(1), r.monto.toFixed(2)]),
                fileName: `combustible-choferes_${from}_${to}.pdf`,
              })
            }
          />
        </div>
      )}
    </div>
  )
}

function StatsTable({
  title,
  rows,
  onExport,
  onExportPDF,
}: {
  title: string
  rows: StatRow[]
  onExport: () => void
  onExportPDF: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onExportPDF} disabled={rows.length === 0} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={onExport} disabled={rows.length === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">Sin datos en este rango.</p>
      ) : (
        <>
          {/* Mobile: tarjetas */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.key} className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">
                  {r.label} {r.sublabel && <span className="text-muted-foreground">({r.sublabel})</span>}
                </p>
                <p className="text-muted-foreground">
                  {r.viajes} viajes · {formatKm(r.km)} · {r.horas.toFixed(1)} hs de uso
                </p>
              </div>
            ))}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium text-right">Viajes</th>
                  <th className="px-4 py-3 font-medium text-right">Km Recorridos</th>
                  <th className="px-4 py-3 font-medium text-right">Horas de Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {r.label} {r.sublabel && <span className="text-muted-foreground">({r.sublabel})</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.viajes}</td>
                    <td className="px-4 py-3 text-right">{formatKm(r.km)}</td>
                    <td className="px-4 py-3 text-right">{r.horas.toFixed(1)} hs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function FuelStatsTable({
  title,
  rows,
  onExport,
  onExportPDF,
}: {
  title: string
  rows: FuelStatRow[]
  onExport: () => void
  onExportPDF: () => void
}) {
  const { currencyCode } = useSettings()
  const fmtMoney = (n: number) => formatMoney(n, currencyCode)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onExportPDF} disabled={rows.length === 0} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={onExport} disabled={rows.length === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">Sin cargas en este rango.</p>
      ) : (
        <>
          {/* Mobile: tarjetas */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.key} className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">
                  {r.label} {r.sublabel && <span className="text-muted-foreground">({r.sublabel})</span>}
                </p>
                <p className="text-muted-foreground">
                  {r.cargas} cargas · {r.litros.toFixed(1)} L · {fmtMoney(r.monto)}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium text-right">Cargas</th>
                  <th className="px-4 py-3 font-medium text-right">Litros</th>
                  <th className="px-4 py-3 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {r.label} {r.sublabel && <span className="text-muted-foreground">({r.sublabel})</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.cargas}</td>
                    <td className="px-4 py-3 text-right">{r.litros.toFixed(1)} L</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(r.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
