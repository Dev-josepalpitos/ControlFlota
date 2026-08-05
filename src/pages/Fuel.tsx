import { useEffect, useState, FormEvent, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Fuel as FuelIcon, Camera, ImageIcon, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDate, formatMoney } from '@/lib/utils'
import type { Vehicle, FuelLog, FuelStation } from '@/types/database'

interface FuelLogWithRelations extends FuelLog {
  vehicle: Pick<Vehicle, 'name' | 'plate'>
  driver: { full_name: string }
  fuel_station: Pick<FuelStation, 'name'> | null
}

const emptyForm = {
  vehicle_id: '',
  cost: '',
  station_id: '',
}

const RECEIPTS_BUCKET = 'fuel-receipts'

export default function Fuel() {
  const { profile } = useAuth()
  const { fuelPricePerLiter, currencyCode } = useSettings()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [myActiveVehicleIds, setMyActiveVehicleIds] = useState<string[]>([])
  const [stations, setStations] = useState<FuelStation[]>([])
  const [logs, setLogs] = useState<FuelLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: s }, { data: f }, { data: myActive }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).order('name'),
      supabase.from('fuel_stations').select('*').eq('is_active', true).order('name'),
      supabase
        .from('fuel_logs')
        .select(
          '*, vehicle:vehicles(name, plate), driver:profiles!fuel_logs_driver_id_fkey(full_name), fuel_station:fuel_stations(name)',
        )
        .order('loaded_at', { ascending: false })
        .limit(50),
      profile
        ? supabase.from('key_logs').select('vehicle_id').eq('driver_id', profile.id).eq('status', 'EN_USO')
        : Promise.resolve({ data: [] as { vehicle_id: string }[] }),
    ])
    if (v) setVehicles(v as Vehicle[])
    if (s) setStations(s as FuelStation[])
    if (f) setLogs(f as unknown as FuelLogWithRelations[])
    setMyActiveVehicleIds((myActive ?? []).map((r) => r.vehicle_id))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const availableVehicles =
    profile?.role === 'admin' ? vehicles : vehicles.filter((v) => myActiveVehicleIds.includes(v.id))

  function openNew() {
    if (profile?.role !== 'admin' && availableVehicles.length === 0) {
      toast.error('No tenés ninguna llave retirada', {
        description: 'Primero retirá una unidad desde el Dashboard para poder cargarle combustible.',
      })
      return
    }
    setForm({ vehicle_id: availableVehicles[0]?.id ?? '', cost: '', station_id: stations[0]?.id ?? '' })
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

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const montoReal = form.cost && Number(form.cost) > 0 ? Number(form.cost) * 1000 : null
  const litrosCalculados = fuelPricePerLiter && montoReal ? montoReal / fuelPricePerLiter : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.vehicle_id || !form.cost) {
      toast.error('Completá vehículo y monto.')
      return
    }
    if (!fuelPricePerLiter) {
      toast.error('No hay un precio de combustible configurado', {
        description: 'Pedile a un administrador que lo cargue en Admin → Configuración.',
      })
      return
    }
    if (!profile) return

    setSaving(true)

    let receiptPath: string | null = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg'
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, photoFile)

      if (uploadError) {
        setSaving(false)
        toast.error('No se pudo subir la foto del comprobante', { description: uploadError.message })
        return
      }
      receiptPath = path
    }

    const { error } = await supabase.from('fuel_logs').insert({
      vehicle_id: form.vehicle_id,
      driver_id: profile.id,
      liters: montoReal! / fuelPricePerLiter,
      cost: montoReal!,
      station_id: form.station_id || null,
      receipt_photo_url: receiptPath,
    })
    setSaving(false)

    if (error) {
      toast.error('No se pudo registrar la carga', { description: error.message })
      return
    }

    toast.success('Carga de combustible registrada')
    setModalOpen(false)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Combustible</h1>
          <p className="text-muted-foreground">
            Registro de cargas por vehículo
            {fuelPricePerLiter && <span className="block text-xs mt-0.5">Precio actual: ${fuelPricePerLiter} / litro</span>}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar Carga
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground border rounded-lg p-6 text-center flex items-center justify-center gap-2">
          <FuelIcon className="h-4 w-4" /> Todavía no hay cargas registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <FuelLogRow key={log.id} log={log} currencyCode={currencyCode} />
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Carga de Combustible</DialogTitle>
            <DialogDescription>Cargado por {profile?.full_name}</DialogDescription>
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
              {profile?.role !== 'admin' && availableVehicles.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Tenés más de una llave retirada, elegí a cuál corresponde esta carga.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Monto pagado (en miles)</Label>
              <Input type="number" step="1" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Ej: 50" />
              <p className="text-xs text-muted-foreground">
                {montoReal
                  ? `= ${formatMoney(montoReal, currencyCode)}`
                  : 'Ingresá el monto en miles: poné 50 para $50.000'}
                {fuelPricePerLiter && litrosCalculados !== null && ` · ≈ ${litrosCalculados.toFixed(2)} litros`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Estación</Label>
              <select
                value={form.station_id}
                onChange={(e) => setForm({ ...form, station_id: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin especificar</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Foto del comprobante (opcional)</Label>
              {photoPreview ? (
                <div className="relative w-full max-w-[200px]">
                  <img src={photoPreview} alt="Comprobante" className="rounded-md border w-full h-auto" />
                  <button
                    type="button"
                    onClick={removePhoto}
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
                  <Camera className="h-4 w-4" /> Sacar foto o elegir imagen
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

function FuelLogRow({ log, currencyCode }: { log: FuelLogWithRelations; currencyCode: string }) {
  const [loadingPhoto, setLoadingPhoto] = useState(false)

  async function verComprobante() {
    if (!log.receipt_photo_url) return
    setLoadingPhoto(true)
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(log.receipt_photo_url, 60)
    setLoadingPhoto(false)

    if (error || !data) {
      toast.error('No se pudo abrir la foto del comprobante')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        {log.receipt_photo_url && (
          <button
            onClick={verComprobante}
            disabled={loadingPhoto}
            className="shrink-0 h-10 w-10 rounded-md border flex items-center justify-center hover:bg-accent"
            title="Ver comprobante"
          >
            {loadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </button>
        )}
        <div>
          <p className="font-medium">
            {log.vehicle.name} <span className="text-muted-foreground font-normal">({log.vehicle.plate})</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {log.driver.full_name} · {formatDate(log.loaded_at)}
            {log.fuel_station && ` · ${log.fuel_station.name}`}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-medium">
          {formatMoney(log.cost, currencyCode)}
        </p>
        <p className="text-sm text-muted-foreground">{log.liters.toFixed(1)} L</p>
      </div>
    </div>
  )
}
