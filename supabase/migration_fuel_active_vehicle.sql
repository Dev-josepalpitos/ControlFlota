-- ============================================================
-- CORRECCIÓN: en vez de un vehículo "asignado" fijo por conductor,
-- la regla real es: solo puede cargar combustible en el vehículo
-- del que tiene la llave retirada en ese momento (key_logs con
-- status = 'EN_USO').
-- ============================================================

DROP POLICY IF EXISTS "fuel_logs_insert_self_or_admin" ON fuel_logs;

CREATE POLICY "fuel_logs_insert_active_vehicle_or_admin" ON fuel_logs
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      auth.uid() = driver_id
      AND is_active_user()
      AND EXISTS (
        SELECT 1 FROM key_logs
        WHERE key_logs.driver_id = auth.uid()
          AND key_logs.vehicle_id = fuel_logs.vehicle_id
          AND key_logs.status = 'EN_USO'
      )
    )
  );

-- La columna profiles.assigned_vehicle_id queda sin uso (no hace
-- falta borrarla, es inofensiva); si querés limpiarla del todo:
-- ALTER TABLE profiles DROP COLUMN assigned_vehicle_id;
