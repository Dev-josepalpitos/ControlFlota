import { useEffect, useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDateOnly, formatKm, formatMoney } from '@/lib/utils'
import type { Vehicle, MaintenanceRecord, MaintenanceType } from '@/types/database'
import AdminVehicleDocuments from './AdminVehicleDocuments'

const TIPO_LABEL: Record<MaintenanceType, string> = {
  service: 'Service',
  reparacion: 'Reparación',
  vtv: 'VTV',
  seguro: 'Seguro',
  otro: 'Otro',
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(fecha).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function EstadoVencimiento({ label, fecha }: { label: string; fecha: string | null }) {
  if (!fecha) return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">Sin datos</span>
    </div>
  )
  const dias = diasHasta(fecha)!
  const vencida = dias < 0
  const proxima = dias >= 0 && dias <= 30

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span>{formatDateOnly(fecha)}</span>
        {vencida && <Badge variant="destructive">Vencida</Badge>}
        {proxima && <Badge variant="warning">{dias}d</Badge>}
        {!vencida && !proxima && <Badge variant="success">OK</Badge>}
      </div>
    </div>
  )
}

const emptyForm = {
  type: 'service' as MaintenanceType,
  description: '',
  km_at_service: '',
  cost: '',
  performed_at: new Date().toISOString().slice(0, 10),
}

export default function AdminMaintenance() {
  const { currencyCode } = useSettings()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalVehicleId, setModalVehicleId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: r }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).order('name'),
      supabase.from('maintenance_records').select('*').order('performed_at', { ascending: false }),
    ])
    if (v) setVehicles(v as Vehicle[])
    if (r) setRecords(r as MaintenanceRecord[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openNewRecord(vehicleId: string) {
    setForm(emptyForm)
    setModalVehicleId(vehicleId)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!modalVehicleId || !form.description) {
      toast.error('Completá al menos la descripción del trabajo.')
      return
    }
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('maintenance_records').insert({
      vehicle_id: modalVehicleId,
      type: form.type,
      description: form.description,
      km_at_service: form.km_at_service ? Number(form.km_at_service) : null,
      cost: form.cost ? Number(form.cost) : null,
      performed_at: form.performed_at,
      created_by: user?.id,
    })

    setSaving(false)

    if (error) {
      toast.error('No se pudo guardar el registro', { description: error.message })
      return
    }

    toast.success('Trabajo registrado')
    setModalVehicleId(null)
    load()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {vehicles.map((v) => {
        const vehicleRecords = records.filter((r) => r.vehicle_id === v.id)
        const expanded = expandedId === v.id

        return (
          <div key={v.id} className="rounded-lg border overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{v.name}</p>
                  <span className="text-sm text-muted-foreground">{v.plate}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 max-w-md">
                  <EstadoVencimiento label="VTV" fecha={v.vtv_expiry_date} />
                  <EstadoVencimiento label="Seguro" fecha={v.insurance_expiry_date} />
                </div>
                {v.insurance_company && (
                  <p className="text-xs text-muted-foreground">
                    {v.insurance_company} {v.insurance_policy_number && `— Póliza ${v.insurance_policy_number}`}
                  </p>
                )}
                <AdminVehicleDocuments vehicleId={v.id} />
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                <Button size="sm" onClick={() => openNewRecord(v.id)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Registrar Trabajo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpandedId(expanded ? null : v.id)}
                  className="gap-1.5"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Historial ({vehicleRecords.length})
                </Button>
              </div>
            </div>

            {expanded && (
              <div className="border-t bg-muted/30 p-4 space-y-2">
                {vehicleRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Todavía no hay trabajos registrados.
                  </p>
                ) : (
                  vehicleRecords.map((r) => (
                    <div key={r.id} className="flex items-start justify-between text-sm bg-background rounded-md border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{TIPO_LABEL[r.type]}</Badge>
                          <span className="text-muted-foreground">{formatDateOnly(r.performed_at)}</span>
                        </div>
                        <p className="mt-1">{r.description}</p>
                        {r.km_at_service && <p className="text-xs text-muted-foreground">{formatKm(r.km_at_service)}</p>}
                      </div>
                      {r.cost != null && (
                        <span className="font-medium shrink-0">
                          {formatMoney(r.cost, currencyCode)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {vehicles.length === 0 && <p className="text-muted-foreground">No hay vehículos activos.</p>}

      <Dialog open={!!modalVehicleId} onOpenChange={(o) => !o && setModalVehicleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Trabajo</DialogTitle>
            <DialogDescription>Service, reparación, VTV o seguro realizado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MaintenanceType })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(TIPO_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Cambio de aceite y filtros"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Km al momento</Label>
                <Input type="number" value={form.km_at_service} onChange={(e) => setForm({ ...form, km_at_service: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Costo (opcional)</Label>
                <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={form.performed_at} onChange={(e) => setForm({ ...form, performed_at: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalVehicleId(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
