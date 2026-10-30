import Link from "next/link";
import type { Provenance } from "@kept/likeness";

const API_NAMES: Record<string, string> = {
  "skin-tone-analysis": "YouCam Skin Tone",
  "face-attr-analysis": "YouCam Face Analyzer",
  "hair-type-detection": "YouCam Hair Type",
  "hair-length-detection": "YouCam Hair Length",
  "hair-density-detection": "YouCam Hair Density",
  "fitzpatrick-scale-analyzer": "YouCam Fitzpatrick",
  "skin-analysis": "YouCam Skin Analysis",
  "makeup-vto": "YouCam Makeup VTO",
  "hair-transfer": "YouCam Hairstyle",
  hat: "YouCam Hat VTO",
};

export const apiName = (api: string) => API_NAMES[api] ?? `YouCam ${api}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function ProvChip({ prov }: { prov: Provenance }) {
  return (
    <span
      title={`${apiName(prov.api)} ${prov.version} · task ${prov.taskId ?? "–"} · ${prov.units} units${prov.source === "replay" ? " · recorded demo" : ""}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip bg-oat-200 py-1 pl-[7px] pr-[9px] text-[11.5px] font-medium leading-none text-[var(--ink-2)] before:h-[9px] before:w-[9px] before:rounded-full before:border before:border-[var(--ink-3)] before:bg-[radial-gradient(circle,var(--ink-3)_0_1.5px,transparent_2px)]"
    >
      {apiName(prov.api)} · {day(prov.at)}
    </span>
  );
}

export function Swatch({ hex, kind = "flat", size = 54 }: { hex: string; kind?: "hair" | "brow" | "flat"; size?: number }) {
  const bg =
    kind === "hair"
      ? `repeating-linear-gradient(104deg, ${hex} 0 2px, color-mix(in oklab, ${hex} 80%, black) 2px 3px, color-mix(in oklab, ${hex} 85%, white) 3px 5px, ${hex} 5px 7px)`
      : kind === "brow"
        ? `repeating-linear-gradient(82deg, ${hex} 0 2px, color-mix(in oklab, ${hex} 82%, black) 2px 3px, color-mix(in oklab, ${hex} 88%, white) 3px 5px)`
        : hex;
  return <div aria-hidden="true" className="flex-none rounded-full border border-oat-900/15" style={{ width: size, height: size, background: bg }} />;
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-3 rounded-card border border-[var(--line)] bg-oat-50/70 px-[18px] pb-1 pt-4 ${className}`}>
      {title && <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">{title}</h2>}
      {children}
    </section>
  );
}

export function Row({ k, v, prov }: { k: string; v: React.ReactNode; prov?: Provenance | null }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] py-[11px]">
      <div className="flex flex-col items-start gap-[7px] text-[15px] font-medium text-[var(--ink-2)]">
        {k}
        {prov && <ProvChip prov={prov} />}
      </div>
      <div className="font-display text-right text-[20px] font-medium tracking-[-0.02em]">{v}</div>
    </div>
  );
}

const BTN = "inline-flex h-[56px] items-center justify-center gap-3 rounded-chip px-7 text-[17px] font-semibold transition-transform duration-300 hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0";

export function Button({ children, onClick, disabled, variant = "ink", type = "button", className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "ink" | "ghost"; type?: "button" | "submit"; className?: string }) {
  const look = variant === "ink" ? "bg-oat-900 text-oat-50" : "border border-[var(--line)] bg-oat-50/70 text-[var(--ink)]";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${BTN} ${look} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "ink", className = "" }: { href: string; children: React.ReactNode; variant?: "ink" | "ghost"; className?: string }) {
  const look = variant === "ink" ? "bg-oat-900 text-oat-50" : "border border-[var(--line)] bg-oat-50/70 text-[var(--ink)]";
  return (
    <Link href={href} className={`${BTN} ${look} ${className}`}>
      {children}
    </Link>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-4 mt-1">
      <h1 className="font-display text-[40px] font-medium leading-none tracking-[-0.045em]">{children}</h1>
      {sub && <p className="mt-3 text-[16px] leading-[1.5] text-[var(--ink-2)]">{sub}</p>}
    </header>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[13px] leading-[1.5] text-[var(--ink-3)]">{children}</p>;
}
