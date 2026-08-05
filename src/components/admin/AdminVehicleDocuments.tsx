import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, FileCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { DocType, VehicleDocument } from '@/types/database'

const DOC_LABELS: Record<DocType, string> = {
  vtv: 'VTV',
  seguro: 'Seguro',
  tarjeta_verde: 'Tarjeta Verde',
  otro: 'Otro',
}

const DOC_TYPES: DocType[] = ['vtv', 'seguro', 'tarjeta_verde']
const BUCKET = 'vehicle-documents'

export default function AdminVehicleDocuments({ vehicleId }: { vehicleId: string }) {
  const [documents, setDocuments] = useState<VehicleDocument[]>([])
  const [uploadingType, setUploadingType] = useState<DocType | null>(null)

  async function load() {
    const { data } = await supabase.from('vehicle_documents').select('*').eq('vehicle_id', vehicleId)
    if (data) setDocuments(data as VehicleDocument[])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId])

  async function handleUpload(docType: DocType, file: File) {
    setUploadingType(docType)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const ext = file.name.split('.').pop() || 'pdf'
    const path = `${vehicleId}/${docType}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    if (uploadError) {
      setUploadingType(null)
      toast.error('No se pudo subir el archivo', { description: uploadError.message })
      return
    }

    const { error: upsertError } = await supabase.from('vehicle_documents').upsert(
      {
        vehicle_id: vehicleId,
        doc_type: docType,
        file_url: path,
        file_name: file.name,
        uploaded_by: user?.id,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'vehicle_id,doc_type' },
    )

    setUploadingType(null)

    if (upsertError) {
      toast.error('No se pudo registrar el documento', { description: upsertError.message })
      return
    }

    toast.success(`${DOC_LABELS[docType]} actualizado`)
    load()
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t">
      {DOC_TYPES.map((docType) => {
        const doc = documents.find((d) => d.doc_type === docType)
        return (
          <DocUploadButton
            key={docType}
            label={DOC_LABELS[docType]}
            hasDoc={!!doc}
            loading={uploadingType === docType}
            onSelect={(file) => handleUpload(docType, file)}
          />
        )
      })}
    </div>
  )
}

function DocUploadButton({
  label,
  hasDoc,
  loading,
  onSelect,
}: {
  label: string
  hasDoc: boolean
  loading: boolean
  onSelect: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <Button
        size="sm"
        variant={hasDoc ? 'outline' : 'secondary'}
        loading={loading}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        {!loading && (hasDoc ? <FileCheck className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />)}
        {hasDoc ? `Reemplazar ${label}` : `Subir ${label}`}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onSelect(file)
          e.target.value = ''
        }}
      />
    </>
  )
}
