import { describe, expect, it } from "vitest";
import { lintClaims } from "../src/lint.ts";

describe("lintClaims", () => {
  it.each([
    "Kept prevents hair loss.",
    "Scalp cooling works for most people, so try it.",
    "This serum is safe during chemotherapy.",
    "A chemo-safe moisturiser for you.",
    "This cream treats chemo rash.",
    "Clinically proven to regrow brows.",
    "Take 5 mg of biotin a day.",
    "You should stop taking your medication before the next cycle.",
    "From your photo I can diagnose alopecia.",
    "Your hair will definitely grow back.",
  ])("flags: %s", (text) => {
    const r = lintClaims(text);
    expect(r.ok).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
  });

  it.each([
    "This wig is close to your measured hair colour.",
    "Many people choose a wig before treatment starts.",
    "During treatment, a soft cotton cap can feel comfortable.",
    "Your brows were measured as Soft Angled and Average thickness.",
    "That's a question for your care team.",
    "The American Cancer Society suggests a water-soluble nail lacquer.",
  ])("allows: %s", (text) => {
    expect(lintClaims(text)).toEqual({ ok: true, hits: [] });
  });
});
