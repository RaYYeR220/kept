"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, Note, Title } from "@/components/app/ui";
import { postForm } from "@/lib/client/api";
import { db } from "@/lib/client/db";
import { toJpeg } from "@/lib/client/images";

export default function SharePage() {
  const stored = useLiveQuery(() => db.likeness.get("current"), []);
  const list = useLiveQuery(() => db.shares.toArray(), [], []);
  const [withPhoto, setWithPhoto] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create() {
    if (!stored) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("likeness", JSON.stringify(stored.likeness));
      form.set("label", label);
      if (withPhoto) {
        const front = await db.photos.get("front");
        if (front) form.set("photo", await toJpeg(front.blob, 1024), "front.jpg");
      }
      const r = await postForm<{ token: string; expiresAt: string; photoShared: boolean }>("/api/share", form);
      await db.shares.put({ ...r, createdAt: new Date().toISOString(), revoked: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(token: string) {
    await fetch(`/api/share/${token}`, { method: "DELETE" });
    await db.shares.update(token, { revoked: true });
  }

  const link = (t: string) => `${location.origin}/salon/${t}`;

  return (
    <>
      <Title sub="Give your wig specialist your measured likeness, so the fitting starts from you. The link lasts 7 days and you can withdraw it any time.">Share your likeness</Title>
      <Card title="What they'll see">
        <ul className="space-y-2 pb-4 text-[15px] leading-[1.55] text-[var(--ink-2)]">
          <li>Your measured hair, brow and skin values, each with the YouCam API that measured it.</li>
          <li>No photos — unless you add your before photo below, so they can try their own pieces on you.</li>
          <li>Any MCP-capable assistant they use can read the same link.</li>
        </ul>
      </Card>
      <label className="mt-4 block text-[15px] font-medium">
        Name on the link <span className="font-normal text-[var(--ink-3)]">(optional)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} className="mt-2 block h-12 w-full rounded-[14px] border border-[var(--line)] bg-oat-50 px-4 text-[16px]" placeholder="e.g. Anna" />
      </label>
      <label className="mt-4 flex items-start gap-3 text-[15px] leading-[1.5]">
        <input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} className="mt-1 h-5 w-5 accent-[#1c1814]" />
        <span>Also share my before photo, encrypted, for try-ons. It's deleted when the link expires or I withdraw it.</span>
      </label>
      <Button className="mt-5 w-full" disabled={!stored || busy} onClick={create}>{busy ? "Creating…" : "Create a link"}</Button>
      {error && <Note>{error}</Note>}

      {list && list.length > 0 && (
        <Card title="Your links">
          <ul className="pb-2">
            {list.map((s) => (
              <li key={s.token} className="border-t border-[var(--line)] py-3 first:border-t-0">
                <p className="break-all text-[14px] font-medium">{link(s.token)}</p>
                <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                  {s.revoked ? "Withdrawn" : `Until ${new Date(s.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                  {s.photoShared && !s.revoked ? " · includes photo" : ""}
                </p>
                {!s.revoked && (
                  <div className="mt-2 flex gap-4 text-[14px] font-semibold">
                    <button onClick={async () => { await navigator.clipboard.writeText(link(s.token)); setCopied(s.token); }}>{copied === s.token ? "Copied" : "Copy"}</button>
                    <a href={link(s.token)} target="_blank" rel="noreferrer">Open</a>
                    <button className="text-block" onClick={() => withdraw(s.token)}>Withdraw</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
