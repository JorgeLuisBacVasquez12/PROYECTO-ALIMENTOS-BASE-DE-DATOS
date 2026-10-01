# Jornadas, empleados y consultas

Esta versión organiza la administración en tres secciones: **Jornadas**, **Consultas e historial** y **Empleados**. El empleado entra directamente a consultar DPI y registrar entregas en sus jornadas asignadas.

## Actualizar una instalación existente

Conserva `backend/.env` y `frontend/.env`. Detén ambos servidores con Ctrl+C y ejecuta desde tu copia del repositorio:

```bash
cd "$(git rev-parse --show-toplevel)" &&
git fetch origin &&
git switch feat/jornadas-admin-operacion &&
git pull --ff-only origin feat/jornadas-admin-operacion &&
pnpm install --frozen-lockfile
```

**Antes de iniciar el backend nuevo, aplica la migración de esta versión.** Agrega los campos de jornada, cierre, sector y edad sin borrar padrones ni entregas. El usuario privado de conexión del backend no administra el esquema.

Si el proyecto existente fue preparado desde el panel de Supabase, abre **SQL Editor** en ese proyecto y ejecuta el contenido completo de [20260930215449_jornadas_operacion.sql](database/migrations/20260930215449_jornadas_operacion.sql) una sola vez, con el rol propietario `postgres`. No vuelvas a ejecutar `001_schema.sql` ni `002_delivery.sql` en una base ya instalada. Este paso se realiza en el panel y no pide la contraseña de PostgreSQL en la terminal.

Si tu instalación ya lleva el registro `app.schema_migrations`, utiliza `pnpm db:migrate` con la conexión del propietario para mantener ese registro al día. No uses el usuario operativo `mazate_app_*` para ejecutar migraciones. Una instalación nueva puede seguir [INICIO_RAPIDO.md](INICIO_RAPIDO.md).

La migración incluye políticas RLS y permisos para los roles privados `mazate_app_*` que tengan el marcador `mazate-local-recovery:*`. Los demás roles personalizados requieren que el DBA les configure esos permisos. `anon` y `authenticated` continúan sin acceso al esquema privado.

Después de aplicar la migración:

```bash
pnpm dev
```

Abre http://127.0.0.1:5173 e inicia sesión con tu cuenta existente. No hace falta volver a crear ni reparar el administrador si ya puedes entrar. La actualización del repositorio no aplica automáticamente cambios en Supabase.

## Preparar una jornada

1. En **Empleados → Nuevo empleado**, escribe nombre, correo y contraseña de al menos 12 caracteres. Puedes asignar jornada/punto ahora o después. El acceso creado siempre es de empleado.
2. En **Jornadas → Nueva jornada**, indica un nombre y el alimento, por ejemplo «Entrega de pollo · Octubre» / «Pollo».
3. Elige **Cargaré el Excel después** o reutiliza el padrón de otra jornada. Reutilizar personas nunca copia sus entregas.
4. Desde el detalle, usa **Cargar Excel**. Selecciona hoja, encabezado, DPI y nombres en el orden correcto. Sector y edad son opcionales. Revisa las incidencias antes de confirmar.
5. Pulsa **Asignar empleados**, elige un punto y marca las personas que atenderán allí. El botón junto al selector permite crear un punto. Repite para otros puntos.
6. Pulsa **Habilitar jornada** y confirma. Se requiere padrón y al menos una asignación a una cuenta y punto activos.

Puedes preparar varias jornadas y asignar al mismo empleado a más de una. Una jornada en preparación aparece al empleado como pendiente de habilitar, sin buscador ni entregas.

## Atender desde un punto

1. El empleado inicia sesión y elige una de sus jornadas habilitadas.
2. Escribe el DPI de 13 dígitos y pulsa **Consultar DPI**.
3. Si la persona aparece disponible, pulsa **Marcar como entregado**, coteja nombre y documento y confirma.
4. Espera **Entrega registrada con éxito** antes de entregar físicamente el alimento.

Si el DPI no está en el padrón de esa jornada, se muestra **No encontramos este DPI**. Si ya recibió, aparece el punto, el responsable y la fecha/hora de la entrega anterior. El servidor protege todos los puntos a la vez: dos confirmaciones simultáneas no generan dos entregas.

**La regla depende de la jornada, no del nombre del alimento ni del día.** Otro punto de la misma jornada de pollo no puede volver a entregar. Una jornada diferente de pizza, chocolate o incluso otra entrega de pollo sí permite un registro propio.

## Cierres y seguimiento

- **Empleado → Cerrar jornada:** cierra únicamente su turno en la jornada seleccionada. Guarda quién, dónde y cuándo; los demás siguen atendiendo.
- **Administrador → Finalizar jornada:** cierra la jornada completa y sus turnos abiertos.
- **Administrador → Asignar empleados:** una nueva asignación del mismo empleado reabre su turno y puede cambiar su punto. El historial previo se conserva.
- **Administrador → Reabrir jornada:** reabre los turnos asignados. Conserva las entregas anteriores y el bloqueo de duplicados.

**Consultas e historial → Personas y entregas** permite filtrar por sector, edad, estado, empleado, punto y fechas y exportar Excel. **Historial de movimientos** muestra entregas, anulaciones y cierres, incluso de jornadas finalizadas. Una anulación exige motivo y conserva el registro original.

Las edades son las que trae el Excel, no edades calculadas automáticamente. Los valores ausentes o inválidos se muestran como «Sin dato». Las columnas originales se conservan y aparecen en la exportación. Todavía no hay un padrón municipal precargado: lo cargas cuando te entreguen el archivo.

## Accesos existentes

En **Empleados**, **Contraseña** restablece la contraseña de una cuenta activa y **Desactivar** bloquea nuevas solicitudes incluso con sesión abierta. El historial permanece. Las contraseñas no aparecen en el historial ni se guardan en Git.

Solo si vuelve a fallar el acceso del administrador, usa `pnpm admin:repair --help`. La reparación lee `ADMIN_EMAIL`, `ADMIN_DISPLAY_NAME` y `ADMIN_PASSWORD` de `backend/.env`; funciona desde raíz, frontend o backend. La contraseña del programa y la de PostgreSQL son distintas. No es un paso necesario para actualizar el diseño.
