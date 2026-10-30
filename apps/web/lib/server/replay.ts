import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Demo personas. Each folder holds the recorded outcome of a real live run against the
// YouCam API (events, the measured likeness, rendered try-ons), so judges can click through
// without spending units or showing their own face. Everything replayed is labelled as such.

export const PERSONAS = ["anna", "marcus"] as const;
export type Persona = (typeof PERSONAS)[number];

export function asPersona(v: unknown): Persona {
  return (PERSONAS as readonly string[]).includes(String(v)) ? (v as Persona) : "anna";
}

const root = () => join(process.cwd(), "fixtures", "replay");

export function replayJson<T>(persona: Persona, name: string): T | null {
  const file = join(root(), persona, `${name.replace(/[^a-z0-9-]/gi, "")}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
}

export function replayImage(persona: Persona, name: string): Uint8Array | null {
  const file = join(root(), persona, "renders", `${name.replace(/[^a-z0-9-]/gi, "")}.jpg`);
  return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
}

/** Listing ids that have a recorded wig try-on for this persona. */
export function recordedListings(persona: unknown): string[] {
  const dir = join(root(), asPersona(persona));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^wig-.*\.json$/.test(f))
    .map((f) => (JSON.parse(readFileSync(join(dir, f), "utf8")) as { listingId?: string }).listingId)
    .filter((x): x is string => Boolean(x));
}

export const replayKey = (kind: string, listingId: string | null) => (listingId ? `${kind}-${listingId.replace(/[^a-z0-9]/gi, "").slice(-12)}` : kind);
