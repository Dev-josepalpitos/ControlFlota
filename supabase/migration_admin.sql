-- ============================================================
-- MIGRACIÓN: módulo Admin (usuarios, vehículos, seguro, mantenimiento)
-- Ejecutar en el SQL Editor de Supabase, después del schema.sql
-- e índice one_active_key_per_driver ya aplicados.
-- ============================================================

-- 1. Datos de seguro en vehicles
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
  ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE;

-- 2. Historial de trabajos realizados (service, reparaciones, etc.)
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('service', 'reparacion', 'vtv', 'seguro', 'otro')),
  description TEXT NOT NULL,
  km_at_service INTEGER,
  cost NUMERIC(12, 2),
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_vehicle ON maintenance_records (vehicle_id, performed_at DESC);

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_select_authenticated" ON maintenance_records
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "maintenance_admin_write" ON maintenance_records
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 3. Permitir que admins actualicen el rol de otros perfiles
-- (la policy profiles_update_own ya cubre esto vía is_admin(), no hace falta nada más)

-- 4. Permitir insertar vehículos nuevos desde el panel admin
-- (vehicles_admin_write ya cubre INSERT/UPDATE/DELETE para admins, no hace falta nada más)
