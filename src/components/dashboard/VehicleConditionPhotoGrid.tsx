import { useRef } from 'react'
import { Camera, X } from 'lucide-react'
import { PHOTO_SIDES, type PhotoSide } from '@/lib/vehicleConditionPhotos'

interface Props {
  photos: Partial<Record<PhotoSide, File>>
  previews: Partial<Record<PhotoSide, string>>
  onChange: (side: PhotoSide, file: File | null) => void
}

export default function VehicleConditionPhotoGrid({ photos, previews, onChange }: Props) {
  void photos // reservado para uso futuro (ej. mostrar contador de fotos cargadas)

  return (
    <div className="grid grid-cols-2 gap-3">
      {PHOTO_SIDES.map((side) => (
        <PhotoSlot
          key={side.id}
          label={side.label}
          preview={previews[side.id]}
          onSelect={(file) => onChange(side.id, file)}
        />
      ))}
    </div>
  )
}

function PhotoSlot({
  label,
  preview,
  onSelect,
}: {
  label: string
  preview: string | undefined
  onSelect: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) return
    onSelect(file)
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="rounded-md border w-full aspect-square object-cover" />
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-square flex flex-col items-center justify-center gap-1 border border-dashed rounded-md text-muted-foreground hover:bg-accent"
        >
          <Camera className="h-5 w-5" />
          <span className="text-[10px]">Sacar foto</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  )
}
