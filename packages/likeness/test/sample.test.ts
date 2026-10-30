import { describe, expect, it } from "vitest";
import { hexToLab } from "../src/colour.ts";
import { hairRegion, hairShadeName, robustMedianLab } from "../src/sample.ts";

describe("hairRegion", () => {
  it("is a band above the forehead, inset from the face edges, in pixels", () => {
    const r = hairRegion({ left: 0.3, top: 0.2, width: 0.4, height: 0.4 }, 1000, 1000);
    expect(r).toEqual({ x0: 360, x1: 640, y0: 80, y1: 176 });
  });

  it("clamps at the top of the image and returns null when no band fits", () => {
    expect(hairRegion({ left: 0.3, top: 0.01, width: 0.4, height: 0.4 }, 1000, 1000)).toBeNull();
    expect(hairRegion({ left: 0.3, top: 0.05, width: 0.4, height: 0.4 }, 1000, 1000)?.y0).toBe(0);
  });
});

describe("robustMedianLab", () => {
  it("ignores the darkest tenth and the brightest band", () => {
    const px = [
      ...Array(10).fill({ l: 2, a: 0, b: 0 }),
      ...Array(60).fill({ l: 30, a: 10, b: 15 }),
      ...Array(30).fill({ l: 95, a: 0, b: 0 }),
    ];
    expect(robustMedianLab(px)).toEqual({ l: 30, a: 10, b: 15 });
  });

  it("returns null for too few pixels", () => {
    expect(robustMedianLab([{ l: 1, a: 1, b: 1 }])).toBeNull();
  });
});

describe("hairShadeName", () => {
  it.each([
    ["#1b1918", "Black"],
    ["#34241c", "Dark brown"],
    ["#5a3d2b", "Medium brown"],
    ["#915c3c", "Light auburn brown"],
    ["#c9a26e", "Dark blonde"],
    ["#e8d5a0", "Blonde"],
    ["#a8a6a3", "Grey"],
  ])("%s → %s", (hex, name) => {
    expect(hairShadeName(hexToLab(hex))).toBe(name);
  });
});
