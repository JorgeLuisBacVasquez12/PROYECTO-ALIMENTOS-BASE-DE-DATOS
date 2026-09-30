import { createClient } from "@supabase/supabase-js";
import type { Config } from "../config/env.js";
import type { AdminAuth } from "../services/admin-setup.js";
import { SetupError } from "./errors.js";

export function adminAuth(config: Config): AdminAuth {
  const client = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return {
    async create(email, password) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        throw new SetupError(
          "Supabase no pudo crear la cuenta. Revisa la clave secreta del backend y comprueba si el correo ya existe en Authentication > Users. No se modificó ninguna cuenta existente.",
        );
      return data.user.id;
    },
    async remove(id) {
      const { error } = await client.auth.admin.deleteUser(id);
      if (error)
        throw new SetupError(
          "No se pudo retirar la cuenta incompleta de Auth.",
        );
    },
  };
}
