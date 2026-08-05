-- ============================================================
-- MIGRACIÓN: Configuración SaaS (nombre del sistema, moneda)
-- Ejecutar en el SQL Editor de Supabase, después de
-- migration_settings.sql.
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
  ('system_name', 'FlotaSaaS'),
  ('currency_code', 'ARS')
ON CONFLICT (key) DO NOTHING;
