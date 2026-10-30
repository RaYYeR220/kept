import {
  BudgetError,
  parseFaceAttr,
  parseFaceBoxes,
  parseFitzpatrick,
  parseHairDensity,
  parseHairLength,
  parseHairType,
  parseSkinScores,
  parseSkinTone,
  YouCamTaskError,
  type FeatureKey,
  type TaskOutcome,
  type YouCam,
} from "@kept/youcam";
import { isComplete, type Likeness, type Provenance } from "@kept/likeness";
import { cropToFace } from "./crop";
import { sampleHairFromBox } from "./sample";

/** front: head and shoulders · right/left: three-quarter turns · top: looking down at the parting. */
export type CapturePhotos = { front: Uint8Array; right?: Uint8Array; left?: Uint8Array; top?: Uint8Array };

export type CaptureOptions = {
  sessionId: string;
  consentAt: string;
  consentVersion: string;
  skinBaseline: boolean;
  fitzpatrick: boolean;
  source: "live" | "replay";
  now?: () => string;
  newId?: () => string;
};

export type StepKey = "skinTone" | "faceAttr" | "hairType" | "hairLength" | "hairDensity" | "fitzpatrick" | "skinAnalysis";

export type CaptureEvent =
  | { type: "step"; key: StepKey; status: "running" | "done" | "failed" | "skipped"; detail?: string; units?: number }
  | { type: "retake"; key: StepKey; message: string }
  | { type: "done"; likeness: Likeness; taskIds: string[]; units: number };

export const FACE_FEATURES = ["eyebrowShape", "eyebrowThickness", "eyebrowColor", "faceShape"] as const;
export const SKIN_CONCERNS = ["hd_moisture", "hd_redness", "hd_radiance", "hd_texture", "hd_oiliness"] as const;

/** Simple async channel so parallel tasks can stream events in completion order. */
function channel<T>() {
  const queue: T[] = [];
  let wake: (() => void) | null = null;
  return {
    push(v: T) {
      queue.push(v);
      wake?.();
      wake = null;
    },
    async next(): Promise<T> {
      while (!queue.length) await new Promise<void>((r) => (wake = r));
      return queue.shift()!;
    },
  };
}

