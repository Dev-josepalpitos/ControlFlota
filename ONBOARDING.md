# 🚀 Onboarding de un cliente nuevo — FlotaSaaS

Checklist para poner en marcha una instancia nueva (multi-instancia: un
proyecto Supabase + un deploy de Vercel por cliente). Tiempo estimado:
15-20 minutos si vas siguiendo los pasos en orden.

---

## 1. Repositorio de código

- [ ] Cloná/forkeá el repo base a uno nuevo (ej: `flota-<nombre-cliente>`).
- [ ] No hace falta tocar código — el nombre visible y la moneda se
      configuran después, desde la app (paso 6).

## 2. Proyecto Supabase

- [ ] Creá un proyecto nuevo en [supabase.com](https://supabase.com).
- [ ] Elegí la región más cercana al cliente (mejor latencia).
- [ ] Andá a **SQL Editor** → pegá y ejecutá el contenido completo de
      `supabase/setup.sql` (un solo archivo, no las migraciones sueltas).
- [ ] Confirmá que no haya errores. Si algo falla, revisar que se haya
      copiado el archivo entero (843 líneas aprox.).

## 3. Usuario administrador inicial

- [ ] **Authentication → Users → Add user**:
      - Email: el que te pase el cliente
      - Password: generá una fuerte y pasásela por un canal seguro
      - ✅ Marcar "Auto Confirm User"
- [ ] En **SQL Editor**, corré (reemplazando el email real):
  ```sql
  UPDATE profiles SET role = 'admin' WHERE full_name = 'admin@cliente.com';
  ```

## 4. Realtime

- [ ] **Database → Replication** → activar para las tablas:
      - `vehicles`
      - `key_logs`

## 5. Edge Function (necesaria para que el admin cree usuarios desde la app)

- [ ] **Edge Functions → Deploy a new function**
- [ ] Nombre exacto: `admin-create-user`
- [ ] Pegar el contenido de `supabase/functions/admin-create-user/index.ts`
- [ ] Deploy.

## 6. Variables de entorno y deploy en Vercel

- [ ] **Project Settings → API** en Supabase → copiar `Project URL` y `anon public key`.
- [ ] Importar el repo en Vercel (proyecto nuevo).
- [ ] **Settings → Environment Variables**:
      - `VITE_SUPABASE_URL`
      - `VITE_SUPABASE_ANON_KEY`
- [ ] Deploy.
- [ ] (Opcional) Configurar dominio propio del cliente en Vercel.

## 7. Personalización de marca (dentro de la app, no requiere código)

Loguearse como admin y en **Admin → Configuración**:

- [ ] **Nombre del sistema**: nombre de la empresa del cliente
- [ ] **Moneda**: la que corresponda (ARS/USD/UYU/CLP/BRL/MXN)
- [ ] **Precio de combustible por litro**: el valor actual

## 8. Datos iniciales

- [ ] **Admin → Vehículos**: cargar los vehículos reales del cliente
      (nombre, patente, km actual, VTV, seguro).
- [ ] **Admin → VTV, Seguro y Trabajos**: subir los documentos reales
      (VTV, Seguro, Tarjeta Verde) de cada vehículo.
- [ ] **Admin → Estaciones de Servicio**: cargar las estaciones que usa
      habitualmente (o dejar las de ejemplo si sirven).
- [ ] **Admin → Usuarios**: crear los usuarios de los conductores reales.

## 9. Prueba final antes de entregar

- [ ] Login como admin: revisar Dashboard, Reportes, todas las pestañas.
- [ ] Login como conductor: confirmar que NO ve Historial ni Reportes,
      y que sí puede retirar/devolver llave y cargar combustible.
- [ ] Retirar y devolver un vehículo de prueba (con fotos) para
      confirmar que todo el flujo end-to-end funciona.
- [ ] Borrar el vehículo/movimiento de prueba antes de entregar.

---

## Costos a tener en cuenta por cliente

- **Supabase**: plan gratuito alcanza para empezar (hasta cierto volumen
  de base de datos/storage/usuarios activos). Revisar límites vigentes
  en supabase.com/pricing si el cliente crece.
- **Vercel**: el plan gratuito (Hobby) sirve para la mayoría de estos
  casos; si es uso comercial estricto, revisar los términos de Vercel
  sobre uso Hobby vs. Pro.

## Si en el futuro pasás a multi-tenant real

Este checklist asume una instancia por cliente. Si en algún momento el
volumen de clientes crece mucho (30-50+) y conviene migrar a una sola
base de datos multi-tenant, ese es un trabajo de refactor aparte —
avisame cuando llegue ese momento y lo planificamos.
