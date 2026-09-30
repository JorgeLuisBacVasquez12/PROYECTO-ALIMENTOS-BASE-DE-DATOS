# Despliegue

## Backend persistente

Despliega la raíz del workspace en un servidor Node.js o contenedor que pueda conectarse a Supabase por TLS. Un servidor persistente simplifica las vistas previas de importación. Comando de compilación:

```bash
pnpm install --frozen-lockfile
pnpm --filter @mazate/backend build
```

Comando de inicio:

```bash
pnpm --filter @mazate/backend start
```

Configura las variables de `backend/.env.example` en el proveedor. En producción usa `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT` asignado por el proveedor, TLS de base activo y el dominio HTTPS del frontend en `FRONTEND_ORIGINS`. Usa un secreto independiente para cada entorno. El backend incluido es un servidor Fastify con `listen`; no es una función serverless lista para pegar en Vercel.

`TRUST_PROXY_HOPS` debe corresponder a tu infraestructura real: 0 sin proxy, 1 si un único proxy confiable recibe las conexiones. No lo incrementes por comodidad ni expongas directamente la API detrás de una configuración que confía en encabezados del cliente.

Aplica `pnpm db:migrate` como un paso administrativo previo. No ejecutes migraciones desde cada proceso de servidor. Crea el primer administrador una sola vez. Usa un proyecto de prueba separado antes de actualizar producción.

## Frontend estático

Compila desde la raíz con las variables públicas reales:

```bash
pnpm --filter @mazate/frontend build
```

Publica `frontend/dist`. Usa Node.js 24 para construir. En el alojamiento configura una reescritura SPA de rutas como `/reports`, `/import` y `/campaigns` hacia `/index.html`. `frontend/public/_redirects` ofrece la forma usada por Netlify/Cloudflare Pages. Para otros proveedores aplica la reescritura equivalente.

`VITE_API_URL=https://tu-api.example/api` debe apuntar al backend real. Las variables `VITE_*` se fijan durante la compilación: cambiar sus valores requiere reconstruir el frontend. La secret key de Supabase nunca debe ser una variable VITE.

Sirve todo mediante HTTPS. Configura encabezados `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y una CSP ajustada a los dominios reales, por ejemplo:

```text
 default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https: data:; connect-src 'self' https://TU_API https://TU_PROYECTO.supabase.co wss://TU_PROYECTO.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

Reemplaza los marcadores y prueba la política en tu instalación. Los tipos de letra están empaquetados localmente. Si configuras un logo remoto, autoriza solo su dominio de confianza.

## Realtime y operación

Verifica que `public.delivery_events` figure en `supabase_realtime`. No habilites suscripciones directas a tablas con información personal ni añadas `app` a los esquemas públicos. Prueba la actualización con dos cuentas y dos puntos reales antes de abrir la jornada.

Mantén copias de seguridad según las capacidades de tu plan de Supabase y verifica restauraciones. La exportación Excel es un reporte; no sustituye un respaldo de toda la base. Revisa periódicamente el crecimiento de auditoría y eventos. Los eventos antiguos pueden purgarse con una tarea administrativa según la retención aprobada; el historial de entregas no se borra con esa limpieza.

Para acceso desde varios puntos, todos abren la misma URL y utilizan cuentas distintas. `localhost` solo funciona en la computadora donde levantaste el proyecto.
