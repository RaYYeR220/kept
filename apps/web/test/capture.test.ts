import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createYouCam, Ledger, scriptedTransport } from "@kept/youcam";
import { deltaE00, hexToLab } from "@kept/likeness";
import { captureLikeness, type CaptureEvent } from "../lib/server/capture";

const PUT = "https://yce-us.s3-accelerate.amazonaws.com/up";
const ok = (data: unknown) => ({ status: 200, body: { status: 200, data } });
const task = (id: string) => ok({ task_id: id });
const success = (results: unknown) => ok({ task_status: "success", results });
const failure = (error: string) => ok({ task_status: "error", error });

function routes(over: Record<string, unknown> = {}) {
  return {
    "POST /s2s/v2.0/file": ok({ files: [{ file_id: "f", requests: [{ method: "PUT", url: PUT, headers: {} }] }] }),
    [`PUT ${PUT}`]: { status: 200, body: {} },
    "POST /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process": task("t-pre"),
    "GET /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process/t-pre": success({ result: [{ left: 0.3, top: 0.2, width: 0.36, height: 0.43 }], timed: 900 }),
    "POST /s2s/v2.0/task/skin-tone-analysis": task("t-tone"),
    "GET /s2s/v2.0/task/skin-tone-analysis/t-tone": success({
      face_quality: { has_face: true, lighting: "good" },
      color: { skin_color: "#c99d7f", eyebrow_color: "#4a3222", hair_color: "#42280E", hair_color_name: "Brown", eye_color: "#5a4632", eye_color_name: "Brown", lip_color: "#b5636a" },
    }),
    "POST /s2s/v2.0/task/face-attr-analysis": task("t-face"),
    "GET /s2s/v2.0/task/face-attr-analysis/t-face": success({
      eyebrow: { left_shape: "Soft Angled", left_body_thickness: "Average" },
      faceshape: "Oval",
      color: { eyebrow_color: "#4d3424", hair_color: "#42280E", hair_color_name: "Brown" },
    }),
    "POST /s2s/v2.0/task/hair-length-detection": task("t-len"),
    "GET /s2s/v2.0/task/hair-length-detection/t-len": success({ hair_length: { term: "above chest" } }),
    "POST /s2s/v2.0/task/hair-density-detection": task("t-den"),
    "GET /s2s/v2.0/task/hair-density-detection/t-den": success({ hair_density: { mapping: "2.16", term: "Medium Density" } }),
    "POST /s2s/v2.0/task/hair-type-detection": task("t-type"),
    "GET /s2s/v2.0/task/hair-type-detection/t-type": success({ hair_type: { mapping: "2a to 2b", term: "Slight to Medium Wavy" } }),
    "POST /s2s/v2.0/task/delete": ok({}),
    ...over,
  } as Parameters<typeof scriptedTransport>[0];
}

const opts = {
  sessionId: "s",
  consentAt: "2026-10-31T09:00:00Z",
  consentVersion: "2026-10-30",
  skinBaseline: false,
  fitzpatrick: false,
  source: "replay" as const,
  now: () => "2026-10-31T09:01:00Z",
  newId: () => "lk1",
};
// Skin-coloured frame with a band of dark-brown "hair" across the top, where the sampler looks.
const hairBand = await sharp({ create: { width: 400, height: 80, channels: 3, background: "#3a2418" } }).png().toBuffer();
const jpeg = new Uint8Array(
  await sharp({ create: { width: 400, height: 400, channels: 3, background: "#c99d7f" } }).composite([{ input: hairBand, top: 0, left: 0 }]).jpeg({ quality: 95 }).toBuffer(),
);
const photos = { front: jpeg, right: new Uint8Array([2]), left: new Uint8Array([3]), top: new Uint8Array([4]) };

async function collect(gen: AsyncGenerator<CaptureEvent>) {
  const out: CaptureEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("captureLikeness", () => {
  it("builds a complete likeness with provenance on every value", async () => {
    const t = scriptedTransport(routes());
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: async () => {} });
    const events = await collect(captureLikeness(yc, photos, opts));
    const done = events.at(-1);
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    const l = done.likeness;
    expect(l.status).toBe("complete");
    expect(l.hair.color?.prov.api).toBe("kept-hair-sampler");
    expect(l.hair.color?.prov.units).toBe(0);
    expect(deltaE00(hexToLab(l.hair.color!.value.hex), hexToLab("#3a2418"))).toBeLessThan(3);
    expect(l.hair.color?.value.name).toBe("Dark brown");
    expect(l.hair.type?.value.term).toBe("Slight to Medium Wavy");
    expect(l.brows.shape?.value).toEqual({ shape: "Soft Angled", thickness: "Average" });
    expect(l.brows.color?.prov).toMatchObject({ api: "skin-tone-analysis", taskId: "t-tone", units: 20, source: "replay" });
    expect(done.units).toBe(20 + 10 + 2 + 1 + 2);
  });

  it("deletes every task after measuring", async () => {
    const t = scriptedTransport(routes());
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: async () => {} });
    await collect(captureLikeness(yc, photos, opts));
    const deleted = t.calls.filter((c) => c.url.endsWith("/task/delete")).map((c) => JSON.parse(String(c.init.body)).task_id);
    expect(deleted.sort()).toEqual(["t-den", "t-face", "t-len", "t-pre", "t-tone", "t-type"]);
  });

  it("asks for a retake when YouCam finds no face, and measures hair anyway", async () => {
    const t = scriptedTransport(routes({ "GET /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process/t-pre": success({ result: [] }) }));
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: async () => {} });
    const events = await collect(captureLikeness(yc, photos, opts));
    expect(events.find((e) => e.type === "retake")?.type).toBe("retake");
    const done = events.at(-1);
    expect(done?.type === "done" && done.likeness.status).toBe("incomplete");
    expect(done?.type === "done" && done.likeness.hair.length?.value.term).toBe("above chest");
    expect(t.calls.some((c) => c.url.includes("skin-tone-analysis"))).toBe(false);
  });

  it("asks for a retake and marks the likeness incomplete when the face is too small", async () => {
    const t = scriptedTransport(routes({ "GET /s2s/v2.0/task/skin-tone-analysis/t-tone": failure("error_face_position_too_small") }));
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: async () => {} });
    const events = await collect(captureLikeness(yc, photos, opts));
    expect(events.find((e) => e.type === "retake")).toMatchObject({ key: "skinTone", message: expect.stringMatching(/closer/) });
    const done = events.at(-1);
    expect(done?.type === "done" && done.likeness.status).toBe("incomplete");
    // Brow colour falls back to the second reading instead of disappearing.
    expect(done?.type === "done" && done.likeness.brows.color?.prov.api).toBe("face-attr-analysis");
  });

  it("skips hair type without side photos and stops spending at the session cap", async () => {
    const t = scriptedTransport(routes());
    const ledger = new Ledger({ globalCap: 1000, sessionCap: 25 });
    const yc = createYouCam({ apiKey: "k", transport: t, ledger, sleep: async () => {} });
    const events = await collect(captureLikeness(yc, { front: jpeg }, opts));
    expect(events.some((e) => e.type === "step" && e.key === "hairType")).toBe(false);
    expect(events.some((e) => e.type === "step" && e.status === "skipped")).toBe(true);
    expect(ledger.sessionSpent("s")).toBeLessThanOrEqual(25);
  });
});
