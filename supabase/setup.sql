-- ============================================================
-- FLOTA SAAS — SETUP COMPLETO PARA UN CLIENTE NUEVO
-- Pegar y ejecutar este archivo ENTERO, una sola vez, en el
-- SQL Editor de un proyecto Supabase recién creado.
--
-- Es la suma de las 20 migraciones incrementales que se fueron
-- armando durante el desarrollo, en el orden correcto. Para
-- clientes nuevos, usar SOLO este archivo (no las migraciones
-- sueltas, que quedan como historial de referencia).
-- ============================================================


-- ============================================================
-- ORIGEN: schema.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_admin.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: módulo Admin (usuarios, vehículos, seguro, mantenimiento)
-- Ejecutar en el SQL Editor de Supabase, después del schema.sql
-- e índice one_active_key_per_driver ya aplicados.
-- ============================================================

-- 1. Datos de seguro en vehicles
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
  ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE;

-- 2. Historial de trabajos realizados (service, reparaciones, etc.)
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('service', 'reparacion', 'vtv', 'seguro', 'otro')),
  description TEXT NOT NULL,
  km_at_service INTEGER,
  cost NUMERIC(12, 2),
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_vehicle ON maintenance_records (vehicle_id, performed_at DESC);

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_select_authenticated" ON maintenance_records
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "maintenance_admin_write" ON maintenance_records
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 3. Permitir que admins actualicen el rol de otros perfiles
-- (la policy profiles_update_own ya cubre esto vía is_admin(), no hace falta nada más)

-- 4. Permitir insertar vehículos nuevos desde el panel admin
-- (vehicles_admin_write ya cubre INSERT/UPDATE/DELETE para admins, no hace falta nada más)


-- ============================================================
-- ORIGEN: migration_fuel.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_reports.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_settings.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_saas_settings.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: Configuración SaaS (nombre del sistema, moneda)
-- Ejecutar en el SQL Editor de Supabase, después de
-- migration_settings.sql.
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
  ('system_name', 'FlotaSaaS'),
  ('currency_code', 'ARS')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- ORIGEN: migration_settings_public_read.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: permitir que la pantalla de Login (sin sesión)
-- pueda leer app_settings, para mostrar el nombre del sistema
-- antes de iniciar sesión.
-- ============================================================

DROP POLICY IF EXISTS "app_settings_select_authenticated" ON app_settings;

CREATE POLICY "app_settings_select_public" ON app_settings
  FOR SELECT USING (true);


-- ============================================================
-- ORIGEN: migration_fuel_stations.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_fix_profiles_rls.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_storage_security.sql
-- ============================================================
-- ============================================================
-- MEJORA DE SEGURIDAD: aislar las fotos por carpeta de usuario.
-- Antes: cualquier autenticado podía leer/subir a cualquier
-- carpeta del bucket (bajo riesgo, pero mejorable).
-- Ahora: cada usuario solo puede leer/subir en su propia carpeta
-- (la carpeta es su propio user id, así se suben desde el código).
-- Los admins pueden ver todo, para auditoría.
-- ============================================================

-- --- fuel-receipts ---
DROP POLICY IF EXISTS "fuel_receipts_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fuel_receipts_insert_authenticated" ON storage.objects;

CREATE POLICY "fuel_receipts_select_own_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'fuel-receipts'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin())
  );

CREATE POLICY "fuel_receipts_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fuel-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- --- odometer-photos ---
DROP POLICY IF EXISTS "odometer_photos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "odometer_photos_insert_authenticated" ON storage.objects;

CREATE POLICY "odometer_photos_select_own_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'odometer-photos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin())
  );

