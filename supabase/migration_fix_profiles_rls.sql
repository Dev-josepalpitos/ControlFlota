-- ============================================================
-- FIX: los conductores no podían ver el Historial completo
-- porque la política de profiles solo dejaba ver el propio perfil.
-- Como Historial/Dashboard/Reportes muestran el nombre de OTROS
-- choferes (quién retiró, quién devolvió, etc.), esas consultas
-- fallaban para cualquiera que no fuera admin.
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Nota: esto solo cambia quién puede LEER nombres/roles de otros
-- usuarios (necesario para que la app funcione). La política de
-- UPDATE sigue igual: cada uno solo puede editar su propio perfil,
-- y solo un admin puede editar el de otros.
