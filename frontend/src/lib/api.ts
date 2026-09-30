import { config } from "../config/app";
import { supabase } from "./supabase";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
async function send(path: string, options: RequestInit = {}) {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new ApiError("UNAUTHORIZED", 401);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      cache: "no-store",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${data.session.access_token}`,
        ...options.headers,
      },
    });
    return response;
  } catch {
    throw new ApiError("NETWORK_UNCERTAIN", 0);
  } finally {
    clearTimeout(timer);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await send(path, options);
  const body = await response.json();
  if (
    !response.ok &&
    !(response.status === 409 && body.outcome === "already_delivered")
  )
    throw new ApiError(body.code ?? "SERVER_ERROR", response.status);
  return body as T;
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export async function download(path: string, filename: string) {
  const response = await send(path);
  if (!response.ok) {
    const body = await response.json();
    throw new ApiError(body.code ?? "SERVER_ERROR", response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
