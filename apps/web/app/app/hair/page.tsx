"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { rankWigs, type RankedWig } from "@kept/likeness";
import type { ShopWig } from "@kept/shop";
import { Before } from "@/components/app/Before";
import { Button, Card, Note, Swatch, Title } from "@/components/app/ui";
import { postForm } from "@/lib/client/api";
import { db, getSettings } from "@/lib/client/db";
import { b64ToBlob, toJpeg } from "@/lib/client/images";

type Wig = RankedWig & ShopWig & { sampledName?: string; recordedTryOn?: boolean };
const BAND_LABEL: Record<RankedWig["band"], string> = { close: "Close to your colour", near: "Near your colour", far: "Different colour", unmeasured: "Colour not measured" };
const money = (minor: number | null, cur: string | null) => (minor === null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur ?? "USD" }).format(minor / 100));

export default function HairPage() {
  const settings = useLiveQuery(getSettings, []);
  const stored = useLiveQuery(() => db.likeness.get("current"), []);
  const [wigs, setWigs] = useState<Wig[] | null>(null);
  const [medical, setMedical] = useState(true);
  const [measuring, setMeasuring] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<Record<string, string>>({});
  const [checkout, setCheckout] = useState<Record<string, string>>({});
  const hair = stored?.likeness.hair;

  async function search() {
    if (!hair || !settings) return;
    setError(null);
    setWigs(null);
    const q = new URLSearchParams({ family: hair.color?.value.name ?? "", hex: hair.color?.value.hex ?? "", texture: hair.type?.value.term ?? "", medical: medical ? "1" : "0", mode: settings.mode, persona: settings.persona });
    const res = await fetch(`/api/wigs?${q}`);
    const body = await res.json();
    if (!res.ok) return setError(body.error);
    const found = body.wigs as Wig[];
    setWigs(found);
    // Read each listing photo's hair shade (free), then rank against the person's own.
    setMeasuring(true);
    try {
      const top = found.slice(0, 10);
      const m = await fetch("/api/wigs/measure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listings: top.map((w) => ({ listingId: w.listingId, imageUrl: w.imageUrl })) }) });
      const { results } = (await m.json()) as { results?: Record<string, { hex: string; name: string; at: string } | null> };
      if (!results || !hair?.color) return;
      const measured = found.map((w) => {
        const r = results[w.listingId];
        return r ? { ...w, sampledName: r.name, measured: { value: { hex: r.hex }, prov: { api: "kept-hair-sampler", version: "1.0", taskId: null, units: 0, at: r.at, source: "live" as const } } } : w;
      });
      setWigs(rankWigs({ hex: hair.color.value.hex, texture: hair.type?.value.term ?? null, lengthIn: null }, measured) as Wig[]);
    } finally {
      setMeasuring(false);
    }
  }

  useEffect(() => {
    if (hair && settings && wigs === null) void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hair?.color?.value.hex, settings?.mode]);

  async function tryOn(w: Wig) {
    if (!settings) return;
    setBusy(w.listingId);
    setError(null);
    try {
      const form = new FormData();
      form.set("mode", settings.mode);
      form.set("persona", settings.persona);
      form.set("ref", w.imageUrl);
      form.set("listing", w.listingId);
      if (settings.mode === "live") {
        const front = await db.photos.get("front");
        if (!front) throw new Error("Your before photo is missing — measure your likeness first.");
        form.set("photo", await toJpeg(front.blob, 1024), "front.jpg");
      }
      const r = await postForm<{ image: string | null; units?: number; source: string }>("/api/tryon/wig", form);
      if (!r.image) throw new Error("No recorded try-on for this listing in the demo. Live mode can render any listing.");
      const blob = b64ToBlob(r.image);
      setRenders((x) => ({ ...x, [w.listingId]: URL.createObjectURL(blob) }));
      await db.renders.put({ id: `wig-${w.listingId}`, kind: "wig", blob, label: w.title, createdAt: new Date().toISOString(), meta: { listingId: w.listingId, source: r.source } });
      await db.receipts.add({ at: new Date().toISOString(), kind: "tool", name: "YouCam Hairstyle", status: "ok", detail: w.title.slice(0, 60), units: r.units ?? 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function review(w: Wig) {
    setBusy(`co-${w.listingId}`);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shopDomain: w.shopDomain, variantId: w.variantId }) });
      const body = await res.json();
      const url = body.continueUrl ?? w.cartUrl;
      if (url) setCheckout((c) => ({ ...c, [w.listingId]: url }));
      else setError(body.error ?? "Couldn't prepare a checkout.");
    } finally {
      setBusy(null);
    }
  }

  if (!hair) return <Title sub="Measure your likeness first.">Choose your hair</Title>;

  return (
    <>
      <Title sub="Real wigs from Shopify stores, ranked against your measured hair. Try any of them on your own before photo.">Choose your hair</Title>
      <Card title="Matching to">
        <div className="flex items-center gap-3 pb-4">
          {hair.color && <Swatch hex={hair.color.value.hex} kind="hair" size={44} />}
          <div className="text-[15px] leading-snug text-[var(--ink-2)]">
            <b className="block font-display text-[19px] font-medium text-[var(--ink)]">{hair.color?.value.name ?? "Your hair"}{hair.type ? ` · ${hair.type.value.mapping ?? hair.type.value.term}` : ""}</b>
            {hair.length ? `${hair.length.value.term}` : ""}
            {hair.density ? ` · ${hair.density.value.term.toLowerCase()}` : ""}
          </div>
        </div>
      </Card>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => setMedical(true)} className={`h-10 rounded-chip px-4 text-[14px] font-semibold ${medical ? "bg-oat-900 text-oat-50" : "border border-[var(--line)]"}`}>Comfort / medical caps</button>
        <button onClick={() => setMedical(false)} className={`h-10 rounded-chip px-4 text-[14px] font-semibold ${!medical ? "bg-oat-900 text-oat-50" : "border border-[var(--line)]"}`}>All human-hair wigs</button>
        <button onClick={search} className="ml-auto text-[14px] font-medium underline underline-offset-4">Search</button>
      </div>

      {wigs === null && !error && <Note>Searching the Shop catalogue…</Note>}
      {measuring && <Note>Reading the hair colour on each listing photo…</Note>}
      {error && <Note>{error}</Note>}

      <ul className="mt-2">
        {wigs?.map((w) => (
          <li key={w.listingId} className="mt-3 overflow-hidden rounded-card border border-[var(--line)] bg-oat-50/70">
            <div className="flex gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.imageUrl} alt="" className="h-28 w-24 flex-none rounded-[18px] object-cover" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                {w.recordedTryOn && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-hair">Recorded try-on in the demo</p>}
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{w.title}</p>
                <p className="mt-1 text-[13px] text-[var(--ink-3)]">{w.sellerName} · {money(w.priceMinor, w.currency)}</p>
                <p className={`mt-2 inline-block rounded-chip px-2.5 py-1 text-[12px] font-semibold ${w.band === "close" ? "bg-ok/15 text-ok" : w.band === "unmeasured" ? "bg-oat-200 text-[var(--ink-2)]" : "bg-caution/15 text-caution"}`}>
                  {BAND_LABEL[w.band]}
                  {w.deltaE !== null ? ` · ΔE ${w.deltaE.toFixed(1)}` : ""}
                </p>
                {w.colourName && <p className="mt-1 text-[12px] text-[var(--ink-3)]">Listed as “{w.colourName}”{w.sampledName ? ` · reads as ${w.sampledName.toLowerCase()}` : ""}{w.texture ? ` · ${w.texture}` : ""}</p>}
              </div>
            </div>
            {renders[w.listingId] && <Before before={null} after={renders[w.listingId]!} afterLabel="On you" />}
            <div className="flex gap-2 border-t border-[var(--line)] p-3">
              <Button variant="ghost" className="h-11 flex-1 text-[15px]" disabled={busy !== null} onClick={() => tryOn(w)}>
                {busy === w.listingId ? "Trying on…" : "Try it on me"}
              </Button>
              {checkout[w.listingId] ? (
                <a href={checkout[w.listingId]} target="_blank" rel="noreferrer" className="inline-flex h-11 flex-1 items-center justify-center rounded-chip bg-oat-900 text-[15px] font-semibold text-oat-50">
                  Review & pay at store
                </a>
              ) : (
                <Button className="h-11 flex-1 text-[15px]" disabled={busy !== null} onClick={() => review(w)}>
                  {busy === `co-${w.listingId}` ? "Preparing…" : "Prepare checkout"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Note>Kept never pays for anything. “Prepare checkout” creates a review-and-pay page at the store; you check it and pay there. Many plans cover a wig for medical hair loss when your doctor writes it as a “cranial prosthesis” — ask your care team.</Note>
    </>
  );
}
