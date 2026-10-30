// Deterministic scope router. Runs before any model sees a message: medical and urgent
// questions never reach the agent's tools.

export type Scope = "appearance" | "medical" | "urgent";
export type ScopeResult = { scope: Scope; matched: string[] };

const URGENT: RegExp[] = [
  /\bfever\b/i,
  /\btemperature (of )?(3[89]|4\d|10[0-9])/i,
  /\bbleed(ing|s)?\b/i,
  /\b(can'?t|cannot|can not|hard to|struggling to) breathe\b/i,
  /\bshort(ness)? of breath\b/i,
  /\bchest pain\b/i,
  /\b(faint(ed|ing)?|passed out|unconscious)\b/i,
  /\b(kill myself|suicid\w*|end my life|don'?t want to live|want to die)\b/i,
  /\bemergency\b/i,
];

const DRUGS =
  /\b(paclitaxel|taxol|docetaxel|taxotere|nab-paclitaxel|abraxane|doxorubicin|adriamycin|epirubicin|cyclophosphamide|cytoxan|carboplatin|cisplatin|oxaliplatin|fluorouracil|5-?fu|capecitabine|xeloda|methotrexate|vincristine|etoposide|gemcitabine|irinotecan|trastuzumab|herceptin|pertuzumab|pembrolizumab|keytruda|nivolumab|tamoxifen|letrozole|anastrozole|minoxidil|finasteride|biotin|steroids?|antibiotics?)\b/i;

const MEDICAL: RegExp[] = [
  DRUGS,
  /\b(dose|dosage|how much|how many|mg|milligrams?)\b[^?.]{0,40}\b(take|use|should)\b/i,
  /\b(how much|how many)\b[^?.]{0,20}\bshould i\b/i,
  /\b(is it|is this|it'?s|are they|would it be)\s+(safe|unsafe|dangerous|harmful)\b/i,
  /\b(is it|is this|are they|would it be)\s+(ok|okay|fine|alright)\s+to\b[^?.]{0,40}\b(during|while|on|between|after|before)\b[^?.]{0,25}\b(chemo\w*|treatment|infusions?|cycles?|radiation)\b/i,
  /\b(cold caps?|scalp cool\w*|cooling cap)\b/i,
  /\b(rash|infection|infected|blister\w*|sores?|swelling|swollen|painful|pain (in|on|around)|itch\w*)\b/i,
  /\b(medication|medicine|prescription|prescribe\w*|side effects?|symptoms?|diagnos\w*|blood count|white cells?|neutrophils?|platelets?)\b/i,
  /\bwill my (hair|brows|eyebrows|lashes|eyelashes) (grow back|come back|return)\b/i,
  /\bshould i (stop|start|skip|pause|delay|try)\b/i,
  /\b(get|getting|have) my nails done\b/i,
  // v2 (from the v1 eval misses): safety questions about a named thing, "should I see
  // someone", "is it normal", eye drops, and dose words on their own.
  /\b(is|are|would)\b[^?.]{1,40}\b(safe|unsafe|harmful|harmless)\b/i,
  /\bshould i (see|call|contact|ask) (a |an |my |the )?(doctor|dermatologist|nurse|someone|gp|oncologist|specialist)\b/i,
  /\bis (it|this|that) normal\b/i,
  /\b(eye ?drops|drops)\b/i,
  /\b(dose|doses|dosage|dosing)\b/i,
];

// Questions about the app itself ("are my photos safe?") are not medical.
const ABOUT_KEPT = /\b(data|photos?|pictures?|privacy|private|information|account|password|likeness)\b/i;

export function routeScope(text: string): ScopeResult {
  const urgent = URGENT.flatMap((re) => text.match(re)?.[0] ?? []);
  if (urgent.length) return { scope: "urgent", matched: urgent };
  const medical = MEDICAL.flatMap((re) => text.match(re)?.[0] ?? []).filter(
    (m) => !(/\b(safe|unsafe|harmful|harmless)\b/i.test(m) && ABOUT_KEPT.test(text)),
  );
  if (medical.length) return { scope: "medical", matched: medical };
  return { scope: "appearance", matched: [] };
}

const SEVERITY: Record<Scope, number> = { appearance: 0, medical: 1, urgent: 2 };

/** The stricter of two scope verdicts — used to combine the router with a classifier. */
export function stricterScope(a: Scope, b: Scope): Scope {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}
