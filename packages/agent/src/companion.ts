import { generateText, InvalidToolInputError, isStepCount, NoSuchToolError, type LanguageModel, type ModelMessage } from "ai";
import { routeScope, stricterScope, type LikenessSummary, type TreatmentPlan } from "@kept/likeness";
import { classifyScope } from "./classify.ts";
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
  /** Scope classifier (second layer after the keyword router). Omit to use the router alone. */
  classifier?: LanguageModel;
  tools: CompanionTools;
  now?: () => string;
  /** Negative control for the eval: disables the scope router, the claim linter and the product filter. */
  gatesOff?: boolean;
  maxSteps?: number;
};

export type CompanionTurn =
  | { kind: "refusal"; scope: "medical" | "urgent"; card: CareCard; receipts: Receipt[] }
  | { kind: "reply"; text: string; renders: string[]; checkouts: string[]; receipts: Receipt[] };

/**
 * Earlier user turns that were medical or urgent were refused; they and the reply that
 * followed are removed before the model sees the conversation, so "ok, tell me anyway"
 * arrives without the question it would otherwise answer.
 */
export function sanitizeHistory(messages: ChatMsg[]): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    const isLast = i === messages.length - 1;
    if (m.role === "user" && !isLast && routeScope(m.content).scope !== "appearance") {
      if (messages[i + 1]?.role === "assistant") i++;
      continue;
    }
    out.push({ role: m.role, content: m.content.slice(0, 2000) });
  }
  return out;
}

export async function runCompanion(input: CompanionInput, deps: CompanionDeps): Promise<CompanionTurn> {
  const log = new ReceiptLog(deps.now);
  const last = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (!deps.gatesOff) {
    const routed = routeScope(last);
    let scope = routed.scope;
    const why = routed.matched.length ? [`keywords: ${routed.matched.join(", ")}`] : [];
    if (deps.classifier && scope !== "urgent") {
      const c = await classifyScope(last, deps.classifier);
      if (c.scope !== "appearance") why.push(`classifier: ${c.reason}`);
      scope = stricterScope(scope, c.scope);
    }
    if (scope !== "appearance") {
      log.gate("scope", `${scope}: ${why.join("; ")}`);
      return { kind: "refusal", scope, card: scope === "urgent" ? URGENT_CARD : MEDICAL_CARD, receipts: log.items };
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
    messages: sanitizeHistory(input.messages) as ModelMessage[],
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
