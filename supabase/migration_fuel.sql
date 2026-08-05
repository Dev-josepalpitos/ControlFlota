-- ============================================================
-- MIGRACIÓN: Carga de combustible
-- Ejecutar en el SQL Editor de Supabase, después de las
-- migraciones anteriores.
-- ============================================================

CREATE TABLE fuel_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  liters NUMERIC(10, 2) NOT NULL CHECK (liters > 0),
  cost NUMERIC(12, 2) NOT NULL CHECK (cost >= 0),
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  station TEXT,
  receipt_photo_url TEXT,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fuel_logs_vehicle ON fuel_logs (vehicle_id, loaded_at DESC);
CREATE INDEX idx_fuel_logs_driver ON fuel_logs (driver_id, loaded_at DESC);

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver el historial de cargas.
CREATE POLICY "fuel_logs_select_authenticated" ON fuel_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Un conductor solo puede registrar cargas a su propio nombre.
-- Un admin puede registrar a nombre de cualquiera.
CREATE POLICY "fuel_logs_insert_self_or_admin" ON fuel_logs
  FOR INSERT WITH CHECK (auth.uid() = driver_id OR is_admin());

-- Solo admin puede editar/borrar cargas ya registradas.
CREATE POLICY "fuel_logs_admin_write" ON fuel_logs
  FOR UPDATE USING (is_admin());
CREATE POLICY "fuel_logs_admin_delete" ON fuel_logs
  FOR DELETE USING (is_admin());

-- ============================================================
-- Storage: bucket para fotos de comprobantes (a futuro).
-- Corré esto también, así queda listo el bucket cuando
-- se implemente la carga de fotos.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-receipts', 'fuel-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fuel_receipts_select_authenticated"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fuel-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "fuel_receipts_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fuel-receipts' AND auth.role() = 'authenticated');
