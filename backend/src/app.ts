import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import type { Database } from "./db/database.js";
import type { Config } from "./config/env.js";
import { installAuth, type VerifyToken } from "./middleware/auth.js";
import { AppError, databaseErrors } from "./lib/errors.js";
import { deliveryRoutes } from "./routes/deliveries.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { adminRoutes, type UserProvisioner } from "./routes/admin.js";
import { reportRoutes } from "./routes/reports.js";
import { importRoutes } from "./routes/imports.js";
export async function createApp(deps: {
  db: Database;
  config: Config;
  verify: VerifyToken;
  users: UserProvisioner;
}) {
  const { db, config, verify, users } = deps;
  const app = Fastify({
    bodyLimit: 64 * 1024,
    trustProxy: config.TRUST_PROXY_HOPS
      ? (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS
      : false,
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            level: "info",
            redact: ["req.headers.authorization", "req.headers.cookie"],
            serializers: {
              req: (r) => ({
                method: r.method,
                url: r.url?.split("?")[0],
                id: r.id,
              }),
            },
          },
  });
  await app.register(helmet);
  await app.register(cors, {
    origin: config.FRONTEND_ORIGINS.split(",").map((v) => v.trim()),
    methods: ["GET", "POST", "PUT", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: {
      fileSize: config.UPLOAD_MAX_MB * 1024 * 1024,
      files: 1,
      fields: 0,
    },
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  installAuth(app, db, verify);
  app.get("/health", async () => {
    await db.query("select 1");
    return { status: "ok" };
  });
  deliveryRoutes(app, db);
  campaignRoutes(app, db);
  adminRoutes(app, db, users);
  reportRoutes(app, db, config);
  importRoutes(app, db, config);
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({ code: "INVALID_INPUT", requestId: request.id });
    if (error instanceof AppError)
      return reply
        .code(error.status)
        .send({ code: error.code, requestId: request.id });
    const err = error as {
      code?: string;
      message?: string;
      statusCode?: number;
    };
    if (err.code === "P0001" && err.message && databaseErrors[err.message])
      return reply
        .code(databaseErrors[err.message]!)
        .send({ code: err.message, requestId: request.id });
    if (err.code === "23505")
      return reply
        .code(409)
        .send({ code: "DUPLICATE_RECORD", requestId: request.id });
    if (err.code === "23503")
      return reply
        .code(400)
        .send({ code: "INVALID_REFERENCE", requestId: request.id });
    if (err.statusCode === 413)
      return reply
        .code(413)
        .send({ code: "WORKBOOK_TOO_LARGE", requestId: request.id });
    if (err.statusCode === 429)
      return reply
        .code(429)
        .send({ code: "RATE_LIMITED", requestId: request.id });
    if (["22P02", "22007", "22008", "23514"].includes(err.code ?? ""))
      return reply
        .code(400)
        .send({ code: "INVALID_INPUT", requestId: request.id });
    request.log.error(
      { code: err.code, requestId: request.id },
      "Request failed",
    );
    return reply
      .code(500)
      .send({ code: "SERVER_ERROR", requestId: request.id });
  });
  await app.ready();
  return app;
}
