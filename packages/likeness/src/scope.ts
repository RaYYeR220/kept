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
];

export function routeScope(text: string): ScopeResult {
  const urgent = URGENT.flatMap((re) => text.match(re)?.[0] ?? []);
  if (urgent.length) return { scope: "urgent", matched: urgent };
  const medical = MEDICAL.flatMap((re) => text.match(re)?.[0] ?? []);
  if (medical.length) return { scope: "medical", matched: medical };
  return { scope: "appearance", matched: [] };
}
