-- ============================================================
-- MIGRACIÓN: Reportes / Estadísticas por vehículo y por chofer
-- Ejecutar en el SQL Editor de Supabase, después de las
-- migraciones anteriores.
-- ============================================================

-- 1. Guardar el km con el que salió el vehículo en cada retiro.
--    Así se puede calcular km_recorridos = km_returned - km_out.
ALTER TABLE key_logs ADD COLUMN IF NOT EXISTS km_out INTEGER;

-- 2. Trigger: al insertar un retiro, copiar automáticamente el
--    current_km del vehículo en ese momento. No requiere cambios
--    en el frontend.
CREATE OR REPLACE FUNCTION public.handle_key_retiro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.km_out IS NULL THEN
    SELECT current_km INTO NEW.km_out FROM public.vehicles WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_key_retiro
  BEFORE INSERT ON key_logs
  FOR EACH ROW EXECUTE FUNCTION handle_key_retiro();

-- 3. Nota: los viajes creados ANTES de esta migración van a tener
--    km_out = NULL, así que no entran en el cálculo de km recorridos
--    (se cuentan igual como "viaje" pero sin km). Si querés completarlos
--    a mano para el histórico, podés correr un UPDATE puntual por id.
