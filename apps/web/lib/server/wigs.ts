import { textureFamily } from "@kept/likeness";

// Search words for a sampled shade name ("Dark brown", "Light auburn brown", "Black"…).
export function colourWords(shade: string | null): string[] {
  if (!shade) return [];
  const s = shade.toLowerCase();
  if (s === "black") return ["natural", "black"];
  if (s.includes("grey")) return ["grey"];
  if (s.includes("blonde")) return s.includes("dark") ? ["dark", "blonde"] : ["blonde"];
  if (s.includes("copper")) return ["copper"];
  if (s.includes("auburn")) return ["auburn", "brown"];
  if (s.includes("brown")) return s.split(" ");
  return [s];
}

/** YouCam hair-type terms ("Medium to Thick Wavy", "Coily to Extremely Coily") → one search word. */
export function textureWord(term: string): string | null {
  const f = textureFamily(term);
  return f === "coily" ? "kinky curly" : f === "curly" ? "curly" : f === "wavy" ? "wavy" : f === "straight" ? "straight" : null;
}
