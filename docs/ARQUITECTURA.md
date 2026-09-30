# Arquitectura y regla de integridad

## Flujo

El navegador usa Supabase Auth para obtener una sesión. En cada petición el backend valida el token contra Supabase Auth y consulta un perfil activo en PostgreSQL. El rol, punto y nombre de quien registra no se aceptan del navegador: se resuelven en el servidor y en SQL.

El operador ve solo las jornadas asignadas. Puede buscar por DPI exacto y ver el punto/responsable de una entrega duplicada. La lista completa, los datos adicionales, importaciones, exportaciones, anulaciones y administración se reservan al administrador.

La base contiene perfiles, puntos, jornadas, asignaciones, personas, padrón por jornada, entregas, importaciones y auditoría. `people.dpi` es único y se almacena como texto. El nombre y columnas de la importación se conservan por jornada para evitar que una importación futura reescriba reportes pasados. Las entregas conservan también el nombre de persona, punto y operador al momento de registrarlas.

## Dos confirmaciones simultáneas

1. Cada operador puede haber obtenido una consulta “Disponible”. Esa respuesta no reserva ni autoriza la entrega.
2. `app.register_delivery` valida usuario activo, jornada activa, asignación, punto y pertenencia al padrón.
3. Bloquea la fila de esa persona en el padrón mediante `FOR UPDATE`. Los demás DPI pueden avanzar independientemente.
4. Busca una entrega vigente y, si no hay ninguna, la inserta dentro de la misma transacción.
5. El índice único parcial `(campaign_id, person_id) WHERE voided_at IS NULL` impide una segunda entrega global; **no incluye el punto**.
6. Crea auditoría y evento de actualización en esa misma transacción.
7. La otra operación espera, ve el registro confirmado y devuelve `already_delivered` con el mismo comprobante.

El registro de entrega, auditoría y evento se confirman juntos. La aplicación muestra éxito solo después de que PostgreSQL confirmó la operación. Un doble clic o un reintento usa `request_id`, único por operador. Si la respuesta se pierde, reintentar verifica el registro sin duplicarlo. Una respuesta `replayed` se presenta como advertencia para verificar la entrega física.

`public.delivery_events` solo contiene identificadores de jornada, tipo de evento y hora; no incluye DPI, nombre ni datos extra. Realtime usa RLS para filtrar qué cuentas pueden recibirlos. La UI invalida las consultas pertinentes y vuelve a obtener sus datos autorizados por la API. Existe refresco periódico y al recuperar foco/conexión. **Realtime no es la garantía de exclusión; el índice y la transacción lo son.** Hay latencia de red; no se promete cero milisegundos.

## Importación variable

Se acepta `.xlsx`, no `.xls`, `.xlsm` ni hojas cifradas. Excel puede convertir `.xls` a `.xlsx`. El importador no asume nombres ni posiciones de columnas. La fila de encabezados puede elegirse entre las primeras 100. Las columnas de nombres se concatenan en el orden seleccionado, conservando tildes y mayúsculas/minúsculas.

Los encabezados vacíos o repetidos reciben claves con el número de columna. Todos los campos se conservan como texto en `extra`. Los DPI y nombres basados en fórmulas se rechazan para no depender de resultados de cálculo desactualizados. Las demás fórmulas solo aportan su resultado almacenado; no se ejecutan macros, fórmulas ni enlaces. Las exportaciones escriben texto, no fórmulas.

El DPI se normaliza eliminando espacios y guiones; se requieren 13 dígitos ASCII. Esto **valida el formato, no consulta RENAP ni acredita identidad**. No se completan dígitos faltantes. Si ya se perdieron ceros en el archivo, se corrige la fuente antes de importar.

El archivo se analiza en memoria y la vista previa queda asociada al usuario y a una revisión específica. Vence después del tiempo configurado o cuando se reinicia el proceso. No se confían filas editadas por el cliente. El commit vuelve a validar permisos y estado, bloquea la jornada, importa lotes dentro de una sola transacción y conserva un resultado idempotente.

Se hace un upsert del padrón en borrador: se actualizan los DPI coincidentes, se añaden los nuevos y se conservan los ausentes. No se elimina historial. Las importaciones a jornadas activas/cerradas se rechazan.

## Límites

Los `.env.example` describen límites configurables de archivo, filas, columnas, exportación y conexiones. Hay límites defensivos adicionales: 80 MiB descomprimidos, 3,000 entradas ZIP, 20 hojas, 500,000 celdas por hoja, 2,000 caracteres por celda, 300 por nombre y un presupuesto estimado de 128 MiB para vistas previas. Divide un archivo muy amplio en partes; todas se pueden importar en la misma jornada en borrador.

La administración de importaciones usa memoria del proceso: despliega una instancia de backend o configura afinidad de sesión si replicas el servicio. La regla de exclusión de entregas permanece correcta con varias instancias porque reside en PostgreSQL. Si se pierde una vista previa, se vuelve a cargar el archivo.
