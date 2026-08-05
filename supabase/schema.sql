-- ============================================================
-- FLOTA SAAS - SCHEMA COMPLETO (con mejoras aplicadas)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Extensión necesaria para uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLA: profiles
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. TABLA: vehicles
-- Mejora: is_active para soft-delete
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plate TEXT UNIQUE NOT NULL,
  current_km INTEGER NOT NULL DEFAULT 0 CHECK (current_km >= 0),
  photo_url TEXT,
  vtv_expiry_date DATE,
  last_service_date DATE,
  next_service_km INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABLA: key_logs
-- Mejora: check de status coherente
-- ============================================================
CREATE TABLE key_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  requested_by_id UUID NOT NULL REFERENCES profiles(id),
  returned_by_id UUID REFERENCES profiles(id) NULL,
  out_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  return_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'EN_USO' CHECK (status IN ('EN_USO', 'DEVUELTA')),
  km_returned INTEGER NULL CHECK (km_returned IS NULL OR km_returned >= 0),
  CONSTRAINT status_coherente CHECK (
    (status = 'EN_USO' AND return_at IS NULL AND km_returned IS NULL)
    OR
    (status = 'DEVUELTA' AND return_at IS NOT NULL AND km_returned IS NOT NULL)
  )
);

-- MEJORA CRÍTICA #1: evita que un vehículo tenga dos retiros
-- "EN_USO" simultáneos por condición de carrera.
CREATE UNIQUE INDEX one_active_key_per_vehicle
  ON key_logs (vehicle_id)
  WHERE status = 'EN_USO';

-- MEJORA: un conductor no puede tener más de una llave "EN_USO"
-- a la vez, sin importar el vehículo.
CREATE UNIQUE INDEX one_active_key_per_driver
  ON key_logs (driver_id)
  WHERE status = 'EN_USO';

-- Índices de performance para el historial
CREATE INDEX idx_key_logs_out_at ON key_logs (out_at DESC);
CREATE INDEX idx_key_logs_vehicle ON key_logs (vehicle_id);

-- ============================================================
-- 4. FUNCIÓN AUXILIAR is_admin()
-- Mejora: evita el patrón de subquery repetido en cada policy
-- y reduce el riesgo de recursión / mejora legibilidad.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 5. TRIGGER: creación automática de perfil
-- ============================================================
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'driver');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 6. TRIGGER: al devolver llave, sincroniza vehicles.current_km
-- y valida que el km no retroceda (mejora #5 del análisis,
-- aplicada ahora en DB en vez de dejarla solo para el módulo OCR futuro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_key_return()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DEVUELTA' AND OLD.status = 'EN_USO' THEN
    IF NEW.km_returned < (SELECT current_km FROM vehicles WHERE id = NEW.vehicle_id) THEN
      RAISE EXCEPTION 'El kilometraje ingresado (%) no puede ser menor al kilometraje actual del vehículo (%)',
        NEW.km_returned, (SELECT current_km FROM vehicles WHERE id = NEW.vehicle_id);
    END IF;

    UPDATE vehicles SET current_km = NEW.km_returned WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_key_returned
  BEFORE UPDATE ON key_logs
  FOR EACH ROW EXECUTE FUNCTION handle_key_return();

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_logs ENABLE ROW LEVEL SECURITY;

-- --- profiles ---
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_admin());

-- --- vehicles ---
CREATE POLICY "vehicles_select_authenticated" ON vehicles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "vehicles_admin_write" ON vehicles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- --- key_logs ---
CREATE POLICY "key_logs_select_authenticated" ON key_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- MEJORA CRÍTICA #1: ya no se permite que un usuario asigne
-- driver_id a otra persona sin ser admin. Solo puede insertar
-- registros donde ÉL sea el conductor Y el solicitante.
CREATE POLICY "key_logs_insert_self" ON key_logs
  FOR INSERT WITH CHECK (
    (auth.uid() = driver_id AND auth.uid() = requested_by_id)
    OR is_admin()
  );

-- Un usuario puede devolver una llave que él mismo retiró,
-- o cualquier usuario autenticado puede registrar la devolución
-- física (ajustar según regla de negocio real del cliente).
CREATE POLICY "key_logs_update_return" ON key_logs
  FOR UPDATE USING (
    auth.uid() = driver_id OR auth.uid() = requested_by_id OR is_admin()
  );

-- ============================================================
-- 8. DATOS DE PRUEBA
-- ============================================================
INSERT INTO vehicles (name, plate, current_km, next_service_km, vtv_expiry_date) VALUES
('Fiat Fiorino 2018', 'ABC123', 45200, 50000, '2026-11-30'),
('Fiat Fiorino 2026', 'XYZ789', 1200, 5000, '2027-06-15');

-- El usuario de prueba (admin@flota.com / 12345678) se crea desde
-- Authentication > Users en el panel de Supabase, no por SQL.
-- Después de crearlo, actualizar su rol a admin:
-- UPDATE profiles SET role = 'admin' WHERE full_name = 'admin@flota.com';
