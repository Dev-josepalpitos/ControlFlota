import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Vehicle } from '@/types/database'
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
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RetiroModal({ vehicle, open, onOpenChange }: Props) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<Partial<Record<PhotoSide, File>>>({})
  const [previews, setPreviews] = useState<Partial<Record<PhotoSide, string>>>({})

  useEffect(() => {
    if (open) {
      setPhotos({})
      setPreviews({})
    }
  }, [open])

  function handlePhotoChange(side: PhotoSide, file: File | null) {
    setPhotos((p) => ({ ...p, [side]: file ?? undefined }))
    setPreviews((p) => ({ ...p, [side]: file ? URL.createObjectURL(file) : undefined }))
  }

  async function handleConfirm() {
    if (!profile) return
    setLoading(true)

    const { data, error } = await supabase
      .from('key_logs')
      .insert({
        vehicle_id: vehicle.id,
        driver_id: profile.id,
        requested_by_id: profile.id,
        status: 'EN_USO',
      })
      .select()
      .single()

    if (error) {
      setLoading(false)
      if (error.code === '23505' && error.message.includes('one_active_key_per_vehicle')) {
        toast.error('Este vehículo ya fue retirado por otra persona', {
          description: 'La lista se actualizará automáticamente.',
        })
      } else if (error.code === '23505' && error.message.includes('one_active_key_per_driver')) {
        toast.error('Ya tenés una llave en uso', {
          description: 'Debés devolver la llave que tenés antes de retirar otra unidad.',
        })
      } else {
        toast.error('No se pudo registrar el retiro', { description: error.message })
      }
      return
    }

    const hasPhotos = Object.values(photos).some(Boolean)
    if (hasPhotos && data) {
      const { error: photoError } = await uploadConditionPhotos(data.id, profile.id, 'retiro', photos)
      if (photoError) {
        toast.error('El retiro se registró, pero hubo un problema con las fotos', { description: photoError })
      }
    }

    setLoading(false)
    toast.success(`Unidad ${vehicle.name} retirada`, { description: 'Buen viaje 🚗' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retirar Unidad</DialogTitle>
          <DialogDescription>Confirmá el retiro de la llave para comenzar tu recorrido.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vehículo</Label>
            <Input value={`${vehicle.name} — ${vehicle.plate}`} disabled />
          </div>
          <div className="space-y-2">
            <Label>Chofer</Label>
            <Input value={profile?.full_name ?? ''} disabled />
          </div>
          <p className="text-xs text-muted-foreground">
            El chofer se asigna según tu usuario logueado.
          </p>

          <div className="space-y-2">
            <Label>Estado del vehículo (opcional)</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Sacá fotos de las 4 caras para dejar registro de cómo sale.
            </p>
            <VehicleConditionPhotoGrid photos={photos} previews={previews} onChange={handlePhotoChange} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={loading}>
            Confirmar Retiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
