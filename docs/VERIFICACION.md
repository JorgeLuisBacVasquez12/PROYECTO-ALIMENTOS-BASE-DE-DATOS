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

- dos confirmaciones concurrentes del mismo DPI: solo una registra la entrega;
- repetición de la misma solicitud mediante `request_id`;
- bloqueo de una entrega ya registrada desde otro punto;
- autorización por jornada y asignación de punto;
- importación de `.xlsx`, encabezados variables, nombres compuestos y columnas adicionales;
- rechazo de identificadores con fórmulas y manejo explícito de filas inválidas;
- instalación desde una base vacía y repetición de migraciones sin duplicarlas;
- creación del perfil administrador y su registro de auditoría;
- ausencia de cuentas nuevas cuando falla PostgreSQL y limpieza de una cuenta recién creada si falla el perfil;
- contraseñas de PostgreSQL con caracteres especiales en la URL de conexión.

En esta revisión de la configuración pasaron las 17 pruebas de Vitest, la comprobación de tipos y la compilación de frontend y backend. La creación remota en Supabase queda pendiente de una contraseña PostgreSQL válida, que se solicita al ejecutar `pnpm configurar`.

La suite de Playwright levanta el frontend y un backend de prueba. Recorre la búsqueda en dos puntos, la importación administrativa y una comprobación responsive para móvil. Los datos son ficticios y no sustituyen una prueba contra el Supabase de producción.

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
