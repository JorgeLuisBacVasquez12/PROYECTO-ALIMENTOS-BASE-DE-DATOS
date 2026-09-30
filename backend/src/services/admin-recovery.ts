import type { Database } from "../db/database.js";
import { userSchema } from "@mazate/contracts";
import { createAdministrator, type AdminAuth } from "./admin-setup.js";
import { SetupError } from "../setup/errors.js";
export interface RecoveryAuth extends AdminAuth {
  read(
    id: string,
  ): Promise<{ id: string; email?: string; banned_until?: string }>;
  reset(id: string, password: string): Promise<void>;
  verify(email: string, password: string): Promise<string>;
}
export async function repairAdministrator(
  db: Database,
  auth: RecoveryAuth,
  input: unknown,
) {
  const body = userSchema.parse(input);
  const found = await db.query(
    "select u.id,p.role,p.active from auth.users u left join app.profiles p on p.id=u.id where lower(u.email)=lower($1)",
    [body.email],
  );
  if (found.rows.length > 1)
    throw new SetupError(
      "Hay más de una cuenta con ese correo. Revisa Authentication > Users.",
    );
  const existing = found.rows[0];
  let id: string;
  if (!existing) {
    ({ id } = await createAdministrator(db, auth, body));
  } else {
    if (existing.role && (existing.role !== "admin" || !existing.active))
      throw new SetupError(
        "Ese correo pertenece a un perfil no administrador o desactivado. No se modificó.",
      );
    const user = await auth.read(String(existing.id));
    if (
      user.id !== existing.id ||
      user.email?.toLowerCase() !== body.email.toLowerCase()
    )
      throw new SetupError(
        "PostgreSQL y Supabase Auth no coinciden para este usuario. Revisa el proyecto configurado.",
      );
    if (user.banned_until && new Date(user.banned_until).getTime() > Date.now())
      throw new SetupError(
        "La cuenta está suspendida en Supabase. La reparación no elimina suspensiones.",
      );
    id = String(existing.id);
    await db.transaction(async (tx) => {
      const current = await tx.query(
        "select role,active from app.profiles where id=$1 for update",
        [id],
      );
      if (
        current.rows[0] &&
        (current.rows[0].role !== "admin" || !current.rows[0].active)
      )
        throw new SetupError(
          "El perfil cambió durante la reparación. No se actualizó la contraseña.",
        );
      if (!current.rows[0])
        await tx.query(
          "insert into app.profiles(id,display_name,role) values($1,$2,'admin')",
          [id, body.displayName],
        );
      await tx.query(
        "insert into app.audit_log(actor_id,action,entity_id) values($1,'admin.password_recovery',$1)",
        [id],
      );
      await auth.reset(id, body.password);
    });
  }
  if ((await auth.verify(body.email, body.password)) !== id)
    throw new SetupError(
      "La verificación de acceso devolvió otra cuenta. Revisa el proyecto de Supabase.",
    );
  return { id, email: body.email, created: !existing };
}
