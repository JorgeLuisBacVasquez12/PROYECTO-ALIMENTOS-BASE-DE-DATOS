import { createInterface } from "node:readline/promises";
import passwordPrompt from "@inquirer/password";
import { userSchema } from "@mazate/contracts";

export async function adminInput() {
  let email = process.env.ADMIN_EMAIL?.trim();
  let displayName = process.env.ADMIN_DISPLAY_NAME?.trim();
  if (!email || !displayName) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      email ||= (await rl.question("Correo del administrador: ")).trim();
      displayName ||= (await rl.question("Nombre completo: ")).trim();
    } finally {
      rl.close();
    }
  }
  const password =
    process.env.ADMIN_PASSWORD ||
    (await passwordPrompt({
      message: "Contraseña para entrar al programa (mínimo 12 caracteres):",
      validate: (value) =>
        (value.length >= 12 && value.length <= 128) ||
        "Usa entre 12 y 128 caracteres.",
    }));
  return userSchema.parse({ email, displayName, password, role: "admin" });
}
