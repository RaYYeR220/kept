"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, Note, Title } from "@/components/app/ui";
import { db, wipeAll } from "@/lib/client/db";

export default function PrivacyPage() {
  const router = useRouter();
  const counts = useLiveQuery(async () => ({
    photos: await db.photos.count(),
    renders: await db.renders.count(),
    shares: await db.shares.filter((s) => !s.revoked).count(),
    receipts: await db.receipts.count(),
  }), []);
  const receipts = useLiveQuery(() => db.receipts.orderBy("at").reverse().limit(20).toArray(), [], []);
  const [sure, setSure] = useState(false);

  async function wipe() {
    for (const s of await db.shares.toArray()) if (!s.revoked) await fetch(`/api/share/${s.token}`, { method: "DELETE" });
    await wipeAll();
    router.push("/");
  }

  return (
    <>
      <Title sub="Everything Kept knows about you is in this browser. Measurement photos were deleted from YouCam as soon as they were read.">Your data</Title>
      <Card title="Stored on this phone">
        <ul className="pb-3 text-[15px]">
          <li className="flex justify-between border-t border-[var(--line)] py-2.5 first:border-t-0"><span>Photos</span><b>{counts?.photos ?? 0}</b></li>
          <li className="flex justify-between border-t border-[var(--line)] py-2.5"><span>Try-on images</span><b>{counts?.renders ?? 0}</b></li>
          <li className="flex justify-between border-t border-[var(--line)] py-2.5"><span>Active share links</span><b>{counts?.shares ?? 0}</b></li>
        </ul>
      </Card>
      <Card title="Recent activity">
        <ul className="pb-2">
          {receipts?.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 border-t border-[var(--line)] py-2 text-[13px] first:border-t-0">
              <span className="font-semibold">{r.name}</span>
              <span className="text-right text-[var(--ink-3)]">{r.detail}{r.units ? ` · ${r.units}u` : ""}</span>
            </li>
          ))}
        </ul>
      </Card>
      <label className="mt-5 flex items-start gap-3 text-[15px] leading-[1.5]">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 h-5 w-5 accent-[#1c1814]" />
        <span>Delete my photos, likeness, try-ons, conversation and withdraw every share link.</span>
      </label>
      <Button className="mt-4 w-full" disabled={!sure} onClick={wipe}>Delete everything</Button>
      <Note>This can't be undone. Kept keeps no account and no copy on its server.</Note>
    </>
  );
}
