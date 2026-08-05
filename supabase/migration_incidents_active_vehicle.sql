-- ============================================================
-- REFUERZO: un chofer solo puede reportar una incidencia sobre
-- el vehículo del que tiene la llave retirada en ese momento
-- (mismo criterio que ya aplicamos a fuel_logs).
-- ============================================================

DROP POLICY IF EXISTS "incidents_insert_self_or_admin" ON incidents;

CREATE POLICY "incidents_insert_active_vehicle_or_admin" ON incidents
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      auth.uid() = driver_id
      AND is_active_user()
      AND EXISTS (
        SELECT 1 FROM key_logs
        WHERE key_logs.driver_id = auth.uid()
          AND key_logs.vehicle_id = incidents.vehicle_id
          AND key_logs.status = 'EN_USO'
      )
    )
  );
