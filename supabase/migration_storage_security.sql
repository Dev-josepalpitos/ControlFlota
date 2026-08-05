-- ============================================================
-- MEJORA DE SEGURIDAD: aislar las fotos por carpeta de usuario.
-- Antes: cualquier autenticado podía leer/subir a cualquier
-- carpeta del bucket (bajo riesgo, pero mejorable).
-- Ahora: cada usuario solo puede leer/subir en su propia carpeta
-- (la carpeta es su propio user id, así se suben desde el código).
-- Los admins pueden ver todo, para auditoría.
-- ============================================================

-- --- fuel-receipts ---
DROP POLICY IF EXISTS "fuel_receipts_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fuel_receipts_insert_authenticated" ON storage.objects;

CREATE POLICY "fuel_receipts_select_own_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'fuel-receipts'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin())
  );

CREATE POLICY "fuel_receipts_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fuel-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- --- odometer-photos ---
DROP POLICY IF EXISTS "odometer_photos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "odometer_photos_insert_authenticated" ON storage.objects;

CREATE POLICY "odometer_photos_select_own_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'odometer-photos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin())
  );

CREATE POLICY "odometer_photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'odometer-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Nota: esto no rompe nada del código existente, porque tanto
-- Fuel.tsx como DevolucionModal.tsx ya suben los archivos con
-- el path "{profile.id}/archivo.jpg", que es exactamente el
-- formato que esta política espera.
--
-- CAMBIO DE COMPORTAMIENTO A TENER EN CUENTA: antes, cualquier
-- conductor podía abrir la foto de OTRO conductor desde el
-- listado de Combustible/Historial. Con esta política, un
-- conductor común solo puede ver SUS PROPIAS fotos; solo los
-- admins pueden ver las de todos (para auditoría). Si preferís
-- que todos vean las fotos de todos (más simple, menos privado),
-- avisame y lo ajustamos.

