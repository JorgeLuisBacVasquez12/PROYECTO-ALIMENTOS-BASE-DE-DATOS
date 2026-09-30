# Actualizar y recuperar el administrador

Esta rama corrige el acceso inicial y completa la administración de usuarios. Conserva tus archivos `backend/.env` y `frontend/.env`: Git no los incluye ni los reemplaza.

## Si ya tienes el repositorio en tu Mac

Detén frontend y backend con Ctrl+C. Desde `frontend`, `backend` o la raíz de **la misma copia del repositorio**, ejecuta este bloque. Primero te sitúa en la raíz; cada paso se ejecuta únicamente si el anterior terminó bien:

```bash
cd "$(git rev-parse --show-toplevel)" &&
git fetch origin &&
git switch fix/admin-accesos &&
git pull --ff-only origin fix/admin-accesos &&
pnpm install --frozen-lockfile &&
pnpm admin:repair &&
pnpm dev
```

`git switch fix/admin-accesos` usa la rama existente o la crea a partir de `origin/fix/admin-accesos`. Si Git avisa de cambios locales, consérvalos antes de cambiar de rama; no uses `reset --hard` para saltar ese aviso. Un `git pull` estando en `main` no incorpora un PR todavía abierto.

`pnpm admin:repair` funciona desde la raíz, `frontend` y `backend`. Siempre usa `backend/.env` de esa copia y muestra su ruta. Lee `ADMIN_EMAIL`, `ADMIN_DISPLAY_NAME` y `ADMIN_PASSWORD`; pide los datos que falten. Las variables de la terminal tienen prioridad sobre el archivo. Ajusta esos valores al correo y la contraseña con los que quieres entrar. Puedes comprobar que tienes la versión corregida con `pnpm admin:repair --help`.

Si PostgreSQL rechaza su conexión, solicita por separado la contraseña de la base de datos, con entrada oculta.

El comando crea el administrador si no existe, recupera un perfil faltante o restablece la contraseña del administrador activo indicado. Comprueba que frontend y backend apunten al mismo proyecto, prueba el inicio de sesión con la clave pública del frontend y confirma que exista un perfil administrador activo. Solo entonces muestra **ACCESO VERIFICADO**. No transforma operadores en administradores ni reactiva cuentas deshabilitadas.

`pnpm dev` desde la raíz inicia frontend y backend juntos. Abre http://127.0.0.1:5173 e inicia sesión con esos datos. El botón del ojo permite mostrar u ocultar la contraseña sin enviar el formulario. La contraseña de PostgreSQL conecta con la base de datos; la contraseña del administrador sirve para entrar al programa.

Para una instalación de producción, usa `FRONTEND_MODE=production pnpm admin:repair`. Ese modo lee también `frontend/.env.production` y `frontend/.env.production.local`, en lugar de los archivos de desarrollo. Si `NODE_ENV=production`, el modo predeterminado ya es `production`. Para un frontend compilado con `vite build --mode staging`, usa `FRONTEND_MODE=staging`. Esto también se aplica a `pnpm configurar`.

Si todavía utilizas el ZIP anterior sin Git, descarga esta rama, copia tus dos `.env` a las carpetas correspondientes y ejecuta los tres comandos `pnpm` anteriores en la nueva carpeta. Conserva también cualquier certificado al que apunte `DATABASE_SSL_CA_FILE`.

## Crear los accesos del personal

1. Entra como administrador y abre **Puntos y equipo**.
2. Crea los puntos necesarios, por ejemplo Punto A y Punto B.
3. Pulsa **Crear usuario** y escribe nombre, correo, rol y contraseña de al menos 12 caracteres.
4. Selecciona jornada y punto; también puedes elegir **Asignar después**.
5. Comparte el acceso con la persona. Puede cambiar su contraseña desde **Mi cuenta**, al pulsar su perfil.

La lista muestra correo, rol, estado y asignaciones. **Asignar punto** permite cambiar el punto por jornada; **Restablecer contraseña** cambia la contraseña de otra cuenta activa; **Desactivar** impide nuevas solicitudes a la API, incluso desde una sesión abierta. La pantalla refleja el bloqueo en su siguiente consulta o actualización periódica. **Activar** recupera el acceso conservando historial y asignaciones.

Las jornadas cerradas y los puntos o usuarios desactivados no admiten nuevas asignaciones. Las contraseñas no se guardan en el historial de acciones.

## Instalación desde cero

Sigue [INICIO_RAPIDO.md](INICIO_RAPIDO.md) para completar los dos `.env` con los datos de tu proyecto. Ejecuta `pnpm configurar` para preparar las tablas y comprobar el acceso del administrador. Si ese correo ya existe con otra contraseña, el comando te dirige a `pnpm admin:repair`.
