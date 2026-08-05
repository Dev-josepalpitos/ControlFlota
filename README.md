# 🚗 FlotaSaaS — Sistema de Gestión de Flota

Proyecto generado a partir del documento de especificación, con las mejoras de
seguridad y consistencia de datos aplicadas (ver sección **Cambios vs. spec original**).

## 1. Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com)
- Repositorio en GitHub

## 2. Setup de Supabase

1. Creá un proyecto nuevo en Supabase.
2. Andá a **SQL Editor** y ejecutá, **en este orden exacto**, cada uno de estos archivos (todos están en `supabase/`):

   1. `schema.sql`
   2. `migration_admin.sql`
   3. `migration_fuel.sql`
   4. `migration_reports.sql`
   5. `migration_settings.sql`
   6. `migration_saas_settings.sql`
   7. `migration_settings_public_read.sql`
   8. `migration_fuel_stations.sql`
   9. `migration_fix_profiles_rls.sql`
   10. `migration_storage_security.sql`
   11. `migration_fix_devolucion.sql`
   12. `migration_vehicle_condition_photos.sql`
   13. `migration_assigned_vehicle.sql`
   14. `migration_fuel_active_vehicle.sql` (reemplaza la regla de `migration_assigned_vehicle.sql`, dejala igual corrida antes)
   15. `migration_user_active.sql`
   16. `migration_odometer_photo.sql`
   17. `migration_fuel_km_optional.sql`
   18. `migration_vehicle_documents.sql`
   19. `migration_incidents.sql`
   20. `migration_incidents_active_vehicle.sql`

3. Andá a **Authentication → Users → Add user** y creá el usuario admin:
   - Email: el que quieras usar como admin
   - Password: una contraseña fuerte (mínimo 8 caracteres)
4. En **SQL Editor**, corré para volverlo admin (reemplazando el email):
   ```sql
   UPDATE profiles SET role = 'admin' WHERE full_name = 'tu-email@ejemplo.com';
   ```
5. Andá a **Project Settings → API** y copiá `Project URL` y `anon public key`.
6. Andá a **Database → Replication** y activá Realtime para las tablas `vehicles` y `key_logs`.
7. **Desplegá la Edge Function** `admin-create-user` (necesaria para crear usuarios desde el panel Admin sin usar el dashboard de Supabase):
   - Vía dashboard: Edge Functions → Deploy a new function → nombre `admin-create-user` → pegar el contenido de `supabase/functions/admin-create-user/index.ts`.
   - Vía CLI: `supabase functions deploy admin-create-user` (después de `supabase login` y `supabase link`).

## 3. Setup local

```bash
git clone <tu-repo>
cd flota-saas
npm install
cp .env.example .env.local   # completar con tus credenciales de Supabase
npm run dev
```

## 4. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit: FlotaSaaS"
git branch -M main
git remote add origin https://github.com/tu-usuario/flota-saas.git
git push -u origin main
```

## 5. Despliegue en Vercel

1. Importá el repo en Vercel.
2. En **Settings → Environment Variables**, agregá:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. El framework preset "Vite" se detecta automáticamente.

---

## Cambios vs. spec original (resumen del análisis)

| # | Cambio | Motivo |
|---|--------|--------|
| 1 | Índice único `one_active_key_per_vehicle` | Evita que dos personas retiren el mismo vehículo por condición de carrera. |
| 2 | Policy de `INSERT` en `key_logs` restringida a `auth.uid() = driver_id AND auth.uid() = requested_by_id` (salvo admin) | La spec original permitía asignar el vehículo a **otro** conductor sin ser admin. |
| 3 | Función `is_admin()` `SECURITY DEFINER` | Reemplaza subqueries repetidas en cada policy, más legible y mantenible. |
| 4 | Trigger `handle_key_return` | Valida en la base que el km devuelto no sea menor al actual, y sincroniza `vehicles.current_km` automáticamente (antes lo hacía el cliente "a mano"). |
| 5 | Constraint `status_coherente` | Impide estados inconsistentes (ej. `EN_USO` con `return_at` cargado). |
| 6 | Campo `vehicles.is_active` | Soft-delete de vehículos dados de baja, sin romper el historial. |
| 7 | Badge de alerta de service próximo | El campo `next_service_km` ahora se usa activamente en el Dashboard. |
| 8 | Paginación real en Historial (`.range()`) | Implementada desde el MVP en vez de dejarla "para después". |

## Próximos pasos sugeridos

- Alerta de vencimiento de VTV en el Dashboard (falta UI, el dato ya está en `vehicles.vtv_expiry_date`).
- Confirmación explícita antes de "Cerrar Sesión".
- Módulo OCR + app móvil (sección 7 del documento original).
