import { describe, expect, it } from "vitest";
import { buildTimeline } from "../src/timeline.ts";

const byId = (ms: ReturnType<typeof buildTimeline>) => Object.fromEntries(ms.map((m) => [m.id, m]));

describe("buildTimeline", () => {
  it("ends the choose-hair window on day 18 after the first infusion", () => {
    const t = byId(buildTimeline({ firstInfusion: "2026-11-03" }, "2026-10-31"));
    expect(t["choose-hair"]?.end).toBe("2026-11-21");
    expect(t["choose-hair"]?.citation).toBe("watanabe2019");
  });

  it("marks capture as now before the first infusion and done after day 5", () => {
    const before = byId(buildTimeline({ firstInfusion: "2026-11-03" }, "2026-10-31"));
    expect(before.capture?.status).toBe("now");
    const later = byId(buildTimeline({ firstInfusion: "2026-11-03" }, "2026-11-12"));
    expect(later.capture?.status).toBe("done");
  });

  it("starts brows-and-lashes when scalp hair typically starts, open-ended", () => {
    const t = byId(buildTimeline({ firstInfusion: "2026-11-03" }, "2026-10-31"));
    expect(t["brows-lashes"]?.start).toBe("2026-11-21");
    expect(t["brows-lashes"]?.end).toBeNull();
    expect(t["brows-lashes"]?.status).toBe("upcoming");
  });

  it("dates regrowth ~100 days after the last cycle when cycles are known", () => {
    // 6 cycles of 21 days: last cycle starts on day 105 → 2027-02-16; +100 days → 2027-05-27
    const t = byId(buildTimeline({ firstInfusion: "2026-11-03", cycleDays: 21, cycles: 6 }, "2026-10-31"));
    expect(t.regrowth?.start).toBe("2027-05-27");
  });

  it("leaves regrowth undated when the number of cycles is unknown", () => {
    const t = byId(buildTimeline({ firstInfusion: "2026-11-03" }, "2026-10-31"));
    expect(t.regrowth?.start).toBeNull();
  });

  it("always returns the four milestones in order", () => {
    const ids = buildTimeline({ firstInfusion: "2026-11-03" }, "2026-10-31").map((m) => m.id);
    expect(ids).toEqual(["capture", "choose-hair", "brows-lashes", "regrowth"]);
  });

  it("rejects an invalid date", () => {
    expect(() => buildTimeline({ firstInfusion: "next tuesday" }, "2026-10-31")).toThrow(/date/i);
  });
});
