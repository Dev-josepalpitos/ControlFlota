import { useEffect, useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
import { formatKm } from '@/lib/utils'
import type { Vehicle } from '@/types/database'

const emptyForm = {
  id: null as string | null,
  name: '',
  plate: '',
  current_km: '',
  next_service_km: '',
  vtv_expiry_date: '',
  insurance_company: '',
  insurance_policy_number: '',
  insurance_expiry_date: '',
  notes: '',
}

export default function AdminVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('vehicles').select('*').order('is_active', { ascending: false }).order('name')
    if (!error && data) setVehicles(data as Vehicle[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(v: Vehicle) {
    setForm({
      id: v.id,
      name: v.name,
      plate: v.plate,
      current_km: String(v.current_km),
      next_service_km: v.next_service_km ? String(v.next_service_km) : '',
      vtv_expiry_date: v.vtv_expiry_date ?? '',
      insurance_company: v.insurance_company ?? '',
      insurance_policy_number: v.insurance_policy_number ?? '',
      insurance_expiry_date: v.insurance_expiry_date ?? '',
      notes: v.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name || !form.plate || form.current_km === '') {
      toast.error('Completá al menos nombre, patente y kilometraje actual.')
      return
    }
    setSaving(true)

    const payload = {
      name: form.name,
      plate: form.plate.toUpperCase(),
      current_km: Number(form.current_km),
      next_service_km: form.next_service_km ? Number(form.next_service_km) : null,
      vtv_expiry_date: form.vtv_expiry_date || null,
      insurance_company: form.insurance_company || null,
      insurance_policy_number: form.insurance_policy_number || null,
      insurance_expiry_date: form.insurance_expiry_date || null,
      notes: form.notes || null,
    }

    const { error } = form.id
      ? await supabase.from('vehicles').update(payload).eq('id', form.id)
      : await supabase.from('vehicles').insert(payload)

    setSaving(false)

    if (error) {
      toast.error('No se pudo guardar', { description: error.message })
      return
    }

    toast.success(form.id ? 'Vehículo actualizado' : 'Vehículo creado')
    setModalOpen(false)
    load()
  }

  async function toggleActive(v: Vehicle) {
    const { error } = await supabase.from('vehicles').update({ is_active: !v.is_active }).eq('id', v.id)
    if (error) {
      toast.error('No se pudo actualizar', { description: error.message })
      return
    }
    toast.success(v.is_active ? 'Vehículo dado de baja' : 'Vehículo reactivado')
    load()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Vehículo
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div key={v.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4 ${!v.is_active ? 'opacity-50' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{v.name}</p>
                  <span className="text-sm text-muted-foreground">{v.plate}</span>
                  {!v.is_active && <Badge variant="outline">Dado de baja</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{formatKm(v.current_km)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(v)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(v)} className="gap-1.5">
                  {v.is_active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                  {v.is_active ? 'Dar de baja' : 'Reactivar'}
                </Button>
              </div>
            </div>
          ))}
          {vehicles.length === 0 && <p className="text-muted-foreground">No hay vehículos todavía.</p>}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Vehículo' : 'Nuevo Vehículo'}</DialogTitle>
            <DialogDescription>Datos generales, VTV y seguro.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fiat Fiorino 2018" />
              </div>
              <div className="space-y-1.5">
                <Label>Patente</Label>
                <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="ABC123" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Km actual</Label>
                <Input type="number" value={form.current_km} onChange={(e) => setForm({ ...form, current_km: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Próximo service (km)</Label>
                <Input type="number" value={form.next_service_km} onChange={(e) => setForm({ ...form, next_service_km: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimiento VTV</Label>
              <Input type="date" value={form.vtv_expiry_date} onChange={(e) => setForm({ ...form, vtv_expiry_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Aseguradora</Label>
                <Input value={form.insurance_company} onChange={(e) => setForm({ ...form, insurance_company: e.target.value })} placeholder="Ej: Sancor Seguros" />
              </div>
              <div className="space-y-1.5">
                <Label>N° de póliza</Label>
                <Input value={form.insurance_policy_number} onChange={(e) => setForm({ ...form, insurance_policy_number: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimiento del seguro</Label>
              <Input type="date" value={form.insurance_expiry_date} onChange={(e) => setForm({ ...form, insurance_expiry_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                {form.id ? 'Guardar Cambios' : 'Crear Vehículo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
