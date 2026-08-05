export type UserRole = 'driver' | 'admin'
export type KeyLogStatus = 'EN_USO' | 'DEVUELTA'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  is_active: boolean
  assigned_vehicle_id: string | null
}

export interface Vehicle {
  id: string
  name: string
  plate: string
  current_km: number
  photo_url: string | null
  vtv_expiry_date: string | null
  last_service_date: string | null
  next_service_km: number | null
  is_active: boolean
  notes: string | null
  created_at: string
  insurance_company: string | null
  insurance_policy_number: string | null
  insurance_expiry_date: string | null
}

export interface FuelStation {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface FuelLog {
  id: string
  vehicle_id: string
  driver_id: string
  liters: number
  cost: number
  odometer_km: number | null
  station: string | null
  station_id: string | null
  receipt_photo_url: string | null
  loaded_at: string
}

export type DocType = 'vtv' | 'seguro' | 'tarjeta_verde' | 'otro'

export interface VehicleDocument {
  id: string
  vehicle_id: string
  doc_type: DocType
  file_url: string
  file_name: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export type IncidentCategory =
  | 'pinchazo'
  | 'rayon'
  | 'golpe'
  | 'rotura'
  | 'foco_quemado'
  | 'mecanico'
  | 'otro'
export type IncidentStatus = 'abierta' | 'resuelta'

export interface Incident {
  id: string
  vehicle_id: string
  driver_id: string
  category: IncidentCategory
  description: string
  photo_url: string | null
  status: IncidentStatus
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
}

export type MaintenanceType = 'service' | 'reparacion' | 'vtv' | 'seguro' | 'otro'

export interface MaintenanceRecord {
  id: string
  vehicle_id: string
  type: MaintenanceType
  description: string
  km_at_service: number | null
  cost: number | null
  performed_at: string
  created_by: string | null
  created_at: string
}

export interface KeyLog {
  id: string
  vehicle_id: string
  driver_id: string
  requested_by_id: string
  returned_by_id: string | null
  out_at: string
  return_at: string | null
  status: KeyLogStatus
  km_returned: number | null
  km_out: number | null
  km_photo_url: string | null
}

export interface KeyLogWithRelations extends KeyLog {
  vehicle: Pick<Vehicle, 'name' | 'plate'>
  driver: Pick<Profile, 'full_name'>
  requested_by: Pick<Profile, 'full_name'>
  returned_by: Pick<Profile, 'full_name'> | null
}

export interface VehicleWithActiveLog extends Vehicle {
  active_log: (KeyLog & { driver: Pick<Profile, 'full_name'> }) | null
}

// Tipo genérico simplificado para el cliente de Supabase.
// Para un tipado 100% estricto generar con:
// npx supabase gen types typescript --project-id <ID> > src/types/database.ts
export type Database = any
