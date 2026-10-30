import { describe, expect, it } from "vitest";
import { checkProduct } from "../src/rules.ts";
import { CITATIONS } from "../src/citations.ts";

const skincare = (ingredients: string | null, title = "Gentle cream") =>
  ({ title, category: "skincare" as const, ingredients, attributes: [] });

describe("checkProduct", () => {
  it("passes a plain fragrance-free moisturiser", () => {
    const v = checkProduct(skincare("Aqua, Glycerin, Cetearyl Alcohol, Dimethicone, Ceramide NP"), { inTreatment: true });
    expect(v.status).toBe("ok");
    expect(v.findings).toEqual([]);
  });

  it("flags parfum and named fragrance allergens as caution with an NCI citation", () => {
    const v = checkProduct(skincare("Aqua, Glycerin, Parfum, Linalool, Limonene"), { inTreatment: true });
    expect(v.status).toBe("caution");
    expect(v.findings.map((f) => f.matched)).toEqual(expect.arrayContaining(["parfum", "linalool", "limonene"]));
    expect(v.findings.every((f) => f.citation in CITATIONS)).toBe(true);
  });

  it("flags drying alcohol but not fatty alcohols", () => {
    expect(checkProduct(skincare("Alcohol Denat., Aqua"), { inTreatment: true }).status).toBe("caution");
    expect(checkProduct(skincare("Cetyl Alcohol, Stearyl Alcohol, Aqua"), { inTreatment: true }).status).toBe("ok");
  });

  it("asks to check with the care team before exfoliating acids or retinoids", () => {
    const acid = checkProduct(skincare("Aqua, Glycolic Acid, Sodium Hydroxide"), { inTreatment: true });
    expect(acid.status).toBe("caution");
    expect(acid.findings[0]?.ruleId).toBe("active-ingredient");
    expect(checkProduct(skincare("Squalane, Retinol"), { inTreatment: true }).status).toBe("caution");
  });

  it("returns unverified, never ok, when skincare ingredients are unknown", () => {
    expect(checkProduct(skincare(null), { inTreatment: true }).status).toBe("unverified");
  });

  it("blocks salon gel/acrylic nails and polish remover during treatment only", () => {
    const gel = { title: "Gel manicure kit", category: "nails" as const, ingredients: null, attributes: ["gel"] };
    expect(checkProduct(gel, { inTreatment: true }).status).toBe("blocked");
    expect(checkProduct(gel, { inTreatment: false }).status).toBe("ok");
    const remover = { title: "Acetone nail polish remover", category: "nails" as const, ingredients: null, attributes: [] };
    expect(checkProduct(remover, { inTreatment: true }).status).toBe("blocked");
  });

  it("treats press-on nails as caution, not block, during treatment", () => {
    const pressOn = { title: "Press-on nails, almond", category: "nails" as const, ingredients: null, attributes: [] };
    expect(checkProduct(pressOn, { inTreatment: true }).status).toBe("caution");
  });

  it("passes a water-soluble lacquer", () => {
    const lacquer = { title: "Water-based nail lacquer", category: "nails" as const, ingredients: null, attributes: [] };
    expect(checkProduct(lacquer, { inTreatment: true }).status).toBe("ok");
  });

  it("does not judge wigs or headwear by ingredients", () => {
    const wig = { title: "Lace front wig", category: "wig" as const, ingredients: null, attributes: [] };
    expect(checkProduct(wig, { inTreatment: true }).status).toBe("ok");
  });
});
