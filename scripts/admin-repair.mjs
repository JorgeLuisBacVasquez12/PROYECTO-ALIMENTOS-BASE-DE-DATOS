import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backend = fileURLToPath(new URL("../backend/", import.meta.url));
const args = process.argv.slice(2).filter((arg) => arg !== "--");

if (args.includes("--help") || args.includes("-h")) {
  console.log("pnpm admin:repair — recuperar y verificar el administrador");
  console.log(
    "Funciona desde la raíz, frontend o backend del mismo repositorio.",
  );
  console.log(`Configuración: ${backend}.env`);
  console.log(
    "Lee ADMIN_EMAIL, ADMIN_DISPLAY_NAME y ADMIN_PASSWORD; solicita los datos que falten.",
  );
  console.log(
    "Las variables de esta terminal tienen prioridad sobre backend/.env.",
  );
  console.log(
    "FRONTEND_MODE selecciona el modo de Vite; usa development por defecto o production si NODE_ENV=production.",
  );
  console.log(
    "Solo muestra ACCESO VERIFICADO después de comprobar el inicio de sesión y el perfil administrador.",
  );
} else if (args.length) {
  console.error("Opción desconocida. Ejecuta pnpm admin:repair --help.");
  process.exitCode = 1;
} else {
  console.log(`Reparación del administrador. Configuración: ${backend}.env`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/scripts/repair-admin.ts"],
    {
      cwd: backend,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.error)
    console.error(
      "No se pudo iniciar la reparación. Ejecuta pnpm install --frozen-lockfile desde la raíz.",
    );
  process.exitCode = result.status ?? 1;
}
