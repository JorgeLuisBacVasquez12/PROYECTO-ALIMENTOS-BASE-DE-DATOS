# API

Todas las rutas `/api` requieren `Authorization: Bearer <access_token>` emitido por Supabase. Nunca envíes la service-role key como token de operador. Las respuestas no son cacheables.

| Método y ruta                        | Rol                         | Uso                                                      |
| ------------------------------------ | --------------------------- | -------------------------------------------------------- |
| GET `/health`                        | Público                     | Estado mínimo de conexión PostgreSQL                     |
| GET `/api/bootstrap`                 | Personal activo             | Perfil, jornadas permitidas y puntos administrativos     |
| POST `/api/lookup`                   | Personal asignado/admin     | `{campaignId,dpi}`; no modifica entregas                 |
| POST `/api/deliveries`               | Personal con punto asignado | `{campaignId,dpi,requestId}`                             |
| POST `/api/deliveries/:id/void`      | Admin                       | `{reason}`; conserva el registro y permite nueva entrega |
| GET `/api/campaigns/:id/activity`    | Personal asignado/admin     | Últimas 8 propias; admin ve las últimas globales         |
| GET `/api/campaigns/:id/stats`       | Personal asignado/admin     | Elegibles, entregados y pendientes                       |
| GET `/api/campaigns/:id/report`      | Admin                       | Paginación y filtros                                     |
| GET `/api/campaigns/:id/export`      | Admin                       | Mismos filtros, archivo `.xlsx`                          |
| POST `/api/imports/upload`           | Admin                       | Multipart de un `.xlsx`, campo `file`                    |
| POST `/api/imports/:id/preview`      | Admin dueño de la carga     | Mapeo de columnas y jornada en borrador                  |
| GET `/api/imports/:id/issues`        | Admin dueño de la carga     | Incidencias completas en JSON                            |
| POST `/api/imports/:id/commit`       | Admin dueño de la carga     | `{planId,skipInvalid}`                                   |
| POST `/api/campaigns`                | Admin                       | `{name,benefit}`                                         |
| PATCH `/api/campaigns/:id/status`    | Admin                       | `{status:active/closed}`                                 |
| GET `/api/campaigns/:id/assignments` | Admin                       | Personal y puntos                                        |
| PUT `/api/campaigns/:id/assignments` | Admin                       | `{userId,pointId}`                                       |
| GET/POST `/api/users`                | Admin                       | Listar/crear cuentas                                     |
| PATCH `/api/users/:id`               | Admin                       | `{active:boolean}`                                       |
| POST `/api/points`                   | Admin                       | `{name}`                                                 |
| GET `/api/audit?page=1`              | Admin                       | Auditoría paginada, 50 por página                        |

## Confirmación

- HTTP 201: `outcome=registered` y comprobante confirmado.
- HTTP 200: `outcome=replayed`, mismo comprobante de la misma solicitud.
- HTTP 409: `outcome=already_delivered`, comprobante del registro existente.
- Otros errores: `{code,requestId}`; el frontend traduce `code` al español.

No cambies `requestId` al reintentar una respuesta incierta. La API obtiene el punto y operador de la sesión/asignación, no del cuerpo. No hay endpoint de “marcar entregado” que eluda esa transacción.

## Mapeo

`{campaignId,sheet,headerRow,dpiColumn,nameColumns}`. `headerRow` es 1-based; columnas 0-based. `nameColumns` permite hasta ocho columnas, en el orden de concatenación. El ID de vista previa y su revisión (`planId`) se devuelven desde el servidor y deben acompañar el commit.

## Filtros

`q`, `status=all|delivered|pending`, `pointId`, `operatorId`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `page` y `pageSize` (máximo 100). Los rangos de días usan la zona horaria del backend y el límite superior incluye todo el día final. Los filtros se combinan con AND.
