"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Before } from "@/components/app/Before";
import { Button, Card, Note, Row, Swatch, Title } from "@/components/app/ui";
import { postForm } from "@/lib/client/api";
import { db, getSettings } from "@/lib/client/db";
import { b64ToBlob, demoPhoto, toJpeg } from "@/lib/client/images";

type Verify = { measuredHex: string | null; deltaE: number | null; units?: number; source: string };

export default function BrowsPage() {
  const settings = useLiveQuery(getSettings, []);
  const stored = useLiveQuery(() => db.likeness.get("current"), []);
  const todayPhoto = useLiveQuery(() => db.photos.get("today"), []);
  const lastRender = useLiveQuery(() => db.renders.get("brows"), []);
  const [todayUrl, setTodayUrl] = useState<string | null>(null);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [verify, setVerify] = useState<Verify | null>(null);
  const [busy, setBusy] = useState<"render" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brows = stored?.likeness.brows;
  const demo = settings?.mode !== "live";

  useEffect(() => {
    if (!settings || !demo || todayPhoto) return;
    demoPhoto(settings.persona, "today").then((blob) => db.photos.put({ slot: "today", blob, takenAt: new Date().toISOString() }));
  }, [settings, demo, todayPhoto]);

  useEffect(() => {
    if (!todayPhoto) return;
    const u = URL.createObjectURL(todayPhoto.blob);
    setTodayUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [todayPhoto]);

  useEffect(() => {
    if (!lastRender) return;
    const u = URL.createObjectURL(lastRender.blob);
    setRenderUrl(u);
    const v = lastRender.meta.verify as Verify | undefined;
    if (v) setVerify(v);
    return () => URL.revokeObjectURL(u);
  }, [lastRender]);

  async function form(extra: Record<string, string | Blob>) {
    const f = new FormData();
    f.set("mode", settings!.mode);
    f.set("persona", settings!.persona);
    f.set("browHex", brows!.color!.value.hex);
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  }

  async function draw() {
    if (!brows?.color || !settings) return;
    setBusy("render");
    setError(null);
    setVerify(null);
    try {
      const extra: Record<string, string | Blob> = {};
      if (brows.shape) {
        extra.browShape = brows.shape.value.shape;
        extra.browThickness = brows.shape.value.thickness;
      }
      if (!demo) {
        if (!todayPhoto) throw new Error("Add a photo of today first.");
        extra.photo = await toJpeg(todayPhoto.blob, 1600);
      }
      const r = await postForm<{ image: string | null; units?: number; source: string; pattern?: { name: string } }>("/api/tryon/brows", await form(extra));
      if (!r.image) throw new Error("No recorded render in the demo.");
      const blob = b64ToBlob(r.image);
      await db.renders.put({ id: "brows", kind: "brows", blob, label: "Brows and lashes", createdAt: new Date().toISOString(), meta: { source: r.source, pattern: r.pattern ?? null } });
      await db.receipts.add({ at: new Date().toISOString(), kind: "tool", name: "YouCam Makeup VTO", status: "ok", detail: `brows ${brows.color.value.hex}${r.pattern ? `, pattern ${r.pattern.name}` : ""}`, units: r.units ?? 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    if (!lastRender || !brows?.color) return;
    setBusy("verify");
    setError(null);
    try {
      const v = await postForm<Verify>("/api/tryon/verify-brows", await form(demo ? {} : { photo: lastRender.blob }));
      setVerify(v);
      await db.renders.update("brows", { meta: { ...lastRender.meta, verify: v } });
      await db.receipts.add({ at: new Date().toISOString(), kind: "tool", name: "YouCam Face Analyzer", status: "ok", detail: `re-measured brows ΔE ${v.deltaE?.toFixed(1) ?? "n/a"}`, units: v.units ?? 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!brows?.color) return <Title sub="Measure your likeness first — Kept needs your own brow colour and shape.">Your brows</Title>;

  return (
    <>
      <Title sub="When brows and lashes thin, Kept draws them back on today's photo in the colour and shape it measured before treatment — something to copy in the mirror.">Your brows, back</Title>

      <Card title="From your likeness">
        <div className="flex items-center gap-3.5 pb-3">
          <Swatch hex={brows.color.value.hex} kind="brow" />
          <div>
            <div className="font-display text-[22px] font-medium tracking-[-0.025em]">{brows.color.value.hex.toUpperCase()}</div>
            <div className="text-[14px] text-[var(--ink-2)]">{brows.shape ? `${brows.shape.value.shape}, ${brows.shape.value.thickness.toLowerCase()}` : "shape not measured"}</div>
          </div>
        </div>
      </Card>

      <div className="mt-3 overflow-hidden rounded-card border border-[var(--line)] bg-oat-50/70">
        {renderUrl ? (
          <Before before={todayUrl} after={renderUrl} beforeLabel="Today" afterLabel="Your brows" />
        ) : todayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={todayUrl} alt="Today" className="block w-full" />
        ) : (
          <label className="flex aspect-[4/5] cursor-pointer items-center justify-center p-6 text-center text-[15px] text-[var(--ink-2)]">
            Add a photo of today, facing the light
            <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => e.target.files?.[0] && db.photos.put({ slot: "today", blob: e.target.files[0], takenAt: new Date().toISOString() })} />
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Button disabled={busy !== null || !todayUrl} onClick={draw}>{busy === "render" ? "Drawing…" : renderUrl ? "Draw again" : "Draw my brows back"}</Button>
        {renderUrl && (
          <Button variant="ghost" disabled={busy !== null} onClick={check}>{busy === "verify" ? "Re-measuring…" : "Check the colour with YouCam"}</Button>
        )}
      </div>

      {verify && (
        <Card title="Checked">
          <Row k="Measured before treatment" v={brows.color.value.hex.toUpperCase()} />
          <Row k="Re-measured on the drawing" v={verify.measuredHex?.toUpperCase() ?? "—"} />
          <Row k="Difference" v={verify.deltaE === null ? "—" : `ΔE ${verify.deltaE.toFixed(1)}`} />
          <p className="pb-3 text-[13px] leading-[1.5] text-[var(--ink-3)]">
            YouCam's Face Analyzer read the drawn brows back{verify.source === "replay" ? " (recorded demo result)" : ""}. Under about 3 reads as the same colour to the eye.
          </p>
        </Card>
      )}
      {error && <Note>{error}</Note>}
      <Note>A pencil or powder one shade lighter than this colour usually looks softer in daylight. Kept doesn't recommend treatments or brow serums — ask your care team about those.</Note>
    </>
  );
}
