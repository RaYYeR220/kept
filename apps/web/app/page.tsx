import Link from "next/link";
import { CITATIONS, TIMELINE_DISCLAIMER } from "@kept/likeness";
import { Lock } from "@/components/Lock";
import { Mark, Texture } from "@/components/Mark";

const STEPS = [
  {
    verb: "Measure",
    title: "Measure while it's still yours",
    body: "Three photos, about a minute. YouCam's skin-tone, face-attribute and hair APIs read your hair colour, curl, density and length, your brow colour and shape, and your skin tone.",
    api: "YouCam Skin Tone · Face Analyzer · Hair Type, Length, Density",
  },
  {
    verb: "Choose",
    title: "Choose your hair from you",
    body: "Kept searches real wig listings, ranks them against your measured likeness and puts the best ones on your own photo, so you can choose before day 18.",
    api: "YouCam Hairstyle Transfer · Shop Catalog",
  },
  {
    verb: "Draw back",
    title: "Draw your brows back",
    body: "When brows and lashes thin, Kept draws them back on today's photo in your own measured colour and shape — something to copy in the mirror.",
    api: "YouCam Makeup VTO (eyebrows, lashes)",
  },
];

const MILESTONES = [
  { when: "Before day 1", what: "Capture your likeness", note: "while your hair and brows are as you know them" },
  { when: "Before ~day 18", what: "Choose your hair", note: "mean onset in a study of 1,478 patients" },
  { when: "Later in the course", what: "Brows and lashes", note: "often thin after scalp hair" },
  { when: "~3 months after", what: "Regrowth", note: "often greyer or wavier at first" },
];

