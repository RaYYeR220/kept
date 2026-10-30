import { BudgetError, YouCamHttpError } from "@kept/youcam";
import { captureLikeness, type CaptureEvent } from "@/lib/server/capture";
import { youcamFor } from "@/lib/server/env";
import { asPersona, replayJson } from "@/lib/server/replay";
import { json, sessionId } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 3_500_000;

async function bytes(f: FormDataEntryValue | null): Promise<Uint8Array | undefined> {
  if (!f || typeof f === "string") return undefined;
  if (f.size > MAX_BYTES) throw new RangeError("Each photo must be under 3.5 MB.");
  return new Uint8Array(await f.arrayBuffer());
}

function sse(run: (send: (ev: unknown) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        await run(send);
      } catch (e) {
        const message =
          e instanceof BudgetError ? e.message : e instanceof YouCamHttpError ? "The measuring service didn't answer. Please try again in a minute." : "Something went wrong while measuring.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
}

/** Measures a likeness and streams progress as server-sent events. */
export async function POST(req: Request) {
  const form = await req.formData();
  const consentAt = String(form.get("consentAt") ?? "");
  if (!consentAt) return json({ error: "Consent is required before measuring." }, 400);

  if (form.get("mode") !== "live") {
    const persona = asPersona(form.get("persona"));
    const rec = replayJson<{ events: CaptureEvent[] }>(persona, "capture");
    if (!rec) return json({ error: "This demo persona has no recording yet." }, 404);
    return sse(async (send) => {
      for (const ev of rec.events) {
        await new Promise((r) => setTimeout(r, ev.type === "step" && ev.status === "done" ? 420 : 120));
        send(ev.type === "done" ? { ...ev, likeness: { ...ev.likeness, consent: { at: consentAt, textVersion: ev.likeness.consent.textVersion } } } : ev);
      }
    });
  }

  let photos;
  try {
    const front = await bytes(form.get("front"));
    if (!front) return json({ error: "A front photo is required." }, 400);
    photos = { front, right: await bytes(form.get("right")), left: await bytes(form.get("left")), top: await bytes(form.get("top")) };
  } catch (e) {
    return json({ error: (e as Error).message }, 413);
  }

  const sid = await sessionId();
  let yc;
  try {
    yc = youcamFor("live", sid);
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }

  return sse(async (send) => {
    for await (const ev of captureLikeness(yc, photos, {
      sessionId: sid,
      consentAt,
      consentVersion: String(form.get("consentVersion") ?? "2026-10-30"),
      skinBaseline: form.get("skinBaseline") === "1",
      fitzpatrick: form.get("fitzpatrick") === "1",
      source: "live",
    })) {
      send(ev);
    }
  });
}
