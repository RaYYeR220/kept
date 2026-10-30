import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createShop } from "@kept/shop";
import { createYouCam, Ledger, type YouCam } from "@kept/youcam";
import { vercelBlobs } from "./blobs";
import { keyFromEnv } from "./crypto";
import { memoryBlobs, ShareStore } from "./share-store";

// One place that turns environment variables into clients. Live calls need keys; replay
// mode (the demo personas) serves recorded YouCam responses and needs none.

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

let ledger: Ledger | null = null;
export function liveLedger(): Ledger {
  ledger ??= new Ledger({
    globalCap: num(process.env.KEPT_UNIT_CAP, 600),
    sessionCap: num(process.env.KEPT_SESSION_UNIT_CAP, 40),
    ipCap: num(process.env.KEPT_IP_UNIT_CAP, 120),
    // Keep a floor of units for recording the demo and for judges; stop live spending below it.
    readCredit: async () => (await youcamLive().credit()) - num(process.env.KEPT_UNIT_FLOOR, 100),
  });
  return ledger;
}

let live: YouCam | null = null;
export function youcamLive(): YouCam {
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) throw new Error("Live measurements are not configured on this deployment.");
  live ??= createYouCam({ apiKey });
  return live;
}

export function youcamFor(_mode: "live", sessionId: string): YouCam {
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) throw new Error("Live measurements are not configured on this deployment.");
  return createYouCam({ apiKey, ledger: liveLedger(), defaultSession: sessionId });
}

export const liveAvailable = () => Boolean(process.env.YOUCAM_API_KEY);

// Venice adds its own system prompt unless told not to.
const llmFetch: typeof fetch = async (url, init) => {
  if (init?.body && typeof init.body === "string" && String(url).includes("venice.ai")) {
    const body = JSON.parse(init.body);
    body.venice_parameters = { include_venice_system_prompt: false };
    init = { ...init, body: JSON.stringify(body) };
  }
  return fetch(url, init);
};

export function llm() {
  const baseURL = process.env.LLM_BASE_URL ?? "https://api.venice.ai/api/v1";
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("The Companion is not configured on this deployment.");
  const p = createOpenAICompatible({ name: "llm", baseURL, apiKey, fetch: llmFetch, supportsStructuredOutputs: true });
  return {
    model: p(process.env.LLM_MODEL ?? "gemini-3-8-flash"),
    classifier: p(process.env.LLM_CLASSIFIER_MODEL ?? "gemini-3-5-flash-lite"),
  };
}

export const shop = createShop();

let store: ShareStore | null = null;
export function shares(): ShareStore {
  if (store) return store;
  // Without a key, shares only ever live in this process's memory (local development).
  if (!process.env.SHARE_ENCRYPTION_KEY && (process.env.BLOB_READ_WRITE_TOKEN || process.env.NODE_ENV === "production")) {
    throw new Error("SHARE_ENCRYPTION_KEY must be set wherever shares are stored.");
  }
  const key = process.env.SHARE_ENCRYPTION_KEY ? keyFromEnv() : Buffer.alloc(32, 7);
  store = new ShareStore(process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobs() : memoryBlobs(), key);
  return store;
}
