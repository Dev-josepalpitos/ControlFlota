-- ============================================================
-- MIGRACIÓN: vehículo asignado por conductor
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES vehicles(id);

-- Reforzar a nivel de base: un conductor (no admin) solo puede
-- cargar combustible en el vehículo que tiene asignado.
DROP POLICY IF EXISTS "fuel_logs_insert_self_or_admin" ON fuel_logs;
CREATE POLICY "fuel_logs_insert_self_or_admin" ON fuel_logs
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      auth.uid() = driver_id
      AND is_active_user()
      AND vehicle_id = (SELECT assigned_vehicle_id FROM profiles WHERE id = auth.uid())
    )
  );
