import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

const COOKIE = "kept_sid";

/** Anonymous per-browser id, used only to apply the per-session unit cap. */
export async function sessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,}$/.test(existing)) return existing;
  const id = randomBytes(16).toString("base64url");
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return id;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
