import { supabase } from '@/lib/supabase'

export type PhotoSide = 'frente' | 'derecha' | 'izquierda' | 'atras'
export type PhotoStage = 'retiro' | 'devolucion'

export const PHOTO_SIDES: { id: PhotoSide; label: string }[] = [
  { id: 'frente', label: 'Frente' },
  { id: 'derecha', label: 'Lateral Derecho' },
  { id: 'izquierda', label: 'Lateral Izquierdo' },
  { id: 'atras', label: 'Atrás' },
]

const BUCKET = 'vehicle-condition-photos'

export async function uploadConditionPhotos(
  keyLogId: string,
  driverId: string,
  stage: PhotoStage,
  photos: Partial<Record<PhotoSide, File>>,
): Promise<{ error: string | null }> {
  for (const side of Object.keys(photos) as PhotoSide[]) {
    const file = photos[side]
    if (!file) continue

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${driverId}/${keyLogId}/${stage}-${side}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    if (uploadError) return { error: `No se pudo subir la foto "${side}": ${uploadError.message}` }

    const { error: insertError } = await supabase.from('vehicle_condition_photos').upsert(
      {
        key_log_id: keyLogId,
        stage,
        side,
        photo_url: path,
        uploaded_by: driverId,
      },
      { onConflict: 'key_log_id,stage,side' },
    )
    if (insertError) return { error: `No se pudo registrar la foto "${side}": ${insertError.message}` }
  }

  return { error: null }
}

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data) return null
  return data.signedUrl
}
