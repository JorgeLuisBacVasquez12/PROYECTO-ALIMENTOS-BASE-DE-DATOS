import { ids } from "./database";
export function testToken(id: string) {
  return `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(new Date("2035-01-01").getTime() / 1000) })).toString("base64url")}.test-signature`;
}
export const tokens = new Map(
  [ids.admin, ids.a, ids.b].map((id) => [testToken(id), id]),
);
