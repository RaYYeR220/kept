// Outgoing-copy linter. Every sentence the Companion (or any template) shows a person
// passes through here first; a hit blocks the sentence. Kept is cosmetic only.

export type LintHit = { ruleId: string; phrase: string };
export type LintResult = { ok: boolean; hits: LintHit[] };

const RULES: Array<{ ruleId: string; re: RegExp }> = [
  { ruleId: "prevent-hair-loss", re: /\b(prevent|prevents|preventing|stop|stops|stopping|reduce|reduces|slow|slows)\b[^.]{0,30}\bhair (loss|fall|shedding|thinning)\b/i },
  { ruleId: "scalp-cooling-efficacy", re: /\b(scalp cooling|cold caps?)\b[^.]{0,40}\b(works?|effective|will save|saves|keeps? your hair)\b/i },
  { ruleId: "safety-claim", re: /\bsafe\b[^.]{0,20}\b(during|for|while|with|on)\b[^.]{0,25}\b(chemo|chemotherapy|treatment|radiation|infusions?|cycles?)\b/i },
  { ruleId: "safety-claim", re: /\b(chemo|chemotherapy|oncology|oncologist)[- ](safe|approved|friendly)\b/i },
  { ruleId: "treatment-claim", re: /\b(cures?|heals?|treats|treatment for|remed(y|ies) for)\b/i },
  { ruleId: "unsupported-proof", re: /\b(clinically|medically|scientifically) (proven|tested|approved)\b/i },
  { ruleId: "unsupported-proof", re: /\bdermatologist[- ](approved|recommended|tested)\b/i },
  { ruleId: "dosage", re: /\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|iu)\b/i },
  { ruleId: "medical-instruction", re: /\b(you should|you must|you need to)\s+(stop|start|skip|pause|increase|reduce)\b/i },
  { ruleId: "medical-instruction", re: /\b(stop|start|skip|pause)\s+(taking|using)\s+(your\s+)?(medication|medicine|treatment|chemo|tablets|pills)\b/i },
  { ruleId: "diagnosis", re: /\bdiagnos(e|es|ed|is|ing)\b/i },
  { ruleId: "promise", re: /\bwill (definitely|certainly|surely|always)\b[^.]{0,20}\bgrow back\b/i },
];

export const SAFE_FALLBACK =
  "That's a question for your care team, so I won't guess. I can help with how things look: wigs, brows, headwear and colours.";

export function lintClaims(text: string): LintResult {
  const hits: LintHit[] = [];
  for (const { ruleId, re } of RULES) {
    const m = text.match(re);
    if (m) hits.push({ ruleId, phrase: m[0] });
  }
  return { ok: hits.length === 0, hits };
}
