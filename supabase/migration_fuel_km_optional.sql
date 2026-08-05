-- ============================================================
-- MIGRACIÓN: hacer opcional el kilometraje en cargas de combustible
-- ============================================================

ALTER TABLE fuel_logs ALTER COLUMN odometer_km DROP NOT NULL;
