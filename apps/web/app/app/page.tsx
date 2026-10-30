"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { buildTimeline, TIMELINE_DISCLAIMER } from "@kept/likeness";
import { Welcome } from "@/components/app/Welcome";
import { Card, LinkButton, Note, Swatch, Title } from "@/components/app/ui";
import { db, getSettings } from "@/lib/client/db";

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export default function AppHome() {
  const settings = useLiveQuery(getSettings, []);
  const stored = useLiveQuery(() => db.likeness.get("current"), []);
  if (!settings) return null;
  if (!settings.consentAt) return <Welcome />;
  if (!stored) {
    return (
      <>
        <Title sub="Three photos, about a minute. Best done before your first infusion, while your hair and brows are as you know them.">Save your likeness</Title>
        <LinkButton href="/app/capture" className="w-full">Start measuring</LinkButton>
      </>
    );
  }

  const l = stored.likeness;
  const plan = settings.plan;
  const milestones = plan ? buildTimeline(plan, today()) : null;
  const next = milestones?.find((m) => m.status === "now") ?? milestones?.find((m) => m.status === "upcoming");

  return (
    <>
      <Title sub={settings.mode === "replay" ? "You're looking at Anna's demo likeness — a synthetic person, measured with recorded YouCam results." : undefined}>
        {next ? next.title : "Your likeness is kept"}
      </Title>

      {next && (
        <Card>
          <p className="text-[16px] leading-[1.55] text-[var(--ink-2)]">{next.detail}</p>
          {next.end && (
            <p className="mt-3 font-display text-[28px] font-medium tracking-[-0.03em]">
              {daysBetween(today(), next.end) >= 0 ? `${daysBetween(today(), next.end)} days left` : "Now"}
            </p>
          )}
          <div className="mb-4 mt-4">
            <LinkButton href={next.id === "brows-lashes" ? "/app/brows" : next.id === "capture" ? "/app/likeness" : "/app/hair"} className="w-full">
              {next.id === "brows-lashes" ? "Draw my brows back" : next.id === "capture" ? "See my likeness" : "Choose my hair"}
            </LinkButton>
          </div>
        </Card>
      )}

      <Link href="/app/likeness" className="block">
        <Card title="Your likeness">
          <div className="flex items-center gap-3 pb-4">
            {l.hair.color && <Swatch hex={l.hair.color.value.hex} kind="hair" size={44} />}
            {l.brows.color && <Swatch hex={l.brows.color.value.hex} kind="brow" size={44} />}
            {l.skin.tone && <Swatch hex={l.skin.tone.value.hex} size={44} />}
            <span className="ml-auto text-[15px] font-medium text-[var(--ink-2)]">
              {l.status === "complete" ? "Complete" : "Some values missing"} →
            </span>
          </div>
        </Card>
      </Link>

      {milestones && (
        <Card title="Typical course">
          <ol className="pb-3">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] py-2.5 first:border-t-0">
                <span className={`text-[15px] font-medium ${m.status === "done" ? "text-[var(--ink-3)] line-through" : ""}`}>{m.title}</span>
                <span className="text-[13px] tabular-nums text-[var(--ink-3)]">{m.end ? `by ${new Date(m.end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : m.start ? `from ${new Date(m.start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "after your last cycle"}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {milestones && <Note>{TIMELINE_DISCLAIMER}</Note>}
    </>
  );
}
