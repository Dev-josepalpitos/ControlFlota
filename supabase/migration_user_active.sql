-- ============================================================
-- MIGRACIÓN: habilitar/deshabilitar acceso de usuarios
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Función helper: ¿el usuario logueado está activo?
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Reforzar: un usuario deshabilitado no puede retirar llaves,
-- aunque de alguna forma conserve una sesión activa.
DROP POLICY IF EXISTS "key_logs_insert_self" ON key_logs;
CREATE POLICY "key_logs_insert_self" ON key_logs
  FOR INSERT WITH CHECK (
    (auth.uid() = driver_id AND auth.uid() = requested_by_id AND is_active_user())
    OR is_admin()
  );

-- Reforzar: tampoco puede cargar combustible.
DROP POLICY IF EXISTS "fuel_logs_insert_self_or_admin" ON fuel_logs;
CREATE POLICY "fuel_logs_insert_self_or_admin" ON fuel_logs
  FOR INSERT WITH CHECK (
    (auth.uid() = driver_id AND is_active_user()) OR is_admin()
  );
