import type { Database } from "../db/database.js";
import { userSchema } from "@mazate/contracts";
import { SetupError } from "../setup/errors.js";

export interface AdminAuth {
  create(email: string, password: string): Promise<string>;
  remove(id: string): Promise<void>;
}

export async function createAdministrator(
  db: Database,
  auth: AdminAuth,
  input: unknown,
) {
  const body = userSchema.parse(input);
  // Validate the connection and schema BEFORE creating an account in Auth.
  await db.query("select id from app.profiles limit 0");
  const id = await auth.create(body.email, body.password);
  try {
    await db.transaction(async (tx) => {
      await tx.query(
        "insert into app.profiles(id,display_name,role,email) values($1,$2,'admin',$3)",
        [id, body.displayName, body.email],
      );
      await tx.query(
        "insert into app.audit_log(actor_id,action,entity_id) values($1,'admin.bootstrap',$1)",
        [id],
      );
    });
  } catch (error) {
    try {
      await auth.remove(id);
    } catch {
      throw new SetupError(
        "No se guardó el perfil y no se pudo retirar la cuenta incompleta de Auth. Revisa ese correo en Authentication > Users antes de repetir la creación.",
      );
    }
    throw error;
  }
  return { id, email: body.email };
}
