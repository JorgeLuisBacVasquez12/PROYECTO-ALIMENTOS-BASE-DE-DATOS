# Control de entregas · Municipalidad de Mazatenango

Aplicación web para consultar beneficiarios por DPI, registrar una sola entrega por persona y jornada, y conocer el punto, fecha y responsable. Frontend React + TypeScript separado del backend Fastify + TypeScript. PostgreSQL y autenticación en Supabase. Gestor de paquetes: **pnpm**.

Para actualizar esta versión y conocer el flujo de jornadas, empieza por **[EMPEZAR_AQUI.md](EMPEZAR_AQUI.md)**. La guía general es **[INICIO_RAPIDO.md](INICIO_RAPIDO.md)**.

## Lo que incluye

- Login individual, roles administrador/operador y asignación de punto por jornada.
- Creación de accesos con asignación inmediata, restablecimiento de contraseñas y activación/desactivación desde Empleados.
- Recuperación del administrador con `pnpm admin:repair` y verificación del inicio de sesión.
- Consulta exacta por DPI de 13 dígitos. Buscar no registra una entrega.
- Confirmación explícita, validación en servidor e índice único global por jornada/persona.
- Reintentos con identificador de solicitud: la misma petición nunca crea otra entrega.
- Realtime para refrescar pantallas. La restricción de la base protege incluso si el evento llega tarde.
- Importación de `.xlsx`: elección de hoja, fila de encabezados, columna DPI y una o varias columnas de nombre, en el orden elegido.
- Columnas adicionales conservadas en JSONB y exportadas como columnas del reporte.
- Vista previa de incidencias. Las filas duplicadas dentro del archivo se excluyen todas; las inválidas solo se omiten con confirmación explícita.
- Jornadas independientes. Recibir en una no bloquea a la persona para jornadas futuras.
- Consultas por nombre/DPI, sector, edad del padrón, recibieron/no recibieron, punto, empleado y fechas.
- Historial de entregas, anulaciones y cierres con responsable, punto y fecha/hora.
- Asignación de varios empleados por jornada y punto; cierre individual y cierre global por el administrador.
- Reutilización del padrón en otra jornada sin arrastrar entregas.
- Excel exportado con filtros, encabezado fijo y DPI guardados como texto.
- Anulación por administrador, con motivo obligatorio y registro de auditoría.
- Diseño responsive en verde bosque, crema y tonos cálidos; menú administrativo de tres secciones y pantalla de DPI para empleados.
- Textos centralizados en i18next (español); zona horaria y marca configurables.

## Estructura

```text
frontend/             React, Vite, componentes pequeños, hooks y traducciones
backend/              API, servicios, importador y scripts administrativos
packages/contracts/  Tipos y validaciones compartidos
database/migrations/ SQL versionado: esquema, permisos y operaciones atómicas
tests/               Pruebas de HTTP + SQL y recorridos de navegador
docs/                Arquitectura, operación, seguridad y verificación
```

## Comandos desde la raíz

```bash
pnpm install --frozen-lockfile
pnpm configurar
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm dev` levanta frontend y backend. Requiere configurar los dos `.env` y aplicar las migraciones. Las pruebas se ejecutan con datos ficticios aislados, sin tocar Supabase. No hay modo demo ni puerta trasera en el servidor de producción.

Los componentes visuales, acceso a API, sesión, importación y búsqueda están separados. En React la lógica reutilizable se implementa con **hooks**, el equivalente práctico a los composables de Vue.

## Decisiones de operación

**Excel es entrada y salida. Supabase es la fuente central de operación.** No se sincronizan archivos Excel separados entre puestos. Importar un nuevo Excel no borra entregas ni elimina del padrón personas ausentes del archivo.

Las importaciones se permiten solo en jornadas en borrador. Una vez activa, el padrón queda protegido frente a importaciones. Para otra distribución crea otra jornada. Las jornadas pueden durar más de un día: el bloqueo se basa en su ID, no en la fecha del reloj.

Se requiere conexión al servidor para confirmar entregas. Las pantallas no autorizan entregas offline ni las dejan en una cola local. “Disponible” es una consulta; solo **“Entrega registrada”** después de confirmar autoriza la entrega física.

El repositorio incluye ejemplos de configuración y el certificado raíz público de Supabase. Las credenciales se guardan en tus `.env`, excluidos de Git. No contiene padrón municipal real ni personas precargadas. El diseño utiliza un símbolo de apoyo comunitario. Puedes definir el logotipo autorizado mediante `VITE_LOGO_URL`.

## Alcance de la comprobación

Consulta **[docs/VERIFICACION.md](docs/VERIFICACION.md)**. La compilación y pruebas locales no sustituyen la prueba de conexión, autenticación y Realtime con las credenciales del proyecto Supabase donde se instalará. No se afirma que un software esté libre de todos los errores.
