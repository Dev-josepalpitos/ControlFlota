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
