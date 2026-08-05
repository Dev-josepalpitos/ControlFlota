-- ============================================================
-- MIGRACIÓN: estaciones de servicio (lista editable)
-- ============================================================

CREATE TABLE fuel_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fuel_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_stations_select_authenticated" ON fuel_stations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "fuel_stations_admin_write" ON fuel_stations
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Cambiar fuel_logs.station de texto libre a referencia a la lista.
-- Se deja la columna vieja "station" para no perder el histórico
-- de texto libre ya cargado, y se agrega station_id para lo nuevo.
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES fuel_stations(id);

-- Datos de ejemplo, editalos/borralos desde Admin → Estaciones.
INSERT INTO fuel_stations (name) VALUES
  ('YPF'),
  ('Shell'),
  ('Axion'),
  ('Puma')
ON CONFLICT (name) DO NOTHING;
