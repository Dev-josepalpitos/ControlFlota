import { useState, useRef, useEffect, FormEvent } from 'react'
import { toast } from 'sonner'
import { Camera, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Vehicle, KeyLog } from '@/types/database'
import { uploadConditionPhotos, type PhotoSide } from '@/lib/vehicleConditionPhotos'
import VehicleConditionPhotoGrid from './VehicleConditionPhotoGrid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  vehicle: Vehicle
  activeLog: KeyLog
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ODOMETER_BUCKET = 'odometer-photos'

export default function DevolucionModal({ vehicle, activeLog, open, onOpenChange }: Props) {
  const { profile } = useAuth()
  const [km, setKm] = useState('')
  const [error, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [conditionPhotos, setConditionPhotos] = useState<Partial<Record<PhotoSide, File>>>({})
  const [conditionPreviews, setConditionPreviews] = useState<Partial<Record<PhotoSide, string>>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setKm('')
      setErrorMsg(null)
      setPhotoFile(null)
      setPhotoPreview(null)
      setConditionPhotos({})
      setConditionPreviews({})
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

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

  function handleConditionPhotoChange(side: PhotoSide, file: File | null) {
    setConditionPhotos((p) => ({ ...p, [side]: file ?? undefined }))
    setConditionPreviews((p) => ({ ...p, [side]: file ? URL.createObjectURL(file) : undefined }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const kmValue = Number(km)

    if (!km || Number.isNaN(kmValue) || kmValue < 0) {
      setErrorMsg('Ingresá un kilometraje válido (número positivo).')
      return
    }
    if (kmValue < vehicle.current_km) {
      setErrorMsg(`El km no puede ser menor al actual (${vehicle.current_km.toLocaleString('es-AR')} km).`)
      return
    }

    setErrorMsg(null)
    setLoading(true)

    let photoPath: string | null = null
    if (photoFile && profile) {
      const ext = photoFile.name.split('.').pop() || 'jpg'
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(ODOMETER_BUCKET).upload(path, photoFile)

      if (uploadError) {
        setLoading(false)
        toast.error('No se pudo subir la foto del tablero', { description: uploadError.message })
        return
      }
      photoPath = path
    }

    const { error } = await supabase
      .from('key_logs')
      .update({
        return_at: new Date().toISOString(),
        returned_by_id: profile?.id,
        status: 'DEVUELTA',
        km_returned: kmValue,
        km_photo_url: photoPath,
      })
      .eq('id', activeLog.id)

    if (error) {
      setLoading(false)
      toast.error('No se pudo registrar la devolución', { description: error.message })
      return
    }

    const hasConditionPhotos = Object.values(conditionPhotos).some(Boolean)
    if (hasConditionPhotos && profile) {
      const { error: photoError } = await uploadConditionPhotos(activeLog.id, profile.id, 'devolucion', conditionPhotos)
      if (photoError) {
        toast.error('La devolución se registró, pero hubo un problema con las fotos', { description: photoError })
      }
    }

    setLoading(false)
    toast.success('Llave devuelta', { description: `Kilometraje registrado: ${kmValue.toLocaleString('es-AR')} km` })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolver Llave</DialogTitle>
          <DialogDescription>Registrá el kilometraje actual para cerrar el recorrido.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehículo</Label>
            <Input value={`${vehicle.name} — ${vehicle.plate}`} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="km">Kilometraje Actual</Label>
            <Input
              ref={inputRef}
              id="km"
              type="number"
              min={vehicle.current_km}
              placeholder={`Ej: ${vehicle.current_km + 50}`}
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label>Foto del tablero (opcional)</Label>
            {photoPreview ? (
              <div className="relative w-full max-w-[200px]">
                <img src={photoPreview} alt="Tablero" className="rounded-md border w-full h-auto" />
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
                <Camera className="h-4 w-4" /> Sacar foto del odómetro
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

          <div className="space-y-2">
            <Label>Estado del vehículo (opcional)</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Sacá fotos de las 4 caras para dejar registro de cómo devolvés la unidad.
            </p>
            <VehicleConditionPhotoGrid
              photos={conditionPhotos}
              previews={conditionPreviews}
              onChange={handleConditionPhotoChange}
            />
          </div>

          <div className="space-y-2">
            <Label>Devuelto por</Label>
            <Input value={profile?.full_name ?? ''} disabled />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Confirmar Devolución
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
