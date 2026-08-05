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
