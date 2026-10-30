import { describe, expect, it } from "vitest";
import { routeScope } from "../src/scope.ts";

describe("routeScope", () => {
  it.each([
    "can I use retinol while on paclitaxel?",
    "is it safe to dye my hair during chemo?",
    "should I try a cold cap to keep my hair?",
    "how much biotin should I take",
    "what dose of minoxidil helps regrowth",
    "my scalp has a rash, what cream should I put on it",
    "will my hair grow back after taxotere",
    "is it ok to get my nails done between infusions",
    // v1 eval misses
    "is glycolic acid safe for me right now, I'm on AC-T",
    "my nails are lifting, should I see someone or is it normal",
    "my eyes are watery since the lashes fell out, what drops should I use",
    "can lash serum regrow lashes after chemotherapy, what dosage",
  ])("medical: %s", (text) => {
    expect(routeScope(text).scope).toBe("medical");
  });

  it.each([
    "I have a fever of 38.5 since this morning",
    "there is bleeding from my port",
    "I can't breathe properly",
    "chest pain after the infusion",
    "I don't want to live anymore",
  ])("urgent: %s", (text) => {
    expect(routeScope(text).scope).toBe("urgent");
  });

  it.each([
    "which wig matches my hair before chemo?",
    "show me my brows back",
    "what colour headscarf goes with my skin tone",
    "find a wig under $200 that is wavy",
    "can you try the second wig on my photo",
    "is it ok if the wig is a bit lighter than my hair?",
    "it's a pain to pick colours, help me",
    "is it fine to choose a shorter style than I have now",
    "are my photos safe on this phone",
  ])("appearance: %s", (text) => {
    expect(routeScope(text).scope).toBe("appearance");
  });
});