export async function* captureLikeness(yc: YouCam, photos: CapturePhotos, opts: CaptureOptions): AsyncGenerator<CaptureEvent> {
  const now = opts.now ?? (() => new Date().toISOString());
  const ids: Record<"front" | "right" | "left" | "face" | "top", string | null> = { front: null, right: null, left: null, face: null, top: null };
  ids.front = (await yc.upload(photos.front, "image/jpeg", "front.jpg")).fileId;
  const preTaskIds: string[] = [];

  // Colour and brow readings need the face to fill most of the frame; hair readings need
  // the whole head. YouCam's free pre-process step finds the face; Kept crops to it.
  const pre = await yc.run("facePre", { src_file_id: ids.front }, { sessionId: opts.sessionId });
  preTaskIds.push(pre.taskId);
  const box = parseFaceBoxes(pre.results)[0];
  if (!box) {
    yield { type: "retake", key: "skinTone", message: "We couldn't find a face. Face the camera with your whole face in view." };
  } else {
    ids.face = (await yc.upload(await cropToFace(photos.front, box), "image/jpeg", "face.jpg")).fileId;
  }
  // YouCam's hair-colour attribute is a six-family classifier; for matching wigs Kept reads
  // the shade itself from the band of hair above the face YouCam found.
  const hairSample = box ? await sampleHairFromBox(photos.front, box) : null;
  const hairSampleAt = now();
  if (photos.top) ids.top = (await yc.upload(photos.top, "image/jpeg", "top.jpg")).fileId;
  if (photos.right && photos.left) {
    ids.right = (await yc.upload(photos.right, "image/jpeg", "right.jpg")).fileId;
    ids.left = (await yc.upload(photos.left, "image/jpeg", "left.jpg")).fileId;
  }

  type Job = { key: StepKey; feature: FeatureKey; body: Record<string, unknown> };
  const jobs: Job[] = [
    ...(ids.face
      ? [
          { key: "skinTone" as const, feature: "skinTone" as const, body: { src_file_id: ids.face } },
          { key: "faceAttr" as const, feature: "faceAttr" as const, body: { src_file_id: ids.face, features: [...FACE_FEATURES] } },
        ]
      : []),
    { key: "hairLength", feature: "hairLength", body: { src_file_id: ids.front } },
  ];
  // Density is read from above, looking at the parting.
  if (ids.top) jobs.push({ key: "hairDensity", feature: "hairDensity", body: { src_file_id: ids.top } });
  if (ids.right && ids.left) jobs.push({ key: "hairType", feature: "hairType", body: { src_file_ids: [ids.front, ids.right, ids.left] } });
  if (opts.fitzpatrick && ids.face) jobs.push({ key: "fitzpatrick", feature: "fitzpatrick", body: { src_file_id: ids.face, version: "1.0" } });
  if (opts.skinBaseline && ids.face) jobs.push({ key: "skinAnalysis", feature: "skinAnalysis", body: { src_file_id: ids.face, dst_actions: [...SKIN_CONCERNS], format: "json" } });

  const results = new Map<StepKey, TaskOutcome & { at: string }>();
  const taskIds: string[] = [];
  const ch = channel<CaptureEvent | null>();
  let budgetStopped = false;
  let next = 0;

  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      if (budgetStopped) {
        ch.push({ type: "step", key: job.key, status: "skipped", detail: "unit budget reached" });
        continue;
      }
      ch.push({ type: "step", key: job.key, status: "running" });
      try {
        const out = await yc.run(job.feature, job.body, { sessionId: opts.sessionId });
        taskIds.push(out.taskId);
        results.set(job.key, { ...out, at: now() });
        ch.push({ type: "step", key: job.key, status: "done", units: out.units });
      } catch (e) {
        if (e instanceof BudgetError) {
          budgetStopped = true;
          ch.push({ type: "step", key: job.key, status: "skipped", detail: e.message });
        } else if (e instanceof YouCamTaskError) {
          if (e.taskId) taskIds.push(e.taskId);
          ch.push({ type: "step", key: job.key, status: "failed", detail: e.code });
          if (e.retake) ch.push({ type: "retake", key: job.key, message: e.retake });
        } else {
          ch.push({ type: "step", key: job.key, status: "failed", detail: e instanceof Error ? e.message : "error" });
        }
      }
    }
  }

  const all = Promise.all([worker(), worker(), worker()]).then(() => ch.push(null));
  for (let ev = await ch.next(); ev !== null; ev = await ch.next()) yield ev;
  await all;

  const prov = (key: StepKey): Provenance => {
    const r = results.get(key)!;
    return { api: r.api, version: r.version, taskId: r.taskId, units: r.units, at: r.at, source: opts.source };
  };
  const m = <T,>(key: StepKey, value: T | null) => (value === null || !results.has(key) ? null : { value, prov: prov(key) });

  const tone = results.has("skinTone") ? parseSkinTone(results.get("skinTone")!.results) : null;
  const face = results.has("faceAttr") ? parseFaceAttr(results.get("faceAttr")!.results) : null;

  const browHex = tone?.brows ?? face?.brows ?? null;
  const browFrom: StepKey = tone?.brows ? "skinTone" : "faceAttr";

  const body: Omit<Likeness, "status"> = {
    id: opts.newId?.() ?? crypto.randomUUID(),
    createdAt: now(),
    consent: { at: opts.consentAt, textVersion: opts.consentVersion },
    hair: {
      color: hairSample
        ? { value: { hex: hairSample.hex, name: hairSample.name }, prov: { api: "kept-hair-sampler", version: "1.0", taskId: pre.taskId, units: 0, at: hairSampleAt, source: opts.source } }
        : null,
      type: m("hairType", results.has("hairType") ? parseHairType(results.get("hairType")!.results) : null),
      length: m("hairLength", results.has("hairLength") ? parseHairLength(results.get("hairLength")!.results) : null),
      density: m("hairDensity", results.has("hairDensity") ? parseHairDensity(results.get("hairDensity")!.results) : null),
      frizz: null,
    },
    brows: {
      color: m(browFrom, browHex ? { hex: browHex } : null),
      shape: m("faceAttr", face?.browShape ?? null),
    },
    skin: {
      tone: m("skinTone", tone?.skin ? { hex: tone.skin } : null),
      fitzpatrick: m("fitzpatrick", results.has("fitzpatrick") ? parseFitzpatrick(results.get("fitzpatrick")!.results) : null),
      baseline: m("skinAnalysis", results.has("skinAnalysis") ? parseSkinScores(results.get("skinAnalysis")!.results) : null),
    },
    eyes: m("skinTone", tone?.eyes ? { hex: tone.eyes, name: tone.eyesName } : null),
    lips: m("skinTone", tone?.lips ? { hex: tone.lips } : null),
    face: m("faceAttr", face?.faceShape ? { shape: face.faceShape } : null),
  };

  const units = [...results.values()].reduce((s, r) => s + r.units, 0);
  yield { type: "done", likeness: { ...body, status: isComplete(body) ? "complete" : "incomplete" }, taskIds, units };

  // Privacy: the photos only needed to exist while they were measured.
  await Promise.allSettled([...preTaskIds, ...taskIds].map((id) => yc.deleteTask(id)));
}
