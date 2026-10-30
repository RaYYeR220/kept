"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Note, Title } from "@/components/app/ui";
import { CONSENT_VERSION, updateSettings } from "@/lib/client/db";

export function Welcome() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [live, setLive] = useState(false);
  const [date, setDate] = useState("");

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((s) => setLive(Boolean(s.live))).catch(() => setLive(false));
  }, []);

  async function start(mode: "replay" | "live") {
    await updateSettings({
      consentAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
      mode,
      persona: "anna",
      plan: date ? { firstInfusion: date, cycleDays: 21, cycles: 6 } : mode === "replay" ? { firstInfusion: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10), cycleDays: 21, cycles: 6 } : null,
    });
    router.push("/app/capture");
  }

  return (
    <>
      <Title sub="Kept keeps a measured record of how you look now, so every choice during treatment can start from you.">Before we measure anything</Title>
      <Card title="What happens">
        <ul className="space-y-3 pb-4 text-[15px] leading-[1.55] text-[var(--ink-2)]">
          <li><b className="font-semibold text-[var(--ink)]">Measured:</b> hair colour family, curl, density and length; brow colour and shape; skin tone.</li>
          <li><b className="font-semibold text-[var(--ink)]">By:</b> YouCam AI from Perfect Corp, on their servers in the US. Kept deletes each measurement there as soon as it has read the result.</li>
          <li><b className="font-semibold text-[var(--ink)]">Kept here:</b> your photos and measurements stay in this browser. You can delete everything in one tap.</li>
          <li><b className="font-semibold text-[var(--ink)]">Not medical:</b> Kept helps with appearance only. Questions about treatment, medicines or symptoms go to your care team.</li>
        </ul>
      </Card>
      <label className="mt-4 flex items-start gap-3 text-[15px] leading-[1.5]">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 accent-[#1c1814]" />
        <span>I'm an adult, and I agree that photos of my face can be processed by YouCam to measure my hair, brows and skin as described.</span>
      </label>
      <label className="mt-5 block text-[15px] font-medium">
        First infusion date <span className="font-normal text-[var(--ink-3)]">(optional — used to time the plan)</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 block h-12 w-full rounded-[14px] border border-[var(--line)] bg-oat-50 px-4 text-[16px]" />
      </label>
      <div className="mt-6 flex flex-col gap-3">
        <Button disabled={!agree} onClick={() => start("replay")}>Try with Anna, a demo person</Button>
        <Button variant="ghost" disabled={!agree || !live} onClick={() => start("live")}>Use my own photos</Button>
      </div>
      <Note>Anna is a synthetic person made for this demo. Her measurements are recorded results from the real YouCam APIs, replayed so you can explore without a camera. {live ? "" : "Live measuring is switched off on this deployment."}</Note>
    </>
  );
}
