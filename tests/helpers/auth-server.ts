// Isolated test double for Supabase Auth. Never loaded by the production server.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import type { Database } from "../../backend/src/db/database";
import { AppError } from "../../backend/src/lib/errors";
import { ids } from "./database";
import { testToken, tokens } from "./tokens";

export async function testAuthServer(db: Database) {
  const accounts = new Map<string, { email: string; password: string }>();
  for (const [id, email] of [
    [ids.admin, "admin@example.test"],
    [ids.a, "operator@example.test"],
  ]) {
    accounts.set(id!, { email: email!, password: "Test-login-password-123" });
    await db.query("update auth.users set email=$2 where id=$1", [id, email]);
    await db.query("update app.profiles set email=$2 where id=$1", [id, email]);
  }
  const user = (id: string) => ({
    id,
    email: accounts.get(id)!.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  });
  const provisioner = {
    async create(email: string, password: string) {
      if ([...accounts.values()].some((a) => a.email === email))
        throw new AppError("USER_CREATE_FAILED", 409);
      const id = randomUUID();
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        email,
      ]);
      accounts.set(id, { email, password });
      return id;
    },
    async remove(id: string) {
      await db.query("delete from auth.users where id=$1", [id]);
      accounts.delete(id);
    },
    async resetPassword(id: string, password: string) {
      const account = accounts.get(id);
      if (!account) throw new AppError("PASSWORD_RESET_FAILED", 502);
      account.password = password;
    },
  };
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    const send = (code: number, body: unknown) => {
      res.statusCode = code;
      res.end(JSON.stringify(body));
    };
    if (req.method === "OPTIONS") {
      send(200, {});
      return;
    }
    try {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      if (req.url?.startsWith("/auth/v1/token")) {
        const account = [...accounts].find(
          ([, a]) =>
            a.email === body.email?.trim().toLowerCase() &&
            a.password === body.password,
        );
        if (!account) {
          send(400, {
            code: "invalid_credentials",
            message: "Invalid login credentials",
          });
          return;
        }
        const [id] = account;
        const token = `${testToken(id)}-${randomUUID()}`;
        tokens.set(token, id);
        send(200, {
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: randomUUID(),
          user: user(id),
        });
        return;
      }
      const token = req.headers.authorization?.slice(7) ?? "";
      const id = tokens.get(token);
      if (req.url?.startsWith("/auth/v1/logout")) {
        tokens.delete(token);
        send(200, {});
        return;
      }
      if (!id || !accounts.has(id)) {
        send(401, { message: "Invalid token" });
        return;
      }
      if (req.url === "/auth/v1/user") {
        if (req.method === "PUT") {
          if (typeof body.password !== "string" || body.password.length < 12) {
            send(400, { message: "Invalid password" });
            return;
          }
          await provisioner.resetPassword(id, body.password);
        }
        send(200, user(id));
        return;
      }
      send(404, {});
    } catch {
      send(500, { message: "Test auth failure" });
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(4902, "127.0.0.1", resolve),
  );
  return {
    provisioner,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
