import { useEffect, useState, FormEvent, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Camera, X, AlertTriangle, CheckCircle2, Loader2, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
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
import { formatDate } from '@/lib/utils'
import type { Vehicle, Incident, IncidentCategory } from '@/types/database'

interface IncidentWithRelations extends Incident {
  vehicle: Pick<Vehicle, 'name' | 'plate'>
  driver: { full_name: string }
}

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  pinchazo: 'Pinchazo',
  rayon: 'Rayón',
  golpe: 'Golpe',
  rotura: 'Rotura',
  foco_quemado: 'Foco Quemado',
  mecanico: 'Falla Mecánica',
  otro: 'Otro',
}

const BUCKET = 'incident-photos'

const emptyForm = {
  vehicle_id: '',
  category: 'otro' as IncidentCategory,
  description: '',
}

export default function Incidencias() {
  const { profile } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [myActiveVehicleIds, setMyActiveVehicleIds] = useState<string[]>([])
  const [incidents, setIncidents] = useState<IncidentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: i }, { data: myActive }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).order('name'),
      supabase
        .from('incidents')
        .select('*, vehicle:vehicles(name, plate), driver:profiles!incidents_driver_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(50),
      profile
        ? supabase.from('key_logs').select('vehicle_id').eq('driver_id', profile.id).eq('status', 'EN_USO')
        : Promise.resolve({ data: [] as { vehicle_id: string }[] }),
    ])
    if (v) setVehicles(v as Vehicle[])
    if (i) setIncidents(i as unknown as IncidentWithRelations[])
    setMyActiveVehicleIds((myActive ?? []).map((r) => r.vehicle_id))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableVehicles = profile?.role === 'admin' ? vehicles : vehicles.filter((v) => myActiveVehicleIds.includes(v.id))

  function openNew() {
    if (profile?.role !== 'admin' && availableVehicles.length === 0) {
      toast.error('No tenés ninguna llave retirada', {
        description: 'Solo podés reportar incidencias del vehículo que tenés retirado en este momento.',
      })
      return
    }
    setForm({ vehicle_id: availableVehicles[0]?.id ?? '', category: 'otro', description: '' })
    setPhotoFile(null)
    setPhotoPreview(null)
    setModalOpen(true)
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('La imagen es muy pesada (máximo 8 MB).')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.vehicle_id || !form.description.trim()) {
      toast.error('Completá vehículo y descripción.')
      return
    }
    if (!profile) return

    setSaving(true)

    let photoPath: string | null = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg'
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, photoFile)
      if (uploadError) {
        setSaving(false)
        toast.error('No se pudo subir la foto', { description: uploadError.message })
        return
      }
      photoPath = path
    }

    const { error } = await supabase.from('incidents').insert({
      vehicle_id: form.vehicle_id,
      driver_id: profile.id,
      category: form.category,
      description: form.description.trim(),
      photo_url: photoPath,
    })

    setSaving(false)

    if (error) {
      toast.error('No se pudo registrar la incidencia', { description: error.message })
      return
    }

    toast.success('Incidencia registrada')
    setModalOpen(false)
    load()
  }

  async function marcarResuelta(incident: IncidentWithRelations) {
    const { error } = await supabase
      .from('incidents')
      .update({ status: 'resuelta', resolved_by: profile?.id, resolved_at: new Date().toISOString() })
      .eq('id', incident.id)

    if (error) {
      toast.error('No se pudo actualizar', { description: error.message })
      return
    }
    toast.success('Incidencia marcada como resuelta')
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Incidencias</h1>
          <p className="text-muted-foreground">Pinchazos, golpes, rayones, y cualquier novedad del vehículo</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Reportar Incidencia
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <p className="text-muted-foreground border rounded-lg p-6 text-center">No hay incidencias reportadas.</p>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              isAdmin={profile?.role === 'admin'}
              onResolve={() => marcarResuelta(incident)}
            />
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reportar Incidencia</DialogTitle>
            <DialogDescription>Reportado por {profile?.full_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Vehículo</Label>
              <select
                value={form.vehicle_id}
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                disabled={availableVehicles.length === 1 && profile?.role !== 'admin'}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
              >
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as IncidentCategory })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
                placeholder="Ej: Pinchazo en rueda trasera derecha, cambié por la de auxilio"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Foto (opcional)</Label>
              {photoPreview ? (
                <div className="relative w-full max-w-[200px]">
                  <img src={photoPreview} alt="Incidencia" className="rounded-md border w-full h-auto" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-6 w-6 flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border border-dashed rounded-md py-4 text-sm text-muted-foreground hover:bg-accent"
                >
                  <Camera className="h-4 w-4" /> Sacar foto
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
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

function IncidentRow({
  incident,
  isAdmin,
  onResolve,
}: {
  incident: IncidentWithRelations
  isAdmin: boolean
  onResolve: () => void
}) {
  const [loadingPhoto, setLoadingPhoto] = useState(false)

  async function verFoto() {
    if (!incident.photo_url) return
    setLoadingPhoto(true)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(incident.photo_url, 60)
    setLoadingPhoto(false)
    if (error || !data) {
      toast.error('No se pudo abrir la foto')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {incident.status === 'abierta' ? (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          )}
          <div>
            <p className="font-medium">
              {incident.vehicle.name} <span className="text-muted-foreground font-normal">({incident.vehicle.plate})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {incident.driver.full_name} · {formatDate(incident.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{CATEGORY_LABELS[incident.category]}</Badge>
          <Badge variant={incident.status === 'abierta' ? 'warning' : 'success'}>
            {incident.status === 'abierta' ? 'Abierta' : 'Resuelta'}
          </Badge>
        </div>
      </div>

      <p className="text-sm">{incident.description}</p>

      <div className="flex items-center gap-2 pt-1">
        {incident.photo_url && (
          <Button size="sm" variant="outline" onClick={verFoto} disabled={loadingPhoto} className="gap-1.5">
            {loadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            Ver foto
          </Button>
        )}
        {isAdmin && incident.status === 'abierta' && (
          <Button size="sm" variant="secondary" onClick={onResolve}>
            Marcar como resuelta
          </Button>
        )}
      </div>
    </div>
  )
}
