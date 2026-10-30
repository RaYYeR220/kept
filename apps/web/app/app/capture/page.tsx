"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import type { Likeness } from "@kept/likeness";
import { Button, Card, Note, Title, apiName } from "@/components/app/ui";
import { readEvents } from "@/lib/client/api";
import { db, getSettings, type PhotoSlot } from "@/lib/client/db";
import { demoPhoto, toJpeg } from "@/lib/client/images";

const SLOTS: Array<{ slot: Exclude<PhotoSlot, "today">; title: string; hint: string }> = [
  { slot: "front", title: "Straight on", hint: "Face the light, hair down as you usually wear it, shoulders in the frame." },
  { slot: "right", title: "Turn a little right", hint: "Same light, head turned about a third of the way." },
  { slot: "left", title: "Turn a little left", hint: "Same again, the other way." },
];

const STEP_API: Record<string, string> = {
  skinTone: "skin-tone-analysis",
  faceAttr: "face-attr-analysis",
  hairType: "hair-type-detection",
  hairLength: "hair-length-detection",
  hairDensity: "hair-density-detection",
  fitzpatrick: "fitzpatrick-scale-analyzer",
  skinAnalysis: "skin-analysis",
};
const STEP_WHAT: Record<string, string> = {
  skinTone: "skin, brow and hair colour",
  faceAttr: "brow shape and thickness, face shape",
  hairType: "curl pattern from three angles",
  hairLength: "length",
  hairDensity: "density",
  fitzpatrick: "skin type",
  skinAnalysis: "skin baseline",
};

type Step = { key: string; status: string; detail?: string; units?: number };

export default function Capture() {
  const router = useRouter();
  const settings = useLiveQuery(getSettings, []);
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, Blob>>>({});
  const [urls, setUrls] = useState<Partial<Record<PhotoSlot, string>>>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [retakes, setRetakes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demo = settings?.mode !== "live";

  useEffect(() => {
    if (!settings || !demo) return;
    Promise.all(SLOTS.map(async ({ slot }) => [slot, await demoPhoto(settings.persona, slot)] as const)).then((pairs) => setPhotos(Object.fromEntries(pairs)));
  }, [settings, demo]);

  useEffect(() => {
    const next = Object.fromEntries(Object.entries(photos).map(([k, b]) => [k, URL.createObjectURL(b!)]));
    setUrls(next);
    return () => Object.values(next).forEach((u) => URL.revokeObjectURL(u!));
  }, [photos]);

  async function pick(slot: PhotoSlot, file: File | undefined) {
    if (!file) return;
    setPhotos((p) => ({ ...p, [slot]: file }));
  }

  async function measure() {
    if (!settings?.consentAt || !photos.front) return;
    setBusy(true);
    setError(null);
    setSteps([]);
    setRetakes([]);
    const form = new FormData();
    form.set("mode", demo ? "replay" : "live");
    form.set("persona", settings.persona);
    form.set("consentAt", settings.consentAt);
    form.set("consentVersion", settings.consentVersion);
    if (!demo) {
      for (const { slot } of SLOTS) if (photos[slot]) form.set(slot, await toJpeg(photos[slot]!, 1600), `${slot}.jpg`);
    }
    try {
      const res = await fetch("/api/capture", { method: "POST", body: form });
      await readEvents(res, async (ev) => {
        if (ev.type === "step") {
          setSteps((s) => [...s.filter((x) => x.key !== ev.key), ev as unknown as Step]);
        } else if (ev.type === "retake") {
          setRetakes((r) => [...r, String(ev.message)]);
        } else if (ev.type === "error") {
          setError(String(ev.message));
        } else if (ev.type === "done") {
          const likeness = ev.likeness as Likeness;
          await db.transaction("rw", [db.likeness, db.photos, db.receipts], async () => {
            await db.likeness.put({ id: "current", likeness, taskIds: ev.taskIds as string[], units: Number(ev.units) });
            const at = new Date().toISOString();
            for (const { slot } of SLOTS) if (photos[slot]) await db.photos.put({ slot, blob: photos[slot]!, takenAt: at });
            await db.receipts.add({ at, kind: "measure", name: "likeness", status: likeness.status, detail: `${Object.keys(STEP_API).length} YouCam measurements`, units: Number(ev.units) });
          });
          if (likeness.status === "complete") router.push("/app/likeness");
        }
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return null;
  const ready = Boolean(photos.front && (demo || (photos.right && photos.left)));

  return (
    <>
      <Title sub={demo ? "Anna is a synthetic person. These three photos were generated for the demo; her measurements replay real recorded YouCam results." : "Three photos in the same light. They stay on this phone; YouCam measures them and Kept deletes them there straight after."}>
        {demo ? "Anna's three photos" : "Three photos"}
      </Title>
      <div className="grid grid-cols-3 gap-2.5">
        {SLOTS.map(({ slot, title, hint }) => (
          <label key={slot} className={`group relative block aspect-[3/4] overflow-hidden rounded-[22px] border border-[var(--line)] bg-oat-50/70 ${demo ? "" : "cursor-pointer"}`}>
            {urls[slot] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[slot]} alt={title} className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col justify-end p-3 text-[13px] leading-snug text-[var(--ink-2)]">
                <b className="mb-1 text-[14px] font-semibold text-[var(--ink)]">{title}</b>
                {hint}
              </span>
            )}
            {!demo && <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => pick(slot, e.target.files?.[0])} />}
          </label>
        ))}
      </div>

      <div className="mt-5">
        <Button className="w-full" disabled={!ready || busy} onClick={measure}>
          {busy ? "Measuring…" : demo ? "Measure Anna" : "Measure my likeness"}
        </Button>
      </div>

      {steps.length > 0 && (
        <Card title="YouCam measurements">
          <ul className="pb-3">
            {Object.keys(STEP_API).filter((k) => steps.some((s) => s.key === k)).map((k) => {
              const s = steps.find((x) => x.key === k)!;
              return (
                <li key={k} className="flex items-center justify-between gap-3 border-t border-[var(--line)] py-2.5 first:border-t-0">
                  <span>
                    <span className="block text-[15px] font-semibold">{apiName(STEP_API[k]!)}</span>
                    <span className="block text-[13px] text-[var(--ink-3)]">{STEP_WHAT[k]}</span>
                  </span>
                  <span className={`text-[13px] font-semibold tabular-nums ${s.status === "done" ? "text-ok" : s.status === "failed" ? "text-block" : "text-[var(--ink-3)]"}`}>
                    {s.status === "done" ? `✓ ${s.units ?? ""} units` : s.status === "running" ? "measuring…" : s.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {retakes.length > 0 && (
        <Card title="One more try">
          <ul className="space-y-2 pb-4 text-[15px] leading-[1.5]">{[...new Set(retakes)].map((r) => <li key={r}>{r}</li>)}</ul>
        </Card>
      )}
      {error && <Note>{error}</Note>}
    </>
  );
}
