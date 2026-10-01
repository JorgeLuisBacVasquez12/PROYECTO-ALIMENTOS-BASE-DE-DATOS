# API

Todas las rutas `/api` requieren `Authorization: Bearer <access_token>` emitido por Supabase. Nunca envíes la service-role key como token de operador. Las respuestas no son cacheables.

| Método y ruta                        | Rol                         | Uso                                                              |
| ------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| GET `/health`                        | Público                     | Estado mínimo de conexión PostgreSQL                             |
| GET `/api/bootstrap`                 | Personal activo             | Perfil, jornadas permitidas y puntos administrativos             |
| POST `/api/lookup`                   | Personal asignado/admin     | `{campaignId,dpi}`; no modifica entregas                         |
| POST `/api/deliveries`               | Personal con punto asignado | `{campaignId,dpi,requestId}`                                     |
| POST `/api/deliveries/:id/void`      | Admin                       | `{reason}`; conserva el registro y permite nueva entrega         |
| GET `/api/campaigns/:id/activity`    | Personal asignado/admin     | Últimas 8 propias; admin ve las últimas globales                 |
| GET `/api/campaigns/:id/stats`       | Personal asignado/admin     | Elegibles, entregados y pendientes                               |
| GET `/api/campaigns/:id/report`      | Admin                       | Paginación y filtros                                             |
| GET `/api/campaigns/:id/export`      | Admin                       | Mismos filtros, archivo `.xlsx`                                  |
| POST `/api/imports/upload`           | Admin                       | Multipart de un `.xlsx`, campo `file`                            |
| POST `/api/imports/:id/preview`      | Admin dueño de la carga     | Mapeo de columnas y jornada en borrador                          |
| GET `/api/imports/:id/issues`        | Admin dueño de la carga     | Incidencias completas en JSON                                    |
| POST `/api/imports/:id/commit`       | Admin dueño de la carga     | `{planId,skipInvalid}`                                           |
| POST `/api/campaigns`                | Admin                       | `{name,benefit,rosterSourceId?}`                                 |
| PATCH `/api/campaigns/:id/status`    | Admin                       | `{status:active/closed}`                                         |
| GET `/api/campaigns/:id/assignments` | Admin                       | Personal y puntos                                                |
| PUT `/api/campaigns/:id/assignments` | Admin                       | `{userId,pointId}` o `{assignments:[{userId,pointId}]}`          |
| GET/POST `/api/users`                | Admin                       | Listar/crear cuentas                                             |
| PATCH `/api/users/:id`               | Admin                       | `{active:boolean}`                                               |
| POST `/api/users/:id/password`       | Admin                       | `{password}`; restablece otra cuenta activa y registra auditoría |
| POST `/api/points`                   | Admin                       | `{name}`                                                         |
| GET `/api/audit?page=1`              | Admin                       | Auditoría paginada, 50 por página                                |

## Confirmación

- HTTP 201: `outcome=registered` y comprobante confirmado.
- HTTP 200: `outcome=replayed`, mismo comprobante de la misma solicitud.
- HTTP 409: `outcome=already_delivered`, comprobante del registro existente.
- Otros errores: `{code,requestId}`; el frontend traduce `code` al español.

No cambies `requestId` al reintentar una respuesta incierta. La API obtiene el punto y operador de la sesión/asignación, no del cuerpo. No hay endpoint de “marcar entregado” que eluda esa transacción.

## Mapeo

`{campaignId,sheet,headerRow,dpiColumn,nameColumns,sectorColumn?,ageColumn?}`. `headerRow` es 1-based; columnas 0-based. `nameColumns` permite hasta ocho columnas, en el orden de concatenación. El ID de vista previa y su revisión (`planId`) se devuelven desde el servidor y deben acompañar el commit.

## Filtros

`q`, `status=all|delivered|pending`, `pointId`, `operatorId`, `sector`, `ageMin`, `ageMax`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `page` y `pageSize` (máximo 100). Los rangos de días usan la zona horaria del backend y el límite superior incluye todo el día final. Los filtros se combinan con AND.

## Gestión de accesos

`POST /api/users`: `{email,displayName,role,password,assignment?}`. El rol de alta es `operator`; el administrador inicial se prepara con los scripts de instalación. La asignación opcional contiene `{campaignId,pointId}`. La transacción guarda perfil y asignación; si falla, se intenta eliminar únicamente la cuenta Auth recién creada. El correo se recorta y normaliza a minúsculas.

`GET /api/users` devuelve nombre, correo, rol, estado y las asignaciones a jornadas no cerradas. Solo lo puede consultar un administrador activo.

`POST /api/users/:id/password` acepta entre 12 y 128 caracteres. Rechaza la propia cuenta (usar Mi cuenta), cuentas inexistentes o desactivadas y solicitudes de operadores. No incluye contraseñas en respuestas ni auditoría.

`PATCH /api/users/:id` conserva historial y asignaciones. Cada solicitud a la API verifica el estado del perfil, de modo que un token previamente emitido no permite operar tras desactivar la cuenta. La interfaz detecta el bloqueo en su siguiente consulta o actualización periódica.

La actualización de contraseñas en Supabase Auth y la confirmación de la transacción PostgreSQL son operaciones de dos servicios. Un fallo excepcional de conexión al confirmar puede dejar la contraseña cambiada sin confirmación en pantalla; en ese caso, vuelve a restablecerla y comprueba el acceso.

## Jornadas y cierres

`POST /api/campaigns/:id/shift/close`: cierra el turno del usuario autenticado; nunca toma el usuario del cuerpo. Es idempotente y guarda hora, punto y responsable. Una jornada debe estar activa. Tras cerrar, el empleado no puede consultar ni registrar nuevas entregas en ella.

`PUT /api/campaigns/:id/assignments` acepta una asignación o un lote de hasta 100 usuarios distintos; todo el lote es transaccional. Asignar de nuevo limpia el cierre actual, conserva auditoría y reabre ese turno. Las referencias deben ser activas y la jornada no puede estar cerrada.

`PATCH /api/campaigns/:id/status` requiere padrón y personal activo para habilitar. Finalizar cierra todos los turnos abiertos. Reabrir una jornada cerrada reabre sus turnos; no reinicia las entregas. Un cambio al estado actual es idempotente.

`GET /api/campaigns/:id/report-options`: sectores disponibles del padrón; solo admin.

`GET /api/history`: solo admin. Filtros `campaignId`, `kind=all|delivery|closure`, `q` (DPI/persona/responsable), `from`, `to`, `page`. Responde `{rows,total,page,pageSize:25}`. Incluye `delivery.register`, `delivery.void`, `shift.close` y `campaign.status` de cierre; nunca devuelve contraseñas.

`GET /api/bootstrap` añade conteos por jornada y cierre propio/global. `GET /api/campaigns/:id/assignments` añade entregas por empleado, `assigned_at`, `closed_at` y `closed_by_name`.
