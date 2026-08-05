-- ============================================================
-- MIGRACIÓN: foto del odómetro al devolver la llave
-- (preparación para OCR futuro)
-- ============================================================

ALTER TABLE key_logs ADD COLUMN IF NOT EXISTS km_photo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('odometer-photos', 'odometer-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "odometer_photos_select_authenticated"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'odometer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "odometer_photos_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'odometer-photos' AND auth.role() = 'authenticated');
