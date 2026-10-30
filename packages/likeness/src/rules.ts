import type { CitationId } from "./citations.ts";

export type ProductCategory = "skincare" | "nails" | "brow" | "wig" | "headwear" | "other";

export type ProductFacts = {
  title: string;
  category: ProductCategory;
  /** INCI list as printed on the product, or null when the listing doesn't give one. */
  ingredients: string | null;
  attributes: string[];
};

export type Finding = {
  ruleId: "fragrance" | "drying-alcohol" | "active-ingredient" | "salon-nails" | "nail-remover" | "press-on";
  severity: "caution" | "block";
  matched: string;
  message: string;
  citation: CitationId;
};

export type ProductVerdict = {
  status: "ok" | "caution" | "blocked" | "unverified";
  findings: Finding[];
};

// The 26 fragrance allergens that EU Regulation 1223/2009 Annex III requires on labels.
const FRAGRANCE_ALLERGENS = [
  "amyl cinnamal", "benzyl alcohol", "cinnamyl alcohol", "citral", "eugenol", "hydroxycitronellal",
  "isoeugenol", "amylcinnamyl alcohol", "benzyl salicylate", "cinnamal", "coumarin", "geraniol",
  "hydroxyisohexyl 3-cyclohexene carboxaldehyde", "anise alcohol", "benzyl cinnamate", "farnesol",
  "butylphenyl methylpropional", "linalool", "benzyl benzoate", "citronellol", "hexyl cinnamal",
  "limonene", "methyl 2-octynoate", "alpha-isomethyl ionone", "evernia prunastri extract",
  "evernia furfuracea extract",
];
const FRAGRANCE_WORDS = ["parfum", "fragrance", "aroma"];
const DRYING_ALCOHOLS = ["alcohol denat", "sd alcohol", "ethanol", "isopropyl alcohol"];
const ACTIVES = [
  "glycolic acid", "lactic acid", "mandelic acid", "malic acid", "tartaric acid", "salicylic acid",
  "betaine salicylate", "gluconolactone", "lactobionic acid", "retinol", "retinal", "retinaldehyde",
  "retinyl palmitate", "retinyl retinoate", "hydroxypinacolone retinoate", "tretinoin", "adapalene",
  "tazarotene",
];

function inciTokens(ingredients: string): string[] {
  return ingredients
    .toLowerCase()
    .split(/[,;\n]/)
    .map((s) => s.replace(/\(.*?\)/g, "").replace(/\.$/, "").trim())
    .filter(Boolean);
}

const hasTerm = (tokens: string[], term: string) => tokens.some((t) => t === term || t.startsWith(`${term} `) || t.startsWith(`${term}.`));

function skincareFindings(ingredients: string): Finding[] {
  const tokens = inciTokens(ingredients);
  const findings: Finding[] = [];
  for (const term of [...FRAGRANCE_WORDS, ...FRAGRANCE_ALLERGENS]) {
    if (hasTerm(tokens, term)) {
      findings.push({
        ruleId: "fragrance",
        severity: "caution",
        matched: term,
        message: "The National Cancer Institute suggests avoiding products that list fragrance during treatment.",
        citation: "nciSkinNails",
      });
    }
  }
  for (const term of DRYING_ALCOHOLS) {
    if (hasTerm(tokens, term)) {
      findings.push({
        ruleId: "drying-alcohol",
        severity: "caution",
        matched: term,
        message: "The National Cancer Institute suggests avoiding products that list alcohol, which can dry the skin.",
        citation: "nciSkinNails",
      });
    }
  }
  for (const term of ACTIVES) {
    if (hasTerm(tokens, term)) {
      findings.push({
        ruleId: "active-ingredient",
        severity: "caution",
        matched: term,
        message: "Contains an active ingredient. Check with your care team before starting it during treatment.",
        citation: "nciSkinNails",
      });
    }
  }
  return findings;
}

function nailFindings(p: ProductFacts): Finding[] {
  const text = `${p.title} ${p.attributes.join(" ")}`.toLowerCase();
  if (/remover|acetone|hardener/.test(text)) {
    return [{
      ruleId: "nail-remover",
      severity: "block",
      matched: text.match(/remover|acetone|hardener/)![0],
      message: "The American Cancer Society advises against nail polish removers and hardeners during treatment.",
      citation: "acsNails",
    }];
  }
  if (/\bgel\b|acrylic|salon manicure|professional manicure|dip powder/.test(text)) {
    return [{
      ruleId: "salon-nails",
      severity: "block",
      matched: text.match(/\bgel\b|acrylic|salon manicure|professional manicure|dip powder/)![0],
      message: "The American Cancer Society advises against professional manicures during treatment.",
      citation: "acsNails",
    }];
  }
  if (/press[- ]?on|false nails|fake nails|nail tips/.test(text)) {
    return [{
      ruleId: "press-on",
      severity: "caution",
      matched: text.match(/press[- ]?on|false nails|fake nails|nail tips/)![0],
      message: "Adhesive and removal can injure nails. Ask your care team first; a water-soluble lacquer is the gentler option.",
      citation: "acsNails",
    }];
  }
  return [];
}

export function checkProduct(p: ProductFacts, ctx: { inTreatment: boolean }): ProductVerdict {
  let findings: Finding[] = [];
  if (p.category === "skincare") {
    if (p.ingredients === null) return { status: "unverified", findings: [] };
    findings = skincareFindings(p.ingredients);
  } else if (p.category === "nails" && ctx.inTreatment) {
    findings = nailFindings(p);
  }
  if (findings.some((f) => f.severity === "block")) return { status: "blocked", findings };
  if (findings.length > 0) return { status: "caution", findings };
  return { status: "ok", findings };
}