CREATE POLICY "odometer_photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'odometer-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Nota: esto no rompe nada del código existente, porque tanto
-- Fuel.tsx como DevolucionModal.tsx ya suben los archivos con
-- el path "{profile.id}/archivo.jpg", que es exactamente el
-- formato que esta política espera.
--
-- CAMBIO DE COMPORTAMIENTO A TENER EN CUENTA: antes, cualquier
-- conductor podía abrir la foto de OTRO conductor desde el
-- listado de Combustible/Historial. Con esta política, un
-- conductor común solo puede ver SUS PROPIAS fotos; solo los
-- admins pueden ver las de todos (para auditoría). Si preferís
-- que todos vean las fotos de todos (más simple, menos privado),
-- avisame y lo ajustamos.



-- ============================================================
-- ORIGEN: migration_fix_devolucion.sql
-- ============================================================
-- ============================================================
-- FIX: la devolución de llaves estaba restringida a solo quien
-- la retiró (o un admin), a pesar de que la intención original
-- era que cualquier usuario autenticado pueda devolver cualquier
-- llave (por ejemplo, si otro empleado recibe la llave físicamente
-- y la registra él mismo en el sistema).
-- ============================================================

DROP POLICY IF EXISTS "key_logs_update_return" ON key_logs;

CREATE POLICY "key_logs_update_return" ON key_logs
  FOR UPDATE USING (auth.role() = 'authenticated');


-- ============================================================
-- ORIGEN: migration_vehicle_condition_photos.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: fotos de estado del vehículo al retirar/devolver
-- (frente, lateral derecho, lateral izquierdo, atrás)
-- ============================================================

CREATE TABLE vehicle_condition_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_log_id UUID NOT NULL REFERENCES key_logs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('retiro', 'devolucion')),
  side TEXT NOT NULL CHECK (side IN ('frente', 'derecha', 'izquierda', 'atras')),
  photo_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (key_log_id, stage, side)
);

CREATE INDEX idx_condition_photos_key_log ON vehicle_condition_photos (key_log_id);

ALTER TABLE vehicle_condition_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "condition_photos_select_authenticated" ON vehicle_condition_photos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "condition_photos_insert_own_or_admin" ON vehicle_condition_photos
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by OR is_admin());

CREATE POLICY "condition_photos_update_own_or_admin" ON vehicle_condition_photos
  FOR UPDATE USING (auth.uid() = uploaded_by OR is_admin());

-- Bucket de Storage, con la misma política de "cada uno ve/sube
-- lo suyo, admin ve todo" que usamos para combustible y odómetro.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-condition-photos', 'vehicle-condition-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "condition_photos_storage_select_own_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-condition-photos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin())
  );

CREATE POLICY "condition_photos_storage_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-condition-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- ORIGEN: migration_assigned_vehicle.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: vehículo asignado por conductor
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES vehicles(id);

-- Reforzar a nivel de base: un conductor (no admin) solo puede
-- cargar combustible en el vehículo que tiene asignado.
DROP POLICY IF EXISTS "fuel_logs_insert_self_or_admin" ON fuel_logs;
CREATE POLICY "fuel_logs_insert_self_or_admin" ON fuel_logs
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      auth.uid() = driver_id
      AND is_active_user()
      AND vehicle_id = (SELECT assigned_vehicle_id FROM profiles WHERE id = auth.uid())
    )
  );


-- ============================================================
-- ORIGEN: migration_fuel_active_vehicle.sql
-- ============================================================
-- ============================================================
-- CORRECCIÓN: en vez de un vehículo "asignado" fijo por conductor,
-- la regla real es: solo puede cargar combustible en el vehículo
-- del que tiene la llave retirada en ese momento (key_logs con
-- status = 'EN_USO').
-- ============================================================

DROP POLICY IF EXISTS "fuel_logs_insert_self_or_admin" ON fuel_logs;

CREATE POLICY "fuel_logs_insert_active_vehicle_or_admin" ON fuel_logs
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      auth.uid() = driver_id
      AND is_active_user()
      AND EXISTS (
        SELECT 1 FROM key_logs
        WHERE key_logs.driver_id = auth.uid()
          AND key_logs.vehicle_id = fuel_logs.vehicle_id
          AND key_logs.status = 'EN_USO'
      )
    )
  );

