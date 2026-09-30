# Iniciar esta copia configurada

Esta copia incluye `frontend/.env`, `backend/.env` y el certificado que proporcionaste. Las claves y el administrador están en archivos de configuración; el código reutilizable no contiene credenciales.

El correo inicial configurado es **juniorbacb@gmail.com**. Se interpretó `.comn` como un error de escritura. La contraseña inicial indicada por el solicitante está en `ADMIN_PASSWORD` e incluye el punto final. Puedes cambiar estos valores en `backend/.env` antes de configurar.

## Tres comandos

Descomprime este ZIP en una carpeta nueva. Abre una terminal en esa carpeta, donde están `frontend`, `backend` y `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm configurar
pnpm dev
```

Ejecuta cada comando cuando el anterior termine correctamente. `pnpm configurar` pide únicamente la **contraseña de PostgreSQL de tu proyecto Supabase**, porque no fue suministrada. La captura es oculta. Guarda la conexión válida, aplica las migraciones y crea el administrador con los datos de `backend/.env`. Después abre http://localhost:5173 .

La contraseña de PostgreSQL es la que elegiste al crear el proyecto Supabase. Si no la recuerdas, abre Database Settings en ese proyecto y usa Reset database password. Después ingresa la nueva contraseña cuando `pnpm configurar` la solicite. El programa codifica automáticamente los caracteres especiales para la URI. Cambiar la contraseña del administrador en esta copia no cambia la contraseña de PostgreSQL.

El comando verifica PostgreSQL antes de crear una cuenta en Auth. Si falla esa conexión, no crea el administrador y muestra una explicación en español. Cuando el administrador ya existe y está activo, el comando conserva su contraseña actual y lo indica. No convierte perfiles de operador en administradores.

## Si ya tenías la versión anterior

Detén sus terminales con Ctrl+C antes de iniciar esta copia. Los datos permanecen en el mismo proyecto Supabase; las migraciones ya registradas no se vuelven a aplicar. Esta copia no contiene datos municipales de prueba. El asistente no se ha conectado a tu base de datos ni ha creado la cuenta por ti: la operación se realiza al ejecutar `pnpm configurar` con una contraseña PostgreSQL válida.

Este ZIP incluye configuración privada de tu proyecto. Los `.env` están excluidos de Git. Conserva el ZIP como archivo privado y actualiza las claves del `.env` cuando las cambies en Supabase.

Para la administración cotidiana, consulta `INICIO_RAPIDO.md`.
