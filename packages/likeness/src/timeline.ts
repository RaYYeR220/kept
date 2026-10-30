import type { CitationId } from "./citations.ts";

export type TreatmentPlan = {
  /** ISO date (YYYY-MM-DD) of the first infusion. */
  firstInfusion: string;
  cycleDays?: number;
  cycles?: number;
};

export type MilestoneId = "capture" | "choose-hair" | "brows-lashes" | "regrowth";

export type Milestone = {
  id: MilestoneId;
  title: string;
  detail: string;
  start: string | null;
  end: string | null;
  status: "done" | "now" | "upcoming";
  citation: CitationId;
};

// Typical course from Watanabe et al. 2019 (n = 1,478): hair loss starts a mean of
// 18.0 days (SD 12.6) after the first infusion; regrowth begins a mean of 3.3 months
// after the last one. NIH InformedHealth: facial hair follows scalp hair "a little later".
export const MEAN_ONSET_DAY = 18;
export const EARLIEST_COMMON_ONSET_DAY = 5; // mean − 1 SD, rounded down
export const REGROWTH_AFTER_LAST_DAYS = 100; // 3.3 months

export const TIMELINE_DISCLAIMER =
  "Typical course from a study of 1,478 patients — yours may differ. Ask your care team.";

const DAY_MS = 86_400_000;

function parseDay(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Not a date (YYYY-MM-DD): "${iso}"`);
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`Not a date (YYYY-MM-DD): "${iso}"`);
  return t;
}

const addDays = (iso: string, days: number) => new Date(parseDay(iso) + days * DAY_MS).toISOString().slice(0, 10);

function statusFor(today: string, start: string | null, end: string | null): Milestone["status"] {
  const t = parseDay(today);
  if (end !== null && t > parseDay(end)) return "done";
  if (start === null || t >= parseDay(start)) return "now";
  return "upcoming";
}

export function buildTimeline(plan: TreatmentPlan, today: string): Milestone[] {
  const day0 = plan.firstInfusion;
  parseDay(day0);
  parseDay(today);

  const captureEnd = addDays(day0, EARLIEST_COMMON_ONSET_DAY);
  const onset = addDays(day0, MEAN_ONSET_DAY);
  const lastCycle =
    plan.cycles && plan.cycleDays ? addDays(day0, (plan.cycles - 1) * plan.cycleDays) : null;
  const regrowth = lastCycle ? addDays(lastCycle, REGROWTH_AFTER_LAST_DAYS) : null;

  const ms: Omit<Milestone, "status">[] = [
    {
      id: "capture",
      title: "Capture your likeness",
      detail: "Best before your first infusion, while your hair and brows are as you know them.",
      start: null,
      end: captureEnd,
      citation: "acsWigs",
    },
    {
      id: "choose-hair",
      title: "Choose your hair",
      detail: "Hair often starts to go around day 18. Choosing earlier lets you match it to your own colour.",
      start: null,
      end: onset,
      citation: "watanabe2019",
    },
    {
      id: "brows-lashes",
      title: "Brows and lashes",
      detail: "Brows and lashes often thin later than scalp hair. Kept can draw them back in your measured colour.",
      start: onset,
      end: null,
      citation: "nihHairLoss",
    },
    {
      id: "regrowth",
      title: "Regrowth",
      detail: regrowth
        ? "Regrowth often begins around three months after the last cycle, sometimes greyer or wavier at first."
        : "Regrowth often begins around three months after your last cycle, sometimes greyer or wavier at first.",
      start: regrowth,
      end: null,
      citation: "watanabe2019",
    },
  ];

  return ms.map((m) => ({
    ...m,
    status: m.id === "regrowth" && m.start === null ? "upcoming" : statusFor(today, m.start, m.end),
  }));
}
