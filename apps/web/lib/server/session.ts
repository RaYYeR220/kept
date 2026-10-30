import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";

const COOKIE = "kept_sid";

/** Anonymous per-browser id. */
export async function sessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = randomBytes(16).toString("base64url");
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return id;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim().slice(0, 64);
}

/** Spend key "<ip>|<session>": the ledger caps both the session and everything on the IP. */
export async function spendKey(): Promise<string> {
  return `${await clientIp()}|${await sessionId()}`;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function parseJson(raw: unknown): unknown {
  try {
    return JSON.parse(String(raw ?? "null"));
  } catch {
    return undefined;
  }
}
