import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Wrench, KeyRound, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKm } from '@/lib/utils'
import type { VehicleWithActiveLog } from '@/types/database'
import RetiroModal from './RetiroModal'
import DevolucionModal from './DevolucionModal'

interface Props {
  vehicle: VehicleWithActiveLog
  index: number
  disableRetiro?: boolean
}

const DIAS_ALERTA_VTV = 30

export default function VehicleCard({ vehicle, index, disableRetiro = false }: Props) {
  const [retiroOpen, setRetiroOpen] = useState(false)
  const [devolucionOpen, setDevolucionOpen] = useState(false)

  const enUso = !!vehicle.active_log

  // Alerta si falta poco para el próximo service.
  const kmParaService = vehicle.next_service_km ? vehicle.next_service_km - vehicle.current_km : null
  const serviceProximo = kmParaService !== null && kmParaService <= 1000

  // Alerta de VTV: vencida o próxima a vencer (dentro de DIAS_ALERTA_VTV días).
  let vtvEstado: 'ok' | 'proxima' | 'vencida' | null = null
  let diasVtv: number | null = null
  if (vehicle.vtv_expiry_date) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const vencimiento = new Date(vehicle.vtv_expiry_date)
    diasVtv = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    if (diasVtv < 0) vtvEstado = 'vencida'
    else if (diasVtv <= DIAS_ALERTA_VTV) vtvEstado = 'proxima'
    else vtvEstado = 'ok'
  }

  const bordeColor = vtvEstado === 'vencida' ? 'border-l-red-600' : enUso ? 'border-l-amber-500' : 'border-l-emerald-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Card className={`border-l-4 ${bordeColor}`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle>{vehicle.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{vehicle.plate}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant={enUso ? 'warning' : 'success'}>{enUso ? 'En Calle' : 'Disponible'}</Badge>
            {vtvEstado === 'vencida' && <Badge variant="destructive">VTV Vencida</Badge>}
            {vtvEstado === 'proxima' && <Badge variant="warning">VTV vence en {diasVtv}d</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span>{formatKm(vehicle.current_km)}</span>
          </div>
          {vehicle.next_service_km && (
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span>Próximo service: {formatKm(vehicle.next_service_km)}</span>
              {serviceProximo && (
                <span title="Se acerca el service" className="inline-flex">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </span>
              )}
            </div>
          )}
          {vtvEstado && vtvEstado !== 'ok' && (
            <div className={`flex items-center gap-2 text-sm ${vtvEstado === 'vencida' ? 'text-red-600' : 'text-amber-600'}`}>
              <ShieldAlert className="h-4 w-4" />
              <span>
                {vtvEstado === 'vencida'
                  ? `VTV vencida hace ${Math.abs(diasVtv!)} día${Math.abs(diasVtv!) === 1 ? '' : 's'}`
                  : `VTV vence en ${diasVtv} día${diasVtv === 1 ? '' : 's'}`}
              </span>
            </div>
          )}
          {enUso && vehicle.active_log && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4" />
              <span>Con {vehicle.active_log.driver.full_name}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-1.5">
          {enUso ? (
            <Button className="w-full h-11" variant="secondary" onClick={() => setDevolucionOpen(true)}>
              Devolver Llave
            </Button>
          ) : (
            <>
              <Button className="w-full h-11" onClick={() => setRetiroOpen(true)} disabled={disableRetiro}>
                Retirar Unidad
              </Button>
              {disableRetiro && (
                <p className="text-xs text-center text-muted-foreground">
                  Ya tenés otra llave en uso
                </p>
              )}
            </>
          )}
        </CardFooter>
      </Card>

      <RetiroModal vehicle={vehicle} open={retiroOpen} onOpenChange={setRetiroOpen} />
      {vehicle.active_log && (
        <DevolucionModal
          vehicle={vehicle}
          activeLog={vehicle.active_log}
          open={devolucionOpen}
          onOpenChange={setDevolucionOpen}
        />
      )}
    </motion.div>
  )
}
