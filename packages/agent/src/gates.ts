import { lintClaims, SAFE_FALLBACK, type LintHit } from "@kept/likeness";

export type CareCard = { title: string; body: string };

export const MEDICAL_CARD: CareCard = {
  title: "That one is for your care team",
  body: "Kept only helps with how things look. Questions about medicines, symptoms, treatments or what is safe for you belong with your oncology team or nurse line — they know your treatment. I can help with wigs, brows, headwear and colours whenever you like.",
};

export const URGENT_CARD: CareCard = {
  title: "Please contact someone now",
  body: "If you feel unwell, have a fever, bleeding, chest pain or trouble breathing, call your care team's urgent line or your local emergency number now. If you are thinking about harming yourself, call or text 988 in the US, or your local crisis line. Kept can't help with this, but they can.",
};

/** Removes every sentence the claim linter flags; falls back to the safe sentence if nothing is left. */
export function lintReply(text: string): { text: string; hits: LintHit[] } {
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [text];
  const hits: LintHit[] = [];
  const kept = sentences.filter((s) => {
    const r = lintClaims(s);
    hits.push(...r.hits);
    return r.ok;
  });
  const out = kept.join("").trim();
  if (hits.length === 0) return { text: text.trim(), hits };
  return { text: out.length > 0 ? `${out}\n\n${SAFE_FALLBACK}` : SAFE_FALLBACK, hits };
}

/** Tools the model may call. Anything else — including complete_checkout — is refused. */
export const TOOL_ALLOWLIST = [
  "get_timeline",
  "find_wigs",
  "try_on_wig",
  "restore_brows",
  "try_headwear",
  "find_products",
  "check_product",
  "prepare_checkout",
] as const;
export type ToolName = (typeof TOOL_ALLOWLIST)[number];
