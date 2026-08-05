import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Vehicle, VehicleDocument, DocType } from '@/types/database'

const DOC_LABELS: Record<DocType, string> = {
  vtv: 'VTV',
  seguro: 'Seguro',
  tarjeta_verde: 'Tarjeta Verde',
  otro: 'Otro documento',
}

const REQUIRED_DOCS: DocType[] = ['vtv', 'seguro', 'tarjeta_verde']

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(fecha).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export default function Documentacion() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [documents, setDocuments] = useState<VehicleDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: d }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).order('name'),
      supabase.from('vehicle_documents').select('*'),
    ])
    if (v) setVehicles(v as Vehicle[])
    if (d) setDocuments(d as VehicleDocument[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function verDocumento(doc: VehicleDocument) {
    setDownloadingId(doc.id)
    const { data, error } = await supabase.storage.from('vehicle-documents').createSignedUrl(doc.file_url, 120)
    setDownloadingId(null)

    if (error || !data) {
      toast.error('No se pudo abrir el documento')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Documentación</h1>
        <p className="text-muted-foreground">VTV, Seguro y Tarjeta Verde de cada vehículo</p>
      </div>

      <div className="space-y-4">
        {vehicles.map((v) => {
          const vehicleDocs = documents.filter((d) => d.vehicle_id === v.id)
          const diasVtv = diasHasta(v.vtv_expiry_date)
          const diasSeguro = diasHasta(v.insurance_expiry_date)

          return (
            <div key={v.id} className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="font-medium">{v.name}</p>
                <p className="text-sm text-muted-foreground">{v.plate}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <VencimientoRow label="VTV" dias={diasVtv} />
                <VencimientoRow label="Seguro" dias={diasSeguro} />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {REQUIRED_DOCS.map((docType) => {
                  const doc = vehicleDocs.find((d) => d.doc_type === docType)
                  return (
                    <Button
                      key={docType}
                      size="sm"
                      variant={doc ? 'outline' : 'ghost'}
                      disabled={!doc || downloadingId === doc?.id}
                      onClick={() => doc && verDocumento(doc)}
                      className="gap-1.5"
                    >
                      {downloadingId === doc?.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : doc ? (
                        <FileText className="h-3.5 w-3.5" />
                      ) : null}
                      {DOC_LABELS[docType]}
                      {!doc && <span className="text-xs text-muted-foreground">(sin cargar)</span>}
                    </Button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {vehicles.length === 0 && <p className="text-muted-foreground">No hay vehículos activos.</p>}
      </div>
    </div>
  )
}

function VencimientoRow({ label, dias }: { label: string; dias: number | null }) {
  if (dias === null) {
    return (
      <div className="flex items-center justify-between text-muted-foreground">
        <span>{label}</span>
        <span>Sin datos</span>
      </div>
    )
  }
  const vencida = dias < 0
  const proxima = dias >= 0 && dias <= 30

  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {vencida ? <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
        {label}
      </span>
      <span className="flex items-center gap-2">
        {vencida && <Badge variant="destructive">Vencida</Badge>}
        {proxima && <Badge variant="warning">{dias}d</Badge>}
        {!vencida && !proxima && <Badge variant="success">OK</Badge>}
      </span>
    </div>
  )
}
