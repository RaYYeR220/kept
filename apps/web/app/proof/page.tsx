import Link from "next/link";
import { Mark, Texture } from "@/components/Mark";
import proof from "@/data/proof.json";

export const metadata = { title: "Kept — Proof" };

type Cell = { pass: number; total: number };
type Run = { tag: string; file: string; date: string; model: string; code: string; byMode: Record<string, Record<string, Cell>> };
const runs = proof.runs as Run[];
const REPO = "https://github.com/RaYYeR220/kept/blob/main/";

const sum = (r: Run | undefined, mode = "gates-on"): Cell =>
  Object.values(r?.byMode[mode] ?? {}).reduce((a, c) => ({ pass: a.pass + c.pass, total: a.total + c.total }), { pass: 0, total: 0 });
const cell = (r: Run | undefined, cat: string, mode = "gates-on") => {
  const c = r?.byMode[mode]?.[cat];
  return c ? `${c.pass}/${c.total}` : "—";
};
const find = (tag: string) => runs.find((r) => r.tag === tag);

const STAGES = [
  {
    title: "1 · Pre-registered set, keyword router",
    tag: "v1-router",
    note: "60 cases fixed before any run. The negative control switches the gates off: the model still deferred every medical question on its own, but named blocked products in 5 of 10 cases. The gates make the behaviour deterministic instead of model-dependent.",
    cats: ["medical", "urgent", "injection", "product", "buy", "benign"],
    control: true,
  },
  {
    title: "2 · Held-out set, keyword router only",
    tag: "holdout-v2-router",
    note: "New phrasings the router had never seen. Keywords don't generalise: 7 of 15 medical and 0 of 2 urgent messages got through to the model.",
    cats: ["medical", "urgent", "benign"],
  },
  {
    title: "3 · Same held-out set, router + scope classifier",
    tag: "holdout-v2-router+classifier",
    note: "A separate model call classifies every message before the Companion sees it, and fails closed. This set was visible while the classifier prompt was written, so it is not a clean test.",
    cats: ["medical", "urgent", "benign"],
  },
  {
    title: "4 · Blind set, written without access to Kept",
    tag: "blind-v3-router+classifier",
    note: "40 messages written by a separate author who never saw the router, the classifier or the code, committed before the run. Router alone scored 29/40 on the same set.",
    cats: ["medical", "urgent", "benign"],
    compare: "blind-v3-router",
  },
];

export default function Proof() {
  const blind = find("blind-v3-router+classifier");
  const blindRouter = find("blind-v3-router");
  const misconfigured = find("blind-v3-router+classifier-misconfigured");
  const b = sum(blind);
  return (
    <>
      <Texture />
      <div className="relative z-[5] mx-auto max-w-[1080px] px-5 pb-24 sm:px-14">
        <nav className="flex h-[78px] items-center justify-between">
          <Mark />
          <Link href="/app" className="text-[15px] font-medium">Open Kept</Link>
        </nav>

        <p className="mt-8 text-[15px] font-medium text-[var(--ink-2)]">Proof</p>
        <h1 className="display mt-4 max-w-[18ch] text-[46px] sm:text-[72px]">
          {b.pass}/{b.total} on a blind test it had never seen.
        </h1>
        <p className="mt-6 max-w-[60ch] text-[18px] leading-[1.6] text-[var(--ink-2)]">
          Kept must never give medical advice and must always hand urgent messages to a person. That is enforced in code before any language model reads a message, and every reply is linted again before it is shown. These are the measured results, including the ones that went badly.
        </p>

        <section className="mt-16 space-y-6">
          {STAGES.map((s) => {
            const r = find(s.tag);
            const cmp = s.compare ? find(s.compare) : undefined;
            const t = sum(r);
            return (
              <div key={s.tag} className="rounded-card border border-[var(--line)] bg-oat-50/60 p-6 sm:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-[24px] font-medium tracking-[-0.025em]">{s.title}</h2>
                  <p className="font-display text-[32px] font-medium tabular-nums tracking-[-0.03em]">{t.pass}/{t.total}</p>
                </div>
                <p className="mt-3 max-w-[70ch] text-[16px] leading-[1.6] text-[var(--ink-2)]">{s.note}</p>
                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-6">
                  {s.cats.map((c) => (
                    <div key={c} className="bg-oat-50 px-4 py-3">
                      <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">{c}</dt>
                      <dd className="mt-1 font-display text-[22px] font-medium tabular-nums">{cell(r, c)}</dd>
                      {s.control && <dd className="text-[12px] text-[var(--ink-3)]">gates off {cell(r, c, "gates-off")}</dd>}
                      {cmp && <dd className="text-[12px] text-[var(--ink-3)]">router only {cell(cmp, c)}</dd>}
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[13px] text-[var(--ink-3)]">
                  Model {r?.model} · code {r?.code} · <a className="underline underline-offset-4" href={`${REPO}${r?.file}`}>full report</a>
                </p>
              </div>
            );
          })}
        </section>

        <section className="mt-16 grid gap-6 sm:grid-cols-2">
          <div className="rounded-card border border-[var(--line)] bg-oat-50/60 p-6 sm:p-8">
            <h2 className="font-display text-[24px] font-medium tracking-[-0.025em]">When the classifier broke, nothing leaked</h2>
            <p className="mt-3 text-[16px] leading-[1.6] text-[var(--ink-2)]">
              Our first classifier run was misconfigured: the provider ignored the output schema, so every call failed. Because it fails closed, Kept refused everything — {cell(misconfigured, "benign")} ordinary questions answered — but still let no medical question through ({cell(misconfigured, "medical")} refused). We kept that run in the repository.
            </p>
          </div>
          <div className="rounded-card border border-[var(--line)] bg-oat-50/60 p-6 sm:p-8">
            <h2 className="font-display text-[24px] font-medium tracking-[-0.025em]">What we don't claim</h2>
            <ul className="mt-3 space-y-2 text-[16px] leading-[1.6] text-[var(--ink-2)]">
              <li>That 40/40 on 40 messages means zero errors in the world. It means zero on this set.</li>
              <li>That the router alone is enough: on the blind set it scored {sum(blindRouter).pass}/{sum(blindRouter).total}.</li>
              <li>Any medical benefit. Kept is cosmetic.</li>
            </ul>
          </div>
        </section>

        <p className="mt-16 text-[14px] text-[var(--ink-3)]">
          Methods, cases and every report: <a className="underline underline-offset-4" href={`${REPO}eval/README.md`}>eval/README.md</a>. Generated {new Date(proof.generatedAt).toLocaleString("en-GB")}.
        </p>
      </div>
    </>
  );
}
