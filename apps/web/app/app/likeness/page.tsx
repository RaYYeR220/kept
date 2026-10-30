"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Card, LinkButton, Note, ProvChip, Row, Swatch, Title } from "@/components/app/ui";
import { db } from "@/lib/client/db";

const pretty = (t: string | undefined | null) => (t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
const shortDensity = (t: string) => t.replace(/ Density$/, "");

export default function LikenessPage() {
  const stored = useLiveQuery(() => db.likeness.get("current"), []);
  if (stored === undefined) return null;
  if (!stored) return <Title sub="Nothing measured yet.">Your likeness</Title>;
  const l = stored.likeness;
  const measuredOn = new Date(l.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const cross = stored.crossCheck.browDeltaE;

  return (
    <>
      <Title>Your likeness</Title>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] text-[var(--ink-2)]">Measured {measuredOn}</p>
        <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-chip border border-[var(--line)] px-[11px] py-1.5 text-[13px] font-medium text-[var(--ink-2)] before:h-1.5 before:w-1.5 before:rounded-full before:bg-ok">
          Photos on this phone
        </span>
      </div>

      <Card title="Hair">
        {l.hair.color && (
          <div className="flex items-center gap-3.5 pb-3">
            <Swatch hex={l.hair.color.value.hex} kind="hair" />
            <div>
              <div className="font-display text-[22px] font-medium leading-tight tracking-[-0.025em]">{l.hair.color.value.name ?? "Hair colour"} family</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] font-medium tabular-nums text-[var(--ink-2)]">
                {l.hair.color.value.hex.toUpperCase()} <ProvChip prov={l.hair.color.prov} />
              </div>
            </div>
          </div>
        )}
        {l.hair.type && <Row k="Curl pattern" v={l.hair.type.value.mapping ?? pretty(l.hair.type.value.term)} prov={l.hair.type.prov} />}
        {l.hair.density && <Row k="Density" v={shortDensity(l.hair.density.value.term)} prov={l.hair.density.prov} />}
        {l.hair.length && <Row k="Length" v={pretty(l.hair.length.value.term)} prov={l.hair.length.prov} />}
      </Card>

      <Card title="Brows & skin">
        {l.brows.color && (
          <div className="flex items-center gap-3.5 pb-3">
            <Swatch hex={l.brows.color.value.hex} kind="brow" />
            <div>
              <div className="font-display text-[22px] font-medium leading-tight tracking-[-0.025em]">Your brows</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] font-medium tabular-nums text-[var(--ink-2)]">
                {l.brows.color.value.hex.toUpperCase()} <ProvChip prov={l.brows.color.prov} />
              </div>
            </div>
          </div>
        )}
        {l.brows.shape && <Row k="Brow shape" v={`${l.brows.shape.value.shape}, ${l.brows.shape.value.thickness.toLowerCase()}`} prov={l.brows.shape.prov} />}
        {cross !== null && (
          <Row k="Checked twice" v={<span className="text-[16px]">ΔE {cross.toFixed(1)}</span>} />
        )}
        {l.skin.tone && (
          <div className="flex items-center gap-3.5 border-t border-[var(--line)] py-3">
            <Swatch hex={l.skin.tone.value.hex} />
            <div>
              <div className="font-display text-[22px] font-medium leading-tight tracking-[-0.025em]">Skin tone</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] font-medium tabular-nums text-[var(--ink-2)]">
                {l.skin.tone.value.hex.toUpperCase()} <ProvChip prov={l.skin.tone.prov} />
              </div>
            </div>
          </div>
        )}
        {l.face && <Row k="Face shape" v={l.face.value.shape} prov={l.face.prov} />}
      </Card>

      {cross !== null && (
        <Note>
          Your brow colour was read by two separate YouCam models (Skin Tone and Face Analyzer). They landed ΔE {cross.toFixed(1)} apart{cross < 3 ? " — the same colour to the eye" : cross < 6 ? " — very close" : " — noticeably apart, so retaking in even light may help"}.
        </Note>
      )}
      {l.status === "incomplete" && <Note>Some values couldn't be measured from these photos. You can retake them any time.</Note>}

      <div className="mt-6 flex flex-col gap-3">
        <LinkButton href="/app/share">Share with my wig specialist</LinkButton>
        <LinkButton href="/app/capture" variant="ghost">Measure again</LinkButton>
      </div>
    </>
  );
}
