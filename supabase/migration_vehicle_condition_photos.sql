-- ============================================================
-- MIGRACIÓN: fotos de estado del vehículo al retirar/devolver
-- (frente, lateral derecho, lateral izquierdo, atrás)
-- ============================================================

CREATE TABLE vehicle_condition_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_log_id UUID NOT NULL REFERENCES key_logs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('retiro', 'devolucion')),
  side TEXT NOT NULL CHECK (side IN ('frente', 'derecha', 'izquierda', 'atras')),
  photo_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (key_log_id, stage, side)
);

CREATE INDEX idx_condition_photos_key_log ON vehicle_condition_photos (key_log_id);

ALTER TABLE vehicle_condition_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "condition_photos_select_authenticated" ON vehicle_condition_photos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "condition_photos_insert_own_or_admin" ON vehicle_condition_photos
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by OR is_admin());

CREATE POLICY "condition_photos_update_own_or_admin" ON vehicle_condition_photos
  FOR UPDATE USING (auth.uid() = uploaded_by OR is_admin());

-- Bucket de Storage, con la misma política de "cada uno ve/sube
-- lo suyo, admin ve todo" que usamos para combustible y odómetro.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-condition-photos', 'vehicle-condition-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "condition_photos_storage_select_own_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-condition-photos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin())
  );

CREATE POLICY "condition_photos_storage_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-condition-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
