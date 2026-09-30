# Seguridad implementada y configuración de la instalación

## Controles incluidos

- Supabase Auth verifica el token en backend en cada petición. No se confía en un ID de usuario enviado en JSON, en metadatos editables ni en un JWT solo decodificado.
- Los perfiles habilitados y roles se leen de PostgreSQL. No existen usuarios, contraseñas ni roles administrativos predefinidos en producción.
- El DPI se consulta por POST para que no quede en la URL del buscador. Los logs de peticiones no incluyen cuerpo, autorización, cookies ni parámetros de consulta. Los errores SQL no se devuelven al navegador.
- El esquema `app` está fuera de la Data API y sin acceso para `anon`/`authenticated`. Sus funciones de registro y anulación no son ejecutables por esos roles. La API usa una conexión PostgreSQL privada del servidor.
- La tabla pública de Realtime tiene RLS y permiso exclusivamente de lectura para cuentas activas autorizadas. No publica DPI, nombres, tokens ni campos adicionales del Excel.
- SQL parametrizado, esquemas Zod estrictos, listas de valores permitidos, CORS de orígenes exactos, encabezados de Helmet, límites de solicitudes y tamaños de carga.
- El importador limita archivos comprimidos/descomprimidos, celdas, hojas y texto. No ejecuta contenido del archivo. Nombres o DPI con fórmulas requieren convertir a valores antes de importar.
- La exportación produce celdas de texto: una celda que empieza por `=` no se convierte en fórmula.
- Los cambios administrativos y anulaciones dejan auditoría. El operador no puede eliminar ni editar entregas, importar padrones, descargar bases completas ni elegir arbitrariamente otro punto.
- La clave de cada confirmación evita duplicados ante reintentos. La unicidad de PostgreSQL sigue protegiendo aunque se manipule el navegador o dos servidores atiendan al mismo tiempo.
- Tokens de sesión en `sessionStorage`, sin persistencia del padrón ni caché de datos en disco. La caché de consultas se limpia al cerrar sesión. No hay service worker ni cola offline.
- Claves y direcciones se configuran en variables de entorno. Los `.env` no se incluyen en el ZIP ni en Git. El proceso de Vite detecta secret/service-role keys colocadas accidentalmente en la variable pública.
- El backend valida TLS de PostgreSQL. En producción exige conexión SSL y orígenes HTTPS.

## Configuración requerida del administrador

Usa contraseñas individuales, desactiva el registro público de Supabase y limita el acceso a secretos y al panel del proyecto. Una cuenta de operador sin fila activa en `app.profiles` no obtiene acceso aunque logre una sesión de Auth.

Publica mediante HTTPS; configura los encabezados y las reescrituras descritos en DESPLIEGUE.md. Da a cada usuario solo el rol que necesita. Si el equipo se comparte, cada trabajador debe cerrar sesión al terminar.

La cadena PostgreSQL de los ejemplos corresponde al acceso que entrega Supabase en Connect. Guárdala exclusivamente como secreto del backend. Para reducir privilegios operativos, el DBA puede crear un rol de conexión dedicado que tenga USAGE en `app`, SELECT/INSERT/UPDATE en las tablas necesarias, INSERT en auditoría/importaciones/eventos, USAGE de secuencias y EXECUTE en las dos funciones de entrega. Las migraciones y el alta inicial de administradores deben seguir usando una cuenta administrativa separada. No concedas privilegios sobre `auth.users` al rol operativo; el alta ordinaria se realiza con Auth Admin API.

Mantén el esquema `app` fuera de la lista de esquemas expuestos. No elimines el índice `one_active_delivery_per_person`. No desactives RLS ni concedas acceso anónimo a `delivery_events` para resolver errores de Realtime.

## Límites del control

El programa impide registros duplicados para un mismo DPI y jornada. No verifica que el documento sea auténtico, que la persona sea su titular o que no use documentos de terceros. El trabajador debe cotejar el nombre y el documento según el procedimiento municipal. El sistema no decide elegibilidad social: utiliza el padrón que el administrador cargó para esa jornada.

La transacción protege el registro digital, pero no puede deshacer una porción entregada físicamente antes de confirmar. Sigue el orden: buscar, verificar identidad, confirmar, esperar “Entrega registrada”, entregar. Si aparece una respuesta incierta o repetida, verifica el registro antes de dar otra porción.

Una alerta de dependencia corregida o un conjunto de pruebas aprobado no constituye una auditoría exhaustiva ni una garantía absoluta de seguridad. Revisa configuraciones, dependencias, respaldos y accesos durante la operación.
