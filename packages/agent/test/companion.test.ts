import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { BudgetError } from "@kept/youcam";
import { runCompanion, type CompanionInput } from "../src/companion.ts";
import type { CompanionTools } from "../src/tools.ts";

type Part = { type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: string };

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function scriptedModel(turns: Part[][]) {
  const queue = [...turns];
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const content = queue.shift() ?? [{ type: "text", text: "" }];
      const calls = content.some((c) => c.type === "tool-call");
      return { content, finishReason: { unified: calls ? "tool-calls" : "stop", raw: undefined }, usage, warnings: [] };
    },
  });
  return model;
}

const call = (toolName: string, input: object, id = "c1"): Part => ({ type: "tool-call", toolCallId: id, toolName, input: JSON.stringify(input) });

function tools(over: Partial<CompanionTools> = {}): CompanionTools {
  return {
    findWigs: vi.fn(async () => []),
    tryOnWig: vi.fn(async () => ({ renderId: "r-wig", units: 2 })),
    restoreBrows: vi.fn(async () => ({ renderId: "r-brows", units: 1, reMeasuredDeltaE: 2.3 })),
    tryHeadwear: vi.fn(async () => ({ renderId: "r-hat", units: 2 })),
    findProducts: vi.fn(async () => []),
    prepareCheckout: vi.fn(async () => ({ continueUrl: "https://shop.example.com/checkouts/1" })),
    ...over,
  };
}

const input = (text: string): CompanionInput => ({
  messages: [{ role: "user", content: text }],
  likeness: null,
  plan: { firstInfusion: "2026-11-03" },
  inTreatment: true,
  today: "2026-10-31",
});

