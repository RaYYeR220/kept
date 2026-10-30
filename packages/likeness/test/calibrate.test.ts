import { describe, expect, it } from "vitest";
import { correctTowards, shouldStop } from "../src/calibrate.ts";

describe("correctTowards", () => {
  it("moves the input by the measured error so the next render lands on target", () => {
    const target = { l: 42.6, a: 11.3, b: 18.2 };
    const measured = { l: 59.9, a: 7.6, b: 14.1 };
    const next = correctTowards(target, target, measured);
    expect(next.l).toBeCloseTo(25.3, 1);
    expect(next.a).toBeCloseTo(15.0, 1);
    expect(next.b).toBeCloseTo(22.3, 1);
  });

  it("accumulates from the previous input, not the target", () => {
    const next = correctTowards({ l: 30, a: 10, b: 10 }, { l: 40, a: 10, b: 10 }, { l: 45, a: 10, b: 10 });
    expect(next.l).toBeCloseTo(25, 5);
  });

  it("damps the step with a gain below 1", () => {
    const next = correctTowards({ l: 40, a: 0, b: 0 }, { l: 40, a: 0, b: 0 }, { l: 60, a: 0, b: 0 }, 0.5);
    expect(next.l).toBeCloseTo(30, 5);
  });

  it("clamps lightness so a large error can't ask for impossible colours", () => {
    expect(correctTowards({ l: 10, a: 0, b: 0 }, { l: 10, a: 0, b: 0 }, { l: 60, a: 0, b: 0 }).l).toBe(5);
    expect(correctTowards({ l: 90, a: 0, b: 0 }, { l: 90, a: 0, b: 0 }, { l: 40, a: 0, b: 0 }).l).toBe(95);
  });
});

describe("shouldStop", () => {
  it("stops when close enough or out of rounds", () => {
    expect(shouldStop(4.9, 1, 3)).toBe(true);
    expect(shouldStop(12, 3, 3)).toBe(true);
    expect(shouldStop(12, 1, 3)).toBe(false);
  });
});