-- La columna profiles.assigned_vehicle_id queda sin uso (no hace
-- falta borrarla, es inofensiva); si querés limpiarla del todo:
-- ALTER TABLE profiles DROP COLUMN assigned_vehicle_id;


-- ============================================================
-- ORIGEN: migration_user_active.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_odometer_photo.sql
-- ============================================================
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


-- ============================================================
-- ORIGEN: migration_fuel_km_optional.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: hacer opcional el kilometraje en cargas de combustible
-- ============================================================

ALTER TABLE fuel_logs ALTER COLUMN odometer_km DROP NOT NULL;


-- ============================================================
-- ORIGEN: migration_vehicle_documents.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: documentos del vehículo (VTV, Seguro, Tarjeta Verde)
-- Los sube el admin, cualquier chofer los puede ver/descargar.
-- ============================================================

CREATE TABLE vehicle_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('vtv', 'seguro', 'tarjeta_verde', 'otro')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo documento vigente por tipo y vehículo (subir uno nuevo reemplaza al anterior).
CREATE UNIQUE INDEX one_current_doc_per_type ON vehicle_documents (vehicle_id, doc_type);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_documents_select_authenticated" ON vehicle_documents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "vehicle_documents_admin_write" ON vehicle_documents
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Storage: cualquier autenticado puede DESCARGAR (necesitan tenerlo
-- a mano para un control de tránsito), solo admin puede subir.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vehicle_documents_storage_select_authenticated"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-documents' AND auth.role() = 'authenticated');

CREATE POLICY "vehicle_documents_storage_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-documents' AND is_admin());

CREATE POLICY "vehicle_documents_storage_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vehicle-documents' AND is_admin());


-- ============================================================
-- ORIGEN: migration_incidents.sql
-- ============================================================
-- ============================================================
-- MIGRACIÓN: incidencias / siniestros reportados por el chofer
-- ============================================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  category TEXT NOT NULL CHECK (
    category IN ('pinchazo', 'rayon', 'golpe', 'rotura', 'foco_quemado', 'mecanico', 'otro')
  ),
  description TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'resuelta')),
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_vehicle ON incidents (vehicle_id, created_at DESC);
CREATE INDEX idx_incidents_status ON incidents (status);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Todos ven todas las incidencias (transparencia del estado de la flota).
CREATE POLICY "incidents_select_authenticated" ON incidents
  FOR SELECT USING (auth.role() = 'authenticated');

-- Un chofer activo puede reportar una incidencia a su nombre.
CREATE POLICY "incidents_insert_self_or_admin" ON incidents
  FOR INSERT WITH CHECK (
    (auth.uid() = driver_id AND is_active_user()) OR is_admin()
  );

-- Solo un admin puede marcarla como resuelta.
CREATE POLICY "incidents_update_admin" ON incidents
  FOR UPDATE USING (is_admin());

-- Storage de fotos de incidencias, mismo esquema de carpeta propia
-- que usamos para combustible/odómetro/estado del vehículo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-photos', 'incident-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "incident_photos_select_authenticated"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'incident-photos' AND auth.role() = 'authenticated');

CREATE POLICY "incident_photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'incident-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- ORIGEN: migration_incidents_active_vehicle.sql
-- ============================================================
-- ============================================================
-- REFUERZO: un chofer solo puede reportar una incidencia sobre
-- el vehículo del que tiene la llave retirada en ese momento
-- (mismo criterio que ya aplicamos a fuel_logs).
-- ============================================================

DROP POLICY IF EXISTS "incidents_insert_self_or_admin" ON incidents;

CREATE POLICY "incidents_insert_active_vehicle_or_admin" ON incidents
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      auth.uid() = driver_id
      AND is_active_user()
      AND EXISTS (
        SELECT 1 FROM key_logs
        WHERE key_logs.driver_id = auth.uid()
          AND key_logs.vehicle_id = incidents.vehicle_id
          AND key_logs.status = 'EN_USO'
      )
    )
  );

