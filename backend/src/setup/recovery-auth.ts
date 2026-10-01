import { createClient, type User, type AuthError } from "@supabase/supabase-js";
import type { Config } from "../config/env.js";
import type { RecoveryAuth } from "../services/admin-recovery.js";
import { adminAuth } from "./auth.js";
import { SetupError } from "./errors.js";
export function recoveryAuth(config: Config, publicKey: string): RecoveryAuth {
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const privileged = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    options,
  );
  const login = createClient(config.SUPABASE_URL, publicKey, options);
  const ensure = (
    result: { data: { user: User | null }; error: AuthError | null },
    operation: string,
  ) => {
    if (result.error || !result.data.user)
      throw new SetupError(
        `${operation}: ${result.error?.code ?? result.error?.status ?? "sin respuesta"}.`,
      );
    return result.data.user;
  };
  return {
    ...adminAuth(config),
    async find(email) {
      for (let page = 1; ; page++) {
        const { data, error } = await privileged.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error)
          throw new SetupError(
            `No se pudieron consultar las cuentas de Auth: ${error.code ?? error.status}.`,
          );
        const user = data.users.find(
          (user) => user.email?.toLowerCase() === email.toLowerCase(),
        );
        if (user) return { id: user.id, email: user.email };
        if (data.users.length < 1000) return null;
      }
    },
    async read(id) {
      return ensure(
        await privileged.auth.admin.getUserById(id),
        "No se pudo consultar esa cuenta en Supabase",
      );
    },
    async reset(id, password) {
      ensure(
        await privileged.auth.admin.updateUserById(id, {
          password,
          email_confirm: true,
        }),
        "No se pudo actualizar la contraseña",
      );
    },
    async verify(email, password) {
      const user = ensure(
        await login.auth.signInWithPassword({ email, password }),
        "La cuenta se guardó, pero falló la prueba de acceso",
      );
      // Revoke only this temporary verification session, preserving other sessions.
      await login.auth.signOut({ scope: "local" });
      return user.id;
    },
  };
}