export default function Landing() {
  return (
    <>
      <Texture />
      <section className="relative h-[100dvh] min-h-[640px] overflow-hidden">
        <Lock storedHex="#5b3a29" storedLabel="hair · measured 31 Oct" />
        <nav className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-[22px] sm:px-14 sm:py-[30px]">
          <Mark />
          <div className="hidden gap-[34px] text-[15px] font-medium text-[var(--ink-2)] sm:flex">
            <a href="#how">How it works</a>
            <Link href="/salon">For wig specialists</Link>
            <Link href="/proof">Proof</Link>
          </div>
          <Link href="/app" className="text-[15px] font-medium sm:hidden">Open</Link>
        </nav>
        <div className="pointer-events-none relative z-[5] flex h-full flex-col justify-end px-5 pb-9 sm:justify-center sm:px-14 sm:pb-0">
          <div className="pointer-events-auto max-w-[640px]">
            <p className="mb-[18px] inline-flex items-center gap-2.5 text-[14px] font-medium text-[var(--ink-2)] before:h-2 before:w-2 before:rounded-full before:bg-hair sm:mb-[30px] sm:text-[15px]">
              For people about to start chemotherapy
            </p>
            <h1 className="display anim-wipe -ml-[3px] text-[60px] sm:-ml-[5px] sm:text-[104px]">
              Keep looking
              <br />
              like you.
            </h1>
            <p className="anim-rise mt-[18px] max-w-[31ch] text-[18px] leading-[1.5] text-[var(--ink-2)] [animation-delay:.15s] sm:mt-[30px] sm:text-[21px]">
              Before treatment changes your hair and brows, Kept measures them — colour, curl, shape. Every wig, brow and colour you choose after starts from you.
            </p>
            <div className="anim-rise mt-6 flex flex-col items-stretch gap-4 [animation-delay:.25s] sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
              <Link
                href="/app"
                className="inline-flex h-[58px] items-center justify-center gap-3 rounded-chip bg-oat-900 px-[30px] text-[17px] font-semibold text-oat-50 transition-transform duration-300 hover:-translate-y-px sm:h-[60px]"
              >
                <span className="relative h-[22px] w-[22px] rounded-full border border-oat-50/35 after:absolute after:inset-[7px] after:rounded-full after:bg-hair-light" />
                Save my likeness
              </Link>
              <a href="#how" className="self-center border-b border-oat-900/30 pb-1 text-[17px] font-medium">How it works</a>
            </div>
            <p className="anim-rise mt-[18px] text-center text-[13px] font-medium leading-[1.5] text-[var(--ink-3)] [animation-delay:.35s] sm:mt-11 sm:text-left sm:text-[14px]">
              <em className="not-italic text-[var(--ink-2)]">Photos stay on your phone.</em> Cosmetic help only — medical questions go to your care team.
            </p>
          </div>
        </div>
      </section>

      <main className="relative z-[5]">
        <section id="how" className="mx-auto max-w-[1180px] px-5 py-24 sm:px-14 sm:py-32">
          <p className="text-[15px] font-medium text-[var(--ink-2)]">How it works</p>
          <h2 className="display mt-4 max-w-[16ch] text-[44px] sm:text-[64px]">The lock of hair, measured instead.</h2>
          <p className="mt-6 max-w-[58ch] text-[18px] leading-[1.6] text-[var(--ink-2)]">
            Cancer charities tell people to choose a wig before their hair goes, and to save a lock from the top front to match the colour.{" "}
            <a className="underline decoration-oat-400 underline-offset-4" href={CITATIONS.acsWigs.url}>American Cancer Society</a>. Kept turns that advice into measurements you keep on your phone.
          </p>
          <ol className="mt-16 grid gap-px overflow-hidden rounded-card border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.verb} className="flex flex-col bg-oat-50/70 p-8">
                <span className="text-[13px] font-semibold tabular-nums text-hair">0{i + 1} · {s.verb}</span>
                <h3 className="font-display mt-5 text-[26px] font-medium leading-[1.1] tracking-[-0.03em]">{s.title}</h3>
                <p className="mt-4 text-[16px] leading-[1.6] text-[var(--ink-2)]">{s.body}</p>
                <p className="mt-auto pt-8 text-[13px] font-medium text-[var(--ink-3)]">{s.api}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-14 sm:pb-32">
          <div className="grid gap-10 sm:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-[15px] font-medium text-[var(--ink-2)]">When things usually change</p>
              <h2 className="display mt-4 text-[40px] sm:text-[52px]">Hair often starts to go around day 18.</h2>
              <p className="mt-6 text-[16px] leading-[1.6] text-[var(--ink-3)]">
                {TIMELINE_DISCLAIMER}{" "}
                <a className="underline underline-offset-4" href={CITATIONS.watanabe2019.url}>Source</a>
              </p>
            </div>
            <ol className="relative border-l border-[var(--line)] pl-8">
              {MILESTONES.map((m) => (
                <li key={m.what} className="relative pb-9 last:pb-0">
                  <span className="absolute -left-[37px] top-1.5 h-[9px] w-[9px] rounded-full border border-hair bg-oat-100" />
                  <p className="text-[14px] font-semibold text-hair">{m.when}</p>
                  <p className="font-display mt-1 text-[24px] font-medium tracking-[-0.025em]">{m.what}</p>
                  <p className="mt-1 text-[15px] text-[var(--ink-3)]">{m.note}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-14 sm:pb-32">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-card border border-[var(--line)] bg-oat-50/60 p-8 sm:p-10">
              <p className="text-[15px] font-medium text-[var(--ink-2)]">For wig specialists</p>
              <h3 className="font-display mt-4 text-[30px] font-medium leading-[1.1] tracking-[-0.03em]">Start the fitting from a measured likeness.</h3>
              <p className="mt-4 text-[16px] leading-[1.6] text-[var(--ink-2)]">
                Your client can share their likeness with you by link. Open it, add your stock, and Kept ranks it against their measured hair. Any MCP-capable assistant can read it too.
              </p>
              <Link href="/salon" className="mt-8 inline-block border-b border-oat-900/30 pb-1 text-[16px] font-medium">See the specialist view</Link>
            </div>
            <div className="rounded-card border border-[var(--line)] bg-oat-50/60 p-8 sm:p-10">
              <p className="text-[15px] font-medium text-[var(--ink-2)]">What Kept won't do</p>
              <h3 className="font-display mt-4 text-[30px] font-medium leading-[1.1] tracking-[-0.03em]">No medical advice. Not even by accident.</h3>
              <p className="mt-4 text-[16px] leading-[1.6] text-[var(--ink-2)]">
                Questions about medicines, symptoms or what's safe for you go to your care team. That rule is enforced in code before any AI sees your message, and every reply is checked again before you see it.
              </p>
              <Link href="/proof" className="mt-8 inline-block border-b border-oat-900/30 pb-1 text-[16px] font-medium">See how we test it</Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-[var(--line)]">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 py-12 text-[14px] text-[var(--ink-3)] sm:flex-row sm:items-center sm:justify-between sm:px-14">
            <Mark />
            <p className="max-w-[62ch]">
              Kept is a cosmetic tool. It does not diagnose, treat or give medical advice. Measurements are made by YouCam APIs from Perfect Corp. Photos stay on your device unless you choose to share.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
