import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Filter, X, ImageIcon, Loader2, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { exportTableToPDF } from '@/lib/pdf'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatKm } from '@/lib/utils'
import type { KeyLogWithRelations, Vehicle, Profile, KeyLogStatus } from '@/types/database'

const PAGE_SIZE = 50
const ODOMETER_BUCKET = 'odometer-photos'

async function verFotoOdometro(path: string) {
  const { data, error } = await supabase.storage.from(ODOMETER_BUCKET).createSignedUrl(path, 60)
  if (error || !data) {
    toast.error('No se pudo abrir la foto')
    return
  }
  window.open(data.signedUrl, '_blank')
}

function FotoOdometroButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={async () => {
        setLoading(true)
        await verFotoOdometro(path)
        setLoading(false)
      }}
      disabled={loading}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md border hover:bg-accent"
      title="Ver foto del tablero"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
    </button>
  )
}

const emptyFilters = {
  from: '',
  to: '',
  vehicleId: '',
  driverId: '',
  status: '' as KeyLogStatus | '',
}

export default function History() {
  const { profile, loading: authLoading } = useAuth()
  const [logs, setLogs] = useState<KeyLogWithRelations[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [exportingPDF, setExportingPDF] = useState(false)

  useEffect(() => {
    async function loadFilterOptions() {
      const [{ data: v }, { data: d }] = await Promise.all([
        supabase.from('vehicles').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
      ])
      if (v) setVehicles(v as Vehicle[])
      if (d) setDrivers(d as Profile[])
    }
    loadFilterOptions()
  }, [])

  function buildFilteredQuery(range?: { from: number; to: number }) {
    let query = supabase
      .from('key_logs')
      .select(
        `*,
        vehicle:vehicles(name, plate),
        driver:profiles!key_logs_driver_id_fkey(full_name),
        requested_by:profiles!key_logs_requested_by_id_fkey(full_name),
        returned_by:profiles!key_logs_returned_by_id_fkey(full_name)`,
      )
      .order('out_at', { ascending: false })

    if (range) query = query.range(range.from, range.to)
    if (filters.from) query = query.gte('out_at', `${filters.from}T00:00:00`)
    if (filters.to) query = query.lte('out_at', `${filters.to}T23:59:59`)
    if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId)
    if (filters.driverId) query = query.eq('driver_id', filters.driverId)
    if (filters.status) query = query.eq('status', filters.status)

    return query
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await buildFilteredQuery({ from, to })

      if (!error && data) {
        setLogs(data as unknown as KeyLogWithRelations[])
        setHasMore(data.length === PAGE_SIZE)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters])

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setPage(0)
    setFilters((f) => ({ ...f, [key]: value }))
  }

  function clearFilters() {
    setPage(0)
    setFilters(emptyFilters)
  }

  async function handleExportPDF() {
    setExportingPDF(true)
    // Trae hasta 1000 registros que cumplan los filtros actuales (sin paginar),
    // para que el PDF incluya todo lo filtrado, no solo la página visible.
    const { data, error } = await buildFilteredQuery({ from: 0, to: 999 })
    setExportingPDF(false)

    if (error || !data) {
      toast.error('No se pudo generar el PDF')
      return
    }

    const rows = (data as unknown as KeyLogWithRelations[]).map((log) => [
      `${log.vehicle.name} (${log.vehicle.plate})`,
      log.driver.full_name,
      formatDate(log.out_at),
      formatDate(log.return_at),
      log.returned_by?.full_name ?? '—',
      log.status === 'EN_USO' ? 'En Uso' : 'Devuelta',
      formatKm(log.km_out),
      formatKm(log.km_returned),
    ])

    const subtitleParts: string[] = []
    if (filters.from) subtitleParts.push(`Desde ${filters.from}`)
    if (filters.to) subtitleParts.push(`Hasta ${filters.to}`)
    if (filters.vehicleId) subtitleParts.push(vehicles.find((v) => v.id === filters.vehicleId)?.name ?? '')
    if (filters.driverId) subtitleParts.push(drivers.find((d) => d.id === filters.driverId)?.full_name ?? '')
    if (filters.status) subtitleParts.push(filters.status === 'EN_USO' ? 'En Uso' : 'Devuelta')

    exportTableToPDF({
      title: 'Historial de Movimientos',
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'Sin filtros aplicados',
      columns: ['Vehículo', 'Chofer', 'Retiro', 'Devolución', 'Devolvió', 'Estado', 'Km Inicio', 'Km Final'],
      rows,
      fileName: `historial_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  if (authLoading) return null
  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="text-muted-foreground">Registro completo de movimientos de llaves</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} loading={exportingPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => setFiltersOpen((o) => !o)} className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="mb-6 rounded-lg border p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vehículo</Label>
              <select
                value={filters.vehicleId}
                onChange={(e) => updateFilter('vehicleId', e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Chofer</Label>
              <select
                value={filters.driverId}
                onChange={(e) => updateFilter('driverId', e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value as KeyLogStatus | '')}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="EN_USO">En Uso</option>
                <option value="DEVUELTA">Devuelta</option>
              </select>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 sm:h-12 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 border rounded-lg">
          {activeFilterCount > 0 ? 'No hay movimientos con estos filtros.' : 'No hay movimientos registrados todavía.'}
        </p>
      ) : (
        <>
          {/* Vista tarjetas: pantallas chicas (celulares) */}
          <div className="space-y-3 sm:hidden">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{log.vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">{log.vehicle.plate}</p>
                  </div>
                  <Badge variant={log.status === 'EN_USO' ? 'warning' : 'success'}>
                    {log.status === 'EN_USO' ? 'En Uso' : 'Devuelta'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Chofer: <span className="text-foreground">{log.driver.full_name}</span></p>
                  <p>Retiro: {formatDate(log.out_at)}</p>
                  <p>Devolución: {formatDate(log.return_at)}</p>
                  <p>Devolvió: <span className="text-foreground">{log.returned_by?.full_name ?? '—'}</span></p>
                  <p>Km inicio: {formatKm(log.km_out)}</p>
                  <p className="flex items-center gap-2">
                    Km final: {formatKm(log.km_returned)}
                    {log.km_photo_url && <FotoOdometroButton path={log.km_photo_url} />}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Vista tabla: tablets y desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Vehículo</th>
                  <th className="px-4 py-3 font-medium">Chofer</th>
                  <th className="px-4 py-3 font-medium">Solicitó</th>
                  <th className="px-4 py-3 font-medium">Retiro</th>
                  <th className="px-4 py-3 font-medium">Devolución</th>
                  <th className="px-4 py-3 font-medium">Devolvió</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Km Inicio</th>
                  <th className="px-4 py-3 font-medium text-right">Km Final</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {log.vehicle.name} <span className="text-muted-foreground">({log.vehicle.plate})</span>
                    </td>
                    <td className="px-4 py-3">{log.driver.full_name}</td>
                    <td className="px-4 py-3">{log.requested_by.full_name}</td>
                    <td className="px-4 py-3">{formatDate(log.out_at)}</td>
                    <td className="px-4 py-3">{formatDate(log.return_at)}</td>
                    <td className="px-4 py-3">{log.returned_by?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={log.status === 'EN_USO' ? 'warning' : 'success'}>
                        {log.status === 'EN_USO' ? 'En Uso' : 'Devuelta'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{formatKm(log.km_out)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-2">
                        {formatKm(log.km_returned)}
                        {log.km_photo_url && <FotoOdometroButton path={log.km_photo_url} />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(page > 0 || hasMore) && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <button
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
