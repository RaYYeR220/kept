// Records demo-persona fixtures from live YouCam calls. Usage:
//   tsx record.ts capture <persona>
//   tsx record.ts brows <persona>
//   tsx record.ts wig <persona> <listingId> <imageUrl>
//   tsx record.ts hat <persona> <listingId> <imageUrl>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createYouCam } from "@kept/youcam";
import type { Likeness } from "@kept/likeness";
import { captureLikeness, type CaptureEvent } from "../../apps/web/lib/server/capture.ts";
import { calibrateBrows, renderHat, renderWig } from "../../apps/web/lib/server/tryon.ts";
import { sampleHair } from "../../apps/web/lib/server/sample.ts";

const [cmd, persona = "anna", ...rest] = process.argv.slice(2);
const dir = new URL(`../../apps/web/fixtures/replay/${persona}/`, import.meta.url);
mkdirSync(new URL("renders/", dir), { recursive: true });
const photo = (slot: string) => new Uint8Array(readFileSync(new URL(`../../apps/web/public/demo/${persona}-${slot}.jpg`, import.meta.url)));
const yc = createYouCam({ apiKey: process.env.YOUCAM_API_KEY! });
const at = () => new Date().toISOString();
const save = (name: string, data: unknown) => writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(data, null, 1));
const saveImg = (name: string, img: Uint8Array) => writeFileSync(new URL(`renders/${name}.jpg`, dir), img);

// Recorded values were measured live; in the app they are replayed, and say so.
const asReplay = (l: Likeness): Likeness => JSON.parse(JSON.stringify(l).replaceAll('"source":"live"', '"source":"replay"'));

if (cmd === "capture") {
  const events: CaptureEvent[] = [];
  for await (const ev of captureLikeness(yc, { front: photo("front"), right: photo("right"), left: photo("left"), top: photo("top") }, {
    sessionId: "record",
    consentAt: at(),
    consentVersion: "2026-10-30",
    skinBaseline: false,
    fitzpatrick: true,
    source: "live",
  })) {
    console.log(ev.type, "key" in ev ? ev.key : "", "status" in ev ? ev.status : "", "detail" in ev ? ev.detail ?? "" : "", "units" in ev ? ev.units ?? "" : "");
    events.push(ev.type === "done" ? { ...ev, likeness: asReplay(ev.likeness) } : ev);
  }
  save("capture", { recordedAt: at(), events });
  const done = events.at(-1);
  if (done?.type === "done") console.log(JSON.stringify(done.likeness, null, 1).slice(0, 2500));
} else if (cmd === "brows") {
  const cap = JSON.parse(readFileSync(new URL("capture.json", dir), "utf8")) as { events: CaptureEvent[] };
  const done = cap.events.at(-1);
  if (done?.type !== "done" || !done.likeness.brows.color) throw new Error("capture first");
  const brows = { hex: done.likeness.brows.color.value.hex, shape: done.likeness.brows.shape?.value ?? null };
  const c = await calibrateBrows(yc, photo("during"), brows, "record");
  saveImg("brows", c.best.image);
  save("brows", { recordedAt: at(), units: c.units, api: "makeup-vto", pattern: c.best.pattern, rounds: c.rounds, deltaE: c.best.deltaE, measuredHex: c.best.measuredHex, targetHex: brows.hex });
  save("verify-brows", { recordedAt: at(), measuredHex: c.best.measuredHex, deltaE: c.best.deltaE, units: 0, rounds: c.rounds });
  console.log("rounds", c.rounds, "units", c.units);
} else if (cmd === "resample" || cmd === "density") {
  // Patch an existing capture recording: hair shade from the sampler, or density from a new parting photo.
  const file = new URL("capture.json", dir);
  const cap = JSON.parse(readFileSync(file, "utf8")) as { recordedAt: string; events: CaptureEvent[]; patches?: string[] };
  const done = cap.events.at(-1);
  if (done?.type !== "done") throw new Error("capture first");
  if (cmd === "resample") {
    const s = await sampleHair(yc, photo("front"), "record", false);
    if (!s) throw new Error("no face found");
    done.likeness.hair.color = { value: { hex: s.hex, name: s.name }, prov: { api: "kept-hair-sampler", version: "1.0", taskId: s.taskId, units: 0, at: at(), source: "replay" } };
    console.log("hair", s);
  } else {
    const { fileId } = await yc.upload(photo("top"), "image/jpeg", "top.jpg");
    const r = await yc.run("hairDensity", { src_file_id: fileId });
    await yc.deleteTask(r.taskId).catch(() => {});
    const t = (r.results as { hair_density?: { mapping?: string; term?: string } }).hair_density;
    if (!t?.term) throw new Error("no density");
    done.likeness.hair.density = { value: { mapping: t.mapping ?? null, term: t.term }, prov: { api: "hair-density-detection", version: "v2.0", taskId: r.taskId, units: r.units, at: at(), source: "replay" } };
    cap.events = cap.events.map((e) => (e.type === "step" && e.key === "hairDensity" ? { ...e, status: "done", units: r.units, detail: undefined } : e)).filter((e) => !(e.type === "retake" && e.key === "hairDensity"));
    console.log("density", t);
  }
  cap.patches = [...(cap.patches ?? []), `${cmd} ${at()}`];
  writeFileSync(file, JSON.stringify(cap, null, 1));
} else if (cmd === "wig" || cmd === "hat") {
  const [listingId, imageUrl] = rest;
  if (!listingId || !imageUrl) throw new Error("listingId and imageUrl required");
  const key = `${cmd}-${listingId.replace(/[^a-z0-9]/gi, "").slice(-12)}`;
  const r = cmd === "wig" ? await renderWig(yc, photo("front"), imageUrl, "record") : await renderHat(yc, photo("during"), imageUrl, persona === "marcus" ? "male" : "female", "record");
  saveImg(key, r.image);
  if (cmd === "hat") saveImg("hat", r.image);
  save(key, { recordedAt: at(), units: r.units, api: r.api, listingId, imageUrl });
  if (cmd === "hat") save("hat", { recordedAt: at(), units: r.units, api: r.api, listingId, imageUrl });
  console.log(cmd, key, r.units);
}
console.log("credit now", await yc.credit());
