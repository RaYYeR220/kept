import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "6-digit hex colour");

// Every string has a ceiling: a likeness travels into prompts and share links.
const s = (max: number) => z.string().max(max);

export const ProvenanceSchema = z.object({
  api: s(60),
  version: s(20),
  taskId: s(200).nullable(),
  units: z.number().nonnegative().max(1000),
  at: s(40),
  source: z.enum(["live", "replay"]),
});

const measured = <T extends z.ZodType>(value: T) => z.object({ value, prov: ProvenanceSchema });

const term = z.object({ mapping: s(30).nullable(), term: s(60) });

export const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"] as const;

/**
 * The measured likeness. Lives on the person's device; only a summary (no photos)
 * ever leaves it, and only when they share it.
 */
export const LikenessSchema = z.object({
  id: s(64),
  createdAt: s(40),
  status: z.enum(["complete", "incomplete"]),
  consent: z.object({ at: s(40), textVersion: s(20) }),
  hair: z.object({
    color: measured(z.object({ hex, name: s(40).nullable() })).nullable(),
    type: measured(term).nullable(),
    length: measured(term).nullable(),
    density: measured(term).nullable(),
    frizz: measured(term).nullable(),
  }),
  brows: z.object({
    color: measured(z.object({ hex })).nullable(),
    shape: measured(z.object({ shape: s(30), thickness: s(30) })).nullable(),
  }),
  skin: z.object({
    tone: measured(z.object({ hex })).nullable(),
    fitzpatrick: measured(z.enum(FITZPATRICK)).nullable(),
    /** Skin Analysis raw scores by concern, 1–100, higher = healthier. */
    baseline: measured(z.record(s(40), z.number())).nullable(),
  }),
  eyes: measured(z.object({ hex, name: s(30).nullable() })).nullable(),
  lips: measured(z.object({ hex })).nullable(),
  face: measured(z.object({ shape: s(30) })).nullable(),
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

/** Treatment dates as the app accepts them: a calendar date and small whole numbers. */
export const TreatmentPlanSchema = z.object({
  firstInfusion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycleDays: z.number().int().min(7).max(60).optional(),
  cycles: z.number().int().min(1).max(30).optional(),
});
