import { generateText, InvalidToolInputError, isStepCount, NoSuchToolError, type LanguageModel, type ModelMessage } from "ai";
import { routeScope, type LikenessSummary, type TreatmentPlan } from "@kept/likeness";
import { lintReply, MEDICAL_CARD, URGENT_CARD, type CareCard } from "./gates.ts";
import { systemPrompt } from "./prompt.ts";
import { ReceiptLog, type Receipt } from "./receipts.ts";
import { buildTools, type CompanionTools } from "./tools.ts";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type CompanionInput = {
  messages: ChatMsg[];
  likeness: LikenessSummary | null;
  plan: TreatmentPlan | null;
  inTreatment: boolean;
  today: string;
};

export type CompanionDeps = {
  model: LanguageModel;
  tools: CompanionTools;
  now?: () => string;
  /** Negative control for the eval: disables the scope router, the claim linter and the product filter. */
  gatesOff?: boolean;
  maxSteps?: number;
};

export type CompanionTurn =
  | { kind: "refusal"; scope: "medical" | "urgent"; card: CareCard; receipts: Receipt[] }
  | { kind: "reply"; text: string; renders: string[]; checkouts: string[]; receipts: Receipt[] };

export async function runCompanion(input: CompanionInput, deps: CompanionDeps): Promise<CompanionTurn> {
  const log = new ReceiptLog(deps.now);
  const last = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (!deps.gatesOff) {
    const scope = routeScope(last);
    if (scope.scope !== "appearance") {
      log.gate("scope", `${scope.scope}: ${scope.matched.join(", ")}`);
      return { kind: "refusal", scope: scope.scope, card: scope.scope === "urgent" ? URGENT_CARD : MEDICAL_CARD, receipts: log.items };
    }
  }

  const artifacts = { renders: [] as string[], checkouts: [] as string[] };
  const tools = buildTools({
    impl: deps.tools,
    log,
    plan: input.plan,
    today: input.today,
    inTreatment: input.inTreatment,
    artifacts,
    gatesOff: deps.gatesOff,
  });

  const res = await generateText({
    model: deps.model,
    system: systemPrompt(input.likeness, input.plan, input.today),
    messages: input.messages as ModelMessage[],
    tools,
    stopWhen: isStepCount(deps.maxSteps ?? 5),
  });
  let text = res.text;

  // Calls to tools outside the allowlist, or with fields the schema doesn't allow, come
  // back as invalid tool-call parts. Nothing ran; record which gate held.
  let refusedSpend = false;
  for (const part of res.steps.flatMap((s) => s.content)) {
    if (part.type !== "tool-call" || !("invalid" in part) || !part.invalid) continue;
    if (NoSuchToolError.isInstance(part.error)) {
      refusedSpend = true;
      log.gate("spend", `refused tool ${part.toolName}: not on the allowlist`);
    } else if (InvalidToolInputError.isInstance(part.error)) {
      log.gate("photo", `refused input for ${part.toolName}: only approved fields are accepted`);
    }
  }
  if (!text.trim()) {
    text = refusedSpend
      ? "I can't pay for things myself. I can prepare a review-and-pay link so you can check it and pay at the store."
      : "I couldn't do that step. Could you tell me what you'd like to see?";
  }

  if (!deps.gatesOff) {
    const linted = lintReply(text);
    for (const h of linted.hits) log.gate("lint", `${h.ruleId}: "${h.phrase}"`);
    text = linted.text;
  }

  return { kind: "reply", text, renders: artifacts.renders, checkouts: artifacts.checkouts, receipts: log.items };
}
