// YouCam reports hair colour as a family (Black, Brown, Blonde, Auburn, Red, Grey/White).
// These are the words a wig shop uses for the same families.
const FAMILY_WORDS: Record<string, string[]> = {
  black: ["natural", "black"],
  brown: ["brown"],
  blonde: ["blonde"],
  auburn: ["auburn"],
  red: ["copper", "red"],
  "grey/white": ["grey"],
};

export function colourWords(family: string | null): string[] {
  if (!family) return [];
  return FAMILY_WORDS[family.toLowerCase()] ?? [family.toLowerCase()];
}
