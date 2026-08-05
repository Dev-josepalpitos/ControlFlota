-- ============================================================
-- MIGRACIÓN: permitir que la pantalla de Login (sin sesión)
-- pueda leer app_settings, para mostrar el nombre del sistema
-- antes de iniciar sesión.
-- ============================================================

DROP POLICY IF EXISTS "app_settings_select_authenticated" ON app_settings;

CREATE POLICY "app_settings_select_public" ON app_settings
  FOR SELECT USING (true);
