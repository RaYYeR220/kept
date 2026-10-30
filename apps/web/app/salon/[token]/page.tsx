"use client";

import { use, useEffect, useState } from "react";
import type { SharedLikeness } from "@kept/likeness";
import { Mark, Texture } from "@/components/Mark";
import { Card, Note, ProvChip, Row, Swatch } from "@/components/app/ui";

type Item = { id: string; title: string; url: string | null; imageUrl: string; hex: string | null; colourFamily: string | null; source: string; addedAt: string };

export default function SalonView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [share, setShare] = useState<SharedLikeness | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [gone, setGone] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [family, setFamily] = useState("");

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) setGone(b.error);
        else {
          setShare(b.share);
          setItems(b.inventory);
        }
      })
      .catch(() => setGone("Couldn't load this link."));
  }, [token]);

  async function add() {
    const res = await fetch(`/api/salon/${token}/inventory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ title, url: null, imageUrl: image, hex: null, colourFamily: family || null, source: "specialist" }]),
    });
    const b = await res.json();
    if (res.ok) {
      setItems(b.inventory);
      setTitle("");
      setImage("");
      setFamily("");
    }
  }

  const s = share?.summary;
  const target = s?.hair.color?.value.name?.toLowerCase();

  return (
    <>
      <Texture />
      <div className="relative z-[5] mx-auto max-w-[560px] px-[18px] pb-24">
        <div className="flex h-[58px] items-center justify-between">
          <Mark />
          <span className="text-[13px] font-medium text-[var(--ink-3)]">Specialist view</span>
        </div>
        {gone && <p className="mt-10 font-display text-[28px] font-medium tracking-[-0.03em]">{gone}</p>}
        {s && (
          <>
            <h1 className="font-display text-[40px] font-medium leading-none tracking-[-0.045em]">{share!.label ?? "A client"}&apos;s likeness</h1>
            <p className="mt-3 text-[15px] text-[var(--ink-2)]">
              Measured {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · link valid until {new Date(share!.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {share!.photoShared ? " · before photo shared" : " · no photos shared"}
            </p>
            <Card title="Hair">
              {s.hair.color && (
                <div className="flex items-center gap-3.5 pb-3">
                  <Swatch hex={s.hair.color.value.hex} kind="hair" />
                  <div>
                    <div className="font-display text-[22px] font-medium tracking-[-0.025em]">{s.hair.color.value.name} family</div>
                    <ProvChip prov={s.hair.color.prov} />
                  </div>
                </div>
              )}
              {s.hair.type && <Row k="Curl pattern" v={s.hair.type.value.mapping ?? s.hair.type.value.term} prov={s.hair.type.prov} />}
              {s.hair.density && <Row k="Density" v={s.hair.density.value.term.replace(/ Density$/, "")} prov={s.hair.density.prov} />}
              {s.hair.length && <Row k="Length" v={s.hair.length.value.term} prov={s.hair.length.prov} />}
            </Card>
            <Card title="Brows & skin">
              {s.brows.color && <Row k="Brow colour" v={<span className="inline-flex items-center gap-2"><Swatch hex={s.brows.color.value.hex} kind="brow" size={24} />{s.brows.color.value.hex.toUpperCase()}</span>} prov={s.brows.color.prov} />}
              {s.brows.shape && <Row k="Brow shape" v={s.brows.shape.value.shape} prov={s.brows.shape.prov} />}
              {s.skin.tone && <Row k="Skin tone" v={<span className="inline-flex items-center gap-2"><Swatch hex={s.skin.tone.value.hex} size={24} />{s.skin.tone.value.hex.toUpperCase()}</span>} prov={s.skin.tone.prov} />}
            </Card>

            <Card title="Your pieces">
              <ul className="pb-2">
                {items.map((i) => {
                  const match = i.colourFamily && target ? i.colourFamily.toLowerCase() === target : null;
                  return (
                    <li key={i.id} className="flex items-center gap-3 border-t border-[var(--line)] py-3 first:border-t-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.imageUrl} alt="" className="h-14 w-12 rounded-[12px] object-cover" referrerPolicy="no-referrer" />
                      <span className="flex-1 text-[15px] font-medium">{i.title}</span>
                      <span className={`text-[12px] font-semibold ${match ? "text-ok" : match === false ? "text-caution" : "text-[var(--ink-3)]"}`}>
                        {match ? "same colour family" : match === false ? `${i.colourFamily}` : "family not set"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-2 border-t border-[var(--line)] pb-4 pt-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Piece name" className="h-11 w-full rounded-[12px] border border-[var(--line)] bg-oat-50 px-3 text-[15px]" />
                <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Photo link (https://…)" className="h-11 w-full rounded-[12px] border border-[var(--line)] bg-oat-50 px-3 text-[15px]" />
                <select value={family} onChange={(e) => setFamily(e.target.value)} className="h-11 w-full rounded-[12px] border border-[var(--line)] bg-oat-50 px-3 text-[15px]">
                  <option value="">Colour family…</option>
                  {["Black", "Brown", "Blonde", "Auburn", "Red", "Grey/White"].map((f) => <option key={f}>{f}</option>)}
                </select>
                <button disabled={!title || !image.startsWith("https://")} onClick={add} className="h-11 w-full rounded-chip bg-oat-900 text-[15px] font-semibold text-oat-50 disabled:opacity-40">Add piece</button>
              </div>
            </Card>
            <Note>Measurements are by YouCam APIs from Perfect Corp. Kept is a cosmetic tool and shares no medical information.</Note>
          </>
        )}
      </div>
    </>
  );
}