describe("runCompanion gates", () => {
  it("refuses a medical question before the model is ever called", async () => {
    const model = scriptedModel([[{ type: "text", text: "sure" }]]);
    const spy = vi.spyOn(model, "doGenerate");
    const turn = await runCompanion(input("can I use retinol while on paclitaxel?"), { model, tools: tools() });
    expect(turn.kind).toBe("refusal");
    expect(turn.kind === "refusal" && turn.scope).toBe("medical");
    expect(spy).not.toHaveBeenCalled();
    expect(turn.receipts[0]).toMatchObject({ kind: "gate", name: "scope", status: "blocked" });
  });

  it("routes urgent messages to the urgent card", async () => {
    const turn = await runCompanion(input("I have a fever of 39"), { model: scriptedModel([]), tools: tools() });
    expect(turn.kind === "refusal" && turn.card.title).toMatch(/contact someone now/i);
  });

  it("strips a medical claim from the reply and keeps the rest", async () => {
    const model = scriptedModel([[{ type: "text", text: "Scalp cooling works for most people. Here are three wigs close to your colour." }]]);
    const turn = await runCompanion(input("show me wigs"), { model, tools: tools() });
    expect(turn.kind).toBe("reply");
    if (turn.kind !== "reply") return;
    expect(turn.text).not.toMatch(/scalp cooling/i);
    expect(turn.text).toMatch(/three wigs/);
    expect(turn.receipts.some((r) => r.name === "lint")).toBe(true);
  });

  it("drops products the rules block before the model sees them", async () => {
    const findProducts = vi.fn(async () => [
      { listingId: "p1", title: "Gel manicure kit", category: "nails" as const, ingredients: null, attributes: ["gel"], priceMinor: 1999, currency: "USD", url: "u" },
      { listingId: "p2", title: "Water-based nail lacquer", category: "nails" as const, ingredients: null, attributes: [], priceMinor: 1299, currency: "USD", url: "u" },
    ]);
    let seen: unknown;
    const model = new MockLanguageModelV4({
      doGenerate: vi.fn()
        .mockImplementationOnce(async () => ({ content: [call("find_products", { query: "nail colour", category: "nails" })], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] }))
        .mockImplementationOnce(async (opts) => {
          seen = JSON.stringify(opts.prompt);
          return { content: [{ type: "text", text: "A water-based lacquer is a gentle option." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
        }),
    });
    const turn = await runCompanion(input("nail colour ideas"), { model, tools: tools({ findProducts }) });
    expect(String(seen)).toContain("Water-based nail lacquer");
    expect(String(seen)).not.toContain("Gel manicure kit");
    expect(turn.receipts.some((r) => r.name === "product" && r.status === "blocked")).toBe(true);
  });

  it("refuses a tool that isn't on the allowlist, like complete_checkout", async () => {
    const model = scriptedModel([[call("complete_checkout", { checkout_id: "x" })]]);
    const t = tools();
    const turn = await runCompanion(input("just buy it for me"), { model, tools: t });
    expect(turn.kind).toBe("reply");
    expect(turn.receipts.some((r) => r.name === "spend")).toBe(true);
    expect(t.prepareCheckout).not.toHaveBeenCalled();
  });

  it("refuses extra tool fields such as a photo URL", async () => {
    const model = scriptedModel([[call("try_on_wig", { listing_id: "w1", photo_url: "https://evil.example/me.jpg" })]]);
    const t = tools();
    const turn = await runCompanion(input("try this wig on me"), { model, tools: t });
    expect(t.tryOnWig).not.toHaveBeenCalled();
    expect(turn.receipts.some((r) => r.name === "photo")).toBe(true);
  });

  it("records a budget stop as a gate and keeps talking", async () => {
    const tryOnWig = vi.fn(async () => {
      throw new BudgetError("session_cap");
    });
    const model = scriptedModel([[call("try_on_wig", { listing_id: "w1" })], [{ type: "text", text: "I couldn't render that one right now." }]]);
    const turn = await runCompanion(input("try wig w1"), { model, tools: tools({ tryOnWig }) });
    expect(turn.kind === "reply" && turn.text).toMatch(/couldn't render/);
    expect(turn.receipts.some((r) => r.name === "budget")).toBe(true);
  });

  it("collects renders and checkout links for the UI", async () => {
    const model = scriptedModel([
      [call("restore_brows", {}), call("prepare_checkout", { listing_id: "w1" }, "c2")],
      [{ type: "text", text: "Your brows are back in your own colour, and the review link is ready." }],
    ]);
    const turn = await runCompanion(input("show my brows and get the wig"), { model, tools: tools() });
    expect(turn.kind === "reply" && turn.renders).toEqual(["r-brows"]);
    expect(turn.kind === "reply" && turn.checkouts).toEqual(["https://shop.example.com/checkouts/1"]);
  });

  it("refuses when the classifier flags a message the keyword router let through", async () => {
    const classifier = scriptedModel([[{ type: "text", text: JSON.stringify({ scope: "medical", reason: "asks if a procedure is advisable" }) }]]);
    const model = scriptedModel([[{ type: "text", text: "sure" }]]);
    const spy = vi.spyOn(model, "doGenerate");
    const turn = await runCompanion(input("would microblading be a good idea next week"), { model, classifier, tools: tools() });
    expect(turn.kind === "refusal" && turn.scope).toBe("medical");
    expect(spy).not.toHaveBeenCalled();
    expect(turn.receipts[0]?.detail).toMatch(/classifier/);
  });

  it("fails closed when the classifier errors", async () => {
    const classifier = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("upstream 500"); } });
    const turn = await runCompanion(input("which wig suits me"), { model: scriptedModel([]), classifier, tools: tools() });
    expect(turn.kind === "refusal" && turn.scope).toBe("medical");
  });

  it("proceeds when both layers say appearance", async () => {
    const classifier = scriptedModel([[{ type: "text", text: JSON.stringify({ scope: "appearance", reason: "style question" }) }]]);
    const turn = await runCompanion(input("which wig suits me"), { model: scriptedModel([[{ type: "text", text: "Here are three." }]]), classifier, tools: tools() });
    expect(turn.kind === "reply" && turn.text).toBe("Here are three.");
  });

  it("with gates off (negative control) lets the medical question through to the model", async () => {
    const model = scriptedModel([[{ type: "text", text: "Retinol is safe during chemotherapy." }]]);
    const turn = await runCompanion(input("can I use retinol while on paclitaxel?"), { model, tools: tools(), gatesOff: true });
    expect(turn.kind === "reply" && turn.text).toMatch(/safe during chemotherapy/);
  });
});
