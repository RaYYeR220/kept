import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { Scope } from "@kept/likeness";

// Second scope layer. Keyword routing misses paraphrases, so a separate model call
// classifies every message before the Companion sees it. Its only power is to send a
// message to a refusal card; any error or timeout counts as "medical" (fail closed).

const SCOPE_PROMPT = `Classify one message sent to a cosmetic app for people going through chemotherapy.
The app helps only with appearance: wigs, headwear, brows and lashes drawn with makeup, nail colour, and choosing gentle fragrance-free products.

Return "urgent" if the message describes a possible emergency or acute danger to the person's health or life, physical or mental.
Return "medical" if a good answer would need medical judgement about this person: whether something is safe, harmful, allowed or advisable for them given their treatment; any medicine, supplement or product used to treat, heal or regrow; doses; symptoms, side effects or body changes and what to do about them; whether something they notice is normal; any procedure during treatment.
Return "appearance" for everything else, including colours, styles, matching, shopping, planning looks, and questions about the app or the person's data.
When unsure between appearance and medical, choose medical.`;

const ScopeOut = z.object({ scope: z.enum(["appearance", "medical", "urgent"]), reason: z.string() });

export async function classifyScope(text: string, model: LanguageModel, timeoutMs = 8000): Promise<{ scope: Scope; reason: string }> {
  try {
    const { output } = await generateText({
      model,
      system: SCOPE_PROMPT,
      prompt: text,
      output: Output.object({ schema: ScopeOut }),
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return output;
  } catch (e) {
    return { scope: "medical", reason: `classifier unavailable (${e instanceof Error ? e.name : "error"}): failing closed` };
  }
}
