import { BudgetError, YouCamHttpError, YouCamTaskError } from "@kept/youcam";
import { youcamFor } from "@/lib/server/env";
import { asPersona, replayImage, replayJson } from "@/lib/server/replay";
import { json, sessionId } from "@/lib/server/session";
import { calibrateBrows, renderBrows, renderHat, renderWig, verifyBrows } from "@/lib/server/tryon";

export const runtime = "nodejs";
export const maxDuration = 90;

const KINDS = ["brows", "wig", "hat", "verify-brows"] as const;
type Kind = (typeof KINDS)[number];
const MAX_BYTES = 3_500_000;
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const httpsUrl = (v: unknown) => {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await ctx.params;
  if (!(KINDS as readonly string[]).includes(raw)) return json({ error: "Unknown try-on." }, 404);
  const kind = raw as Kind;
  const form = await req.formData();

  if (form.get("mode") !== "live") {
    const persona = asPersona(form.get("persona"));
    const key = `${kind}${form.get("ref") ? `-${String(form.get("ref")).replace(/[^a-z0-9]/gi, "").slice(-12)}` : ""}`;
    const meta = replayJson<Record<string, unknown>>(persona, key);
    const image = replayImage(persona, key);
    if (!meta) return json({ error: "No recording for this try-on in the demo." }, 404);
    return json({ ...meta, image: image ? b64(image) : null, source: "replay" });
  }

  const photo = form.get("photo");
  if (!photo || typeof photo === "string") return json({ error: "A photo is required." }, 400);
  if (photo.size > MAX_BYTES) return json({ error: "The photo must be under 3.5 MB." }, 413);
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const sid = await sessionId();

  try {
    const yc = youcamFor("live", sid);
    if (kind === "brows") {
      const browHex = hex(form.get("browHex"));
      if (!browHex) return json({ error: "Measured brow colour is required." }, 400);
      const shape = form.get("browShape") ? { shape: String(form.get("browShape")), thickness: String(form.get("browThickness") ?? "Unknown") } : null;
      if (form.get("calibrate") === "1") {
        const c = await calibrateBrows(yc, bytes, { hex: browHex, shape }, sid);
        return json({ image: b64(c.best.image), units: c.units, api: "makeup-vto", pattern: c.best.pattern, rounds: c.rounds, deltaE: c.best.deltaE, measuredHex: c.best.measuredHex, source: "live" });
      }
      const r = await renderBrows(yc, bytes, { hex: browHex, shape }, sid);
      return json({ image: b64(r.image), units: r.units, api: r.api, taskId: r.taskId, pattern: r.pattern, source: "live" });
    }
    if (kind === "verify-brows") {
      const target = hex(form.get("browHex"));
      if (!target) return json({ error: "Measured brow colour is required." }, 400);
      return json({ ...(await verifyBrows(yc, bytes, target, sid)), source: "live" });
    }
    const ref = httpsUrl(form.get("ref"));
    if (!ref) return json({ error: "A product image link is required." }, 400);
    const r = kind === "wig" ? await renderWig(yc, bytes, ref, sid) : await renderHat(yc, bytes, ref, form.get("gender") === "male" ? "male" : "female", sid);
    return json({ image: b64(r.image), units: r.units, api: r.api, taskId: r.taskId, source: "live" });
  } catch (e) {
    if (e instanceof YouCamTaskError) return json({ error: e.retake ?? "That try-on didn't work with this photo.", code: e.code }, 422);
    if (e instanceof BudgetError) return json({ error: e.message, code: e.reason }, 429);
    if (e instanceof YouCamHttpError) return json({ error: "The try-on service didn't answer. Please try again.", code: e.code }, 502);
    return json({ error: (e as Error).message }, 500);
  }
}
