import { liveAvailable } from "@/lib/server/env";
import { json } from "@/lib/server/session";

export const runtime = "nodejs";

export function GET() {
  return json({ live: liveAvailable(), companion: Boolean(process.env.LLM_API_KEY) });
}
