-- ============================================================
-- MIGRACIÓN: Configuración general (precio de combustible)
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_authenticated" ON app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "app_settings_admin_write" ON app_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Valor inicial: precio por litro de nafta. Cambialo desde
-- Admin → Configuración cuando varíe (podés hacerlo las veces que quieras).
INSERT INTO app_settings (key, value) VALUES ('fuel_price_per_liter', '1000')
ON CONFLICT (key) DO NOTHING;
