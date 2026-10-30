"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Note, Title } from "@/components/app/ui";
import { db, getSettings, type StoredMessage } from "@/lib/client/db";
import { b64ToBlob, toJpeg } from "@/lib/client/images";

type Receipt = { at: string; kind: "tool" | "gate"; name: string; status: string; detail: string; units?: number };
type Turn =
  | { kind: "refusal"; scope: "medical" | "urgent"; card: { title: string; body: string }; receipts: Receipt[] }
  | { kind: "reply"; text: string; renders: string[]; checkouts: string[]; receipts: Receipt[] };
type Listing = { listingId: string; imageUrl: string; variantId: string; shopDomain: string };

const SUGGESTIONS = ["Which wig would match me best?", "Show me my brows back", "A soft cap for sleeping, in a colour that suits me", "Can I use retinol on paclitaxel?"];

const GATE_LABEL: Record<string, string> = {
  scope: "Medical question → care team",
  lint: "Removed a medical claim",
  product: "Product blocked by a rule",
  spend: "Payment refused — you pay at the store",
  photo: "Refused an unapproved field",
  budget: "Unit budget reached",
};

export default function AskPage() {
  const settings = useLiveQuery(getSettings, []);
  const stored = useLiveQuery(() => db.likeness.get("current"), []);
  const messages = useLiveQuery(() => db.messages.orderBy("at").toArray(), [], [] as StoredMessage[]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const listings = useRef<Listing[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages?.length, busy]);

  async function send(content: string) {
    if (!content.trim() || !settings) return;
    setBusy(true);
    setText("");
    await db.messages.add({ role: "user", content, at: new Date().toISOString() });
    const prior: Array<Pick<StoredMessage, "role" | "content" | "card">> = [...(messages ?? []), { role: "user", content }];
    const history = prior.slice(-12).map((m) => ({ role: m.role, content: m.card ? `${m.card.title}. ${m.card.body}` : m.content }));
    const form = new FormData();
    form.set("body", JSON.stringify({ messages: history, likeness: stored?.likeness ?? null, plan: settings.plan, mode: settings.mode, persona: settings.persona, listings: listings.current }));
    if (settings.mode === "live") {
      const front = await db.photos.get("front");
      const today = await db.photos.get("today");
      if (front) form.set("before", await toJpeg(front.blob, 1024), "before.jpg");
      if (today) form.set("today", await toJpeg(today.blob, 1600), "today.jpg");
    }
    try {
      const res = await fetch("/api/companion", { method: "POST", body: form });
      const body = (await res.json()) as { turn?: Turn; renders?: Record<string, string>; listings?: Listing[]; error?: string };
      if (!res.ok || !body.turn) throw new Error(body.error ?? "The Companion isn't available right now.");
      listings.current = body.listings ?? listings.current;
      const imgs = Object.fromEntries(Object.entries(body.renders ?? {}).map(([k, v]) => [k, URL.createObjectURL(b64ToBlob(v))]));
      setImages((x) => ({ ...x, ...imgs }));
      setReceipts((r) => [...body.turn!.receipts, ...r].slice(0, 30));
      const t = body.turn;
      await db.messages.add(
        t.kind === "refusal"
          ? { role: "assistant", content: t.card.body, card: t.card, at: new Date().toISOString() }
          : { role: "assistant", content: t.text, renders: t.renders, checkouts: t.checkouts, at: new Date().toISOString() },
      );
      for (const r of t.receipts) await db.receipts.add({ at: r.at, kind: r.kind, name: r.name, status: r.status, detail: r.detail, units: r.units });
    } catch (e) {
      await db.messages.add({ role: "assistant", content: (e as Error).message, at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Title sub="For how things look: wigs, brows, headwear, colours. Medical questions go to your care team — that rule is checked in code before any AI reads your message.">Ask Kept</Title>

      <div className="space-y-3">
        {messages?.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="ml-10 rounded-[22px] rounded-br-md bg-oat-900 px-4 py-3 text-[15px] leading-[1.5] text-oat-50">{m.content}</p>
          ) : m.card ? (
            <div key={m.id} className="mr-6 rounded-[22px] border border-hair/30 bg-oat-50 px-4 py-3">
              <p className="font-display text-[18px] font-medium tracking-[-0.02em]">{m.card.title}</p>
              <p className="mt-1.5 text-[15px] leading-[1.55] text-[var(--ink-2)]">{m.card.body}</p>
            </div>
          ) : (
            <div key={m.id} className="mr-6 rounded-[22px] rounded-bl-md border border-[var(--line)] bg-oat-50/80 px-4 py-3 text-[15px] leading-[1.55]">
              <p className="whitespace-pre-line">{m.content}</p>
              {m.renders?.map((r) =>
                images[r] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={r} src={images[r]} alt="Try-on" className="mt-3 w-full rounded-[16px]" />
                ) : null,
              )}
              {m.checkouts?.map((c) => (
                <a key={c} href={c} target="_blank" rel="noreferrer" className="mt-3 flex h-11 items-center justify-center rounded-chip bg-oat-900 text-[15px] font-semibold text-oat-50">
                  Review & pay at the store
                </a>
              ))}
            </div>
          ),
        )}
        {busy && <p className="mr-6 text-[14px] text-[var(--ink-3)]">Thinking…</p>}
        <div ref={end} />
      </div>

      {!messages?.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-chip border border-[var(--line)] bg-oat-50/70 px-3.5 py-2 text-left text-[14px]">{s}</button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about wigs, brows, colours…" className="h-12 flex-1 rounded-chip border border-[var(--line)] bg-oat-50 px-4 text-[16px]" aria-label="Message" />
        <Button type="submit" disabled={busy || !text.trim()} className="h-12 px-5 text-[15px]">Send</Button>
      </form>

      {receipts.length > 0 && (
        <details className="mt-5 rounded-card border border-[var(--line)] bg-oat-50/60 px-4 py-3" open>
          <summary className="cursor-pointer text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">What happened behind this answer</summary>
          <ul className="mt-2">
            {receipts.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 border-t border-[var(--line)] py-2 text-[13px] first:border-t-0">
                <span className={r.kind === "gate" ? "font-semibold text-block" : "font-semibold"}>{r.kind === "gate" ? GATE_LABEL[r.name] ?? r.name : r.name}</span>
                <span className="text-right text-[var(--ink-3)]">{r.detail}{r.units ? ` · ${r.units}u` : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Note>Replies come from a language model. Kept checks every reply for medical claims before you see it.</Note>
    </>
  );
}
