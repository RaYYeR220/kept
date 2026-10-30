import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "6-digit hex colour");

export const ProvenanceSchema = z.object({
  api: z.string(),
  version: z.string(),
  taskId: z.string().nullable(),
  units: z.number().nonnegative(),
  at: z.string(),
  source: z.enum(["live", "replay"]),
});

const measured = <T extends z.ZodType>(value: T) => z.object({ value, prov: ProvenanceSchema });

const term = z.object({ mapping: z.string().nullable(), term: z.string() });

export const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"] as const;

/**
 * The measured likeness. Lives on the person's device; only a summary (no photos)
 * ever leaves it, and only when they share it.
 */
export const LikenessSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  status: z.enum(["complete", "incomplete"]),
  consent: z.object({ at: z.string(), textVersion: z.string() }),
  hair: z.object({
    color: measured(z.object({ hex, name: z.string().nullable() })).nullable(),
    type: measured(term).nullable(),
    length: measured(term).nullable(),
    density: measured(term).nullable(),
    frizz: measured(term).nullable(),
  }),
  brows: z.object({
    color: measured(z.object({ hex })).nullable(),
    shape: measured(z.object({ shape: z.string(), thickness: z.string() })).nullable(),
  }),
  skin: z.object({
    tone: measured(z.object({ hex })).nullable(),
    fitzpatrick: measured(z.enum(FITZPATRICK)).nullable(),
    /** Skin Analysis raw scores by concern, 1–100, higher = healthier. */
    baseline: measured(z.record(z.string(), z.number())).nullable(),
  }),
  eyes: measured(z.object({ hex, name: z.string().nullable() })).nullable(),
  lips: measured(z.object({ hex })).nullable(),
  face: measured(z.object({ shape: z.string() })).nullable(),
});

export type Likeness = z.infer<typeof LikenessSchema>;

/** What the Companion and any share link may see: measurements only, by type. */
export type LikenessSummary = Omit<Likeness, "consent">;

export function summarise(l: Likeness): LikenessSummary {
  const { consent: _consent, ...rest } = l;
  return rest;
}

/** A likeness is complete when the values every later step depends on are present. */
export function isComplete(l: Omit<Likeness, "status">): boolean {
  return Boolean(l.hair.color && l.brows.color && l.brows.shape && l.skin.tone);
}
