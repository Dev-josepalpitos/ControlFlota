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
