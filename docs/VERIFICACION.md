# Verificación del sistema

Esta guía separa las comprobaciones automatizadas de las que deben hacerse en el proyecto Supabase y en la red donde se atenderá al público.

## Comprobaciones automatizadas incluidas

Desde la raíz del proyecto:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit --prod
pnpm format:check
```

La suite de Vitest usa una base PostgreSQL embebida y verifica, entre otros casos:

- 30 confirmaciones concurrentes del mismo DPI: solo una registra la entrega;
- repetición de la misma solicitud mediante `request_id`;
- bloqueo de una entrega ya registrada desde otro punto;
- autorización por jornada y asignación de punto;
- importación de `.xlsx`, encabezados variables, nombres compuestos y columnas adicionales;
- rechazo de identificadores con fórmulas y manejo explícito de filas inválidas;
- instalación desde una base vacía y repetición de migraciones sin duplicarlas;
- creación del perfil administrador y su registro de auditoría;
- ausencia de cuentas nuevas cuando falla PostgreSQL y limpieza de una cuenta recién creada si falla el perfil;
- contraseñas de PostgreSQL con caracteres especiales en la URL de conexión;
- disponibilidad de `admin:repair` desde raíz, frontend y backend, con la misma configuración y propagación de errores;
- selección de archivos del frontend por modo, prioridad de variables de terminal y rechazo de proyectos Supabase distintos.
- reutilización de padrón sin copiar entregas y validación antes de habilitar;
- asignación transaccional de varios empleados y reversión completa ante referencias inválidas;
- cierre individual idempotente, continuidad del resto del equipo y reapertura sin perder duplicados;
- cierre global, autor y timestamp, historial de entregas/cierres y límites de consulta para empleados;
- filtros de sector/edad/recibieron/pendientes y conservación de edades inválidas únicamente en datos originales;
- actualización de un esquema existente y operaciones HTTP con un rol privado sin acceso a `auth.users`, con RLS activo;
- carrera entre cierre de turno y registro de entrega, además de las 30 confirmaciones concurrentes.

En esta revisión pasaron **54 pruebas de Vitest**, **4 recorridos de Playwright**, la comprobación de tipos y la compilación de frontend y backend. Incluyen recuperación del administrador, verificación del perfil activo, restricciones de perfiles, creación con asignación, restablecimiento y revocación de accesos. Esta actualización se comprobó con datos aislados. Su migración todavía debe aplicarse al Supabase de la instalación según EMPEZAR_AQUI.md antes de iniciar el backend nuevo.

La suite de Playwright levanta el frontend y un backend de prueba. Recorre la búsqueda y confirmación simultánea en dos puntos. Crea una jornada, un nuevo punto y asigna dos empleados, importa sector/edad desde columnas variables, habilita, reutiliza el padrón en otra jornada, entrega, cierra un turno y consulta filtros, exportación e historial. Verifica que otro empleado continúe y que el mensaje de DPI no encontrado funcione en móvil sin desbordamiento. El recorrido de accesos crea un operador, inicia sesión, restablece la contraseña, rechaza la anterior, cambia la contraseña desde Mi cuenta, reasigna el punto, bloquea una sesión abierta y reactiva el acceso. El recorrido del login muestra y oculta la contraseña con ratón y teclado, comprueba que el ojo no envíe el formulario ni altere la contraseña, revisa la vista móvil e inicia sesión. Se usa un doble HTTP de Supabase Auth que valida credenciales y una base PostgreSQL embebida: no se valida aquí el servicio remoto de Auth ni el canal Realtime de producción. Los datos son ficticios y no sustituyen una prueba contra el Supabase de producción.

## Prueba de aceptación con Supabase

Después de configurar los `.env` y aplicar las migraciones:

1. Crea una jornada de ensayo, dos puntos y dos cuentas de operador.
2. Asigna cada operador a un punto y carga un padrón pequeño con tres DPIs de prueba.
3. Abre la misma URL en dos perfiles de navegador. Busca el mismo DPI en ambos.
4. Confirma casi al mismo tiempo. Una pantalla debe mostrar **Entrega registrada** y la otra **Ya entregado**, con punto, fecha y responsable.
5. Busca un DPI todavía disponible, corta la red de un navegador y confirma. Debe aparecer una advertencia y no debe crearse una entrega offline.
6. Restablece la red, confirma una entrega y verifica que el otro navegador la reciba por Realtime o al actualizar.
7. Exporta el reporte, abre el `.xlsx` y comprueba que el DPI conserve sus 13 dígitos como texto.
8. Anula una entrega desde una cuenta administradora con motivo. Verifica que la auditoría conserve el actor, la hora y el motivo.
9. Comprueba en el panel de Supabase que `app` no esté incluido en los esquemas expuestos por la Data API y que `public.delivery_events` esté en la publicación `supabase_realtime`.

## Criterio de salida

La instalación está lista para una jornada real cuando pasan las comprobaciones automatizadas, la prueba concurrente y la exportación, y el administrador confirma que las cuentas, puntos, zona horaria, origen permitido y dominio publicados son los definitivos. Cada jornada real debe tener su propio padrón y no se deben reutilizar datos de ensayo.

## Revisión visual de esta versión

Se inspeccionaron capturas de Jornadas, Empleados, Consultas e historial, confirmación de entrega, login y registro móvil. Las capturas se obtienen de la aplicación funcionando con el servidor HTTP y PostgreSQL de pruebas, no de un boceto ni de respuestas API prefabricadas. Los movimientos, nombres y DPIs son ficticios.

El ejecutable `agent-browser` no pudo iniciar su daemon en este entorno después de dos intentos; la verificación visual y funcional se completó con Playwright/Chromium. Las capturas de los recorridos se guardan en `test-results/`, excluido de Git. Un fallo inicial de selectores exactos de etiquetas se corrigió usando el nombre accesible del combobox; no se eliminaron las verificaciones de asignación o filtros.
