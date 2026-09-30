# Inicio rápido en Mac, Windows o Linux

Si descargaste la copia con configuración personal incluida, usa primero `EMPEZAR_AQUI.md` y `pnpm configurar`; conserva sus `.env` en lugar de reemplazarlos por los ejemplos vacíos.

## 1. Requisitos

- Node.js 24 LTS recomendado (mínimo 22.14).
- pnpm 11.25.0, la versión fijada en `package.json`.
- Un proyecto **nuevo o dedicado** de Supabase para este sistema. No reutilices las tablas de otro sistema sin revisar la migración.

Si tienes Corepack disponible:

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
```

Si tu distribución de Node no incluye Corepack, instala pnpm siguiendo su documentación oficial: https://pnpm.io/installation . Los comandos del proyecto utilizan pnpm.

Descomprime el ZIP y abre una terminal **dentro de `mazate-entregas`**, donde está el `package.json` principal.

```bash
pnpm install --frozen-lockfile
```

## 2. Configura Supabase

En el panel de tu proyecto identifica:

| Dato                                   | Dónde se usa                                 |
| -------------------------------------- | -------------------------------------------- |
| Project URL                            | `SUPABASE_URL` y `VITE_SUPABASE_URL`         |
| Publishable key o anon public key      | Solo `VITE_SUPABASE_ANON_KEY`                |
| Secret key o service-role key          | Solo `SUPABASE_SERVICE_ROLE_KEY`, en backend |
| Connection string PostgreSQL (Connect) | `DATABASE_URL`, en backend                   |

El secret/service-role key **no debe copiarse nunca a frontend**. Vite rechaza claves con prefijo `sb_secret_` o JWT con rol `service_role`.

Para PostgreSQL puedes usar el pooler de sesión; el pooler de transacciones también admite las consultas de esta aplicación, que no usa `LISTEN` ni consultas preparadas con nombre. Usa los datos exactos de **Connect** de tu proyecto. Codifica los caracteres especiales de la contraseña en la URL. Si la conexión requiere un certificado CA, descarga el certificado desde tu proyecto y configúralo en `DATABASE_SSL_CA`; nunca desactives la verificación del certificado.

En Supabase Auth mantén habilitado el proveedor Email y desactiva el registro público de nuevas cuentas. Las cuentas se crean desde el administrador. Para recuperación externa de contraseña, configura SMTP y las URL autorizadas antes de habilitarla; la interfaz incluida permite cambiar la contraseña con sesión iniciada.

## 3. Crea los archivos de configuración

En Mac/Linux:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

En Windows puedes duplicar los archivos desde el explorador y cambiarles el nombre a `.env`.

Edita ambos archivos y reemplaza los marcadores `PROJECT`, `POOLER_HOST` y `REPLACE_...`. Mantén los `.env` privados y fuera de Git.

Para trabajar localmente, los puertos previstos son:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4001`

`VITE_API_URL` termina en `/api`. `FRONTEND_ORIGINS` contiene orígenes exactos, separados por coma, sin `/` al final. `APP_TIMEZONE` y `VITE_TIMEZONE` deben coincidir; los ejemplos usan `America/Guatemala`.

## 4. Aplica el esquema y crea el primer administrador

```bash
pnpm db:migrate
pnpm admin:create
```

El segundo comando solicita correo, nombre y contraseña inicial; la contraseña se captura oculta. Usa un correo que todavía no esté registrado en ese proyecto. Las siguientes cuentas se crean desde **Puntos y equipo**.

También puedes usar `pnpm configurar`, que comprueba primero la conexión, solicita de forma oculta la contraseña PostgreSQL si falta o fue rechazada, aplica las migraciones y crea la cuenta. `ADMIN_EMAIL`, `ADMIN_DISPLAY_NAME` y `ADMIN_PASSWORD` permiten proporcionar el administrador mediante el `.env`. Las variables de administrador solo se consumen en estos comandos, nunca en el frontend. Para cargar el certificado desde un archivo usa `DATABASE_SSL_CA_FILE`, con una ruta relativa a `backend`; `DATABASE_SSL_CA` tiene prioridad si contiene un PEM.

El comando de migración es transaccional y registra qué archivos ya aplicó. Las migraciones aplicadas no deben editarse: crea otra migración para cambios futuros. También puedes ejecutar los SQL en orden desde Supabase SQL Editor, pero elige **una sola vía**; el editor manual no registra el historial del comando.

La migración agrega `public.delivery_events` a la publicación `supabase_realtime` cuando existe. En Supabase, verifica que Realtime esté habilitado y que esa tabla figure en la publicación. Los datos personales se guardan en el esquema privado `app`, que **no debes añadir a los esquemas expuestos por la Data API**.

## 5. Inicia y configura la primera jornada

```bash
pnpm dev
```

1. Abre `http://localhost:5173` e inicia sesión.
2. En **Puntos y equipo**, crea los puntos reales y las cuentas del personal.
3. En **Jornadas**, crea una jornada, escribe el beneficio y selecciónala.
4. Asigna a cada trabajador su punto. Si el administrador también atenderá, asígnalo igualmente.
5. En **Importar padrón**, carga el Excel `.xlsx`.
6. Elige la hoja y la fila de encabezados. Selecciona el DPI y las columnas de nombre en el orden deseado.
7. Revisa los nombres, incidencias y conteos. Confirma la importación.
8. Vuelve a **Jornadas** y activa la jornada.
9. Cada trabajador inicia sesión con su propia cuenta y entra a **Atención**.

El personal NO usa el botón de importación para cada entrega. Solo busca el DPI, verifica el nombre y confirma.

## 6. Prueba antes de atender al público

Con una **jornada de ensayo** y personas de prueba, abre dos navegadores/perfiles distintos, uno por operador. Busca el mismo DPI en ambos. Confirma al mismo tiempo. Debe existir una sola entrega y el otro punto debe mostrar quién la registró. Verifica también pérdida de red, reconexión y exportación.

Para comenzar la jornada real crea una nueva con su padrón correcto. No borres filas de auditoría ni manipules manualmente los registros de entrega.

## Producción

Lee `docs/DESPLIEGUE.md`. Los equipos de atención deben abrir la **misma URL publicada**, no `localhost` en cada computadora. El sistema ya está preparado para un frontend y un backend separados; debes colocar sus direcciones reales en los `.env`.
