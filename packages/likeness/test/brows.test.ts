import { describe, expect, it } from "vitest";
import { matchBrowPattern } from "../src/brows.ts";

const patterns = [
  { category: "Soft Arch", label: "SoftArch3" },
  { category: "Soft Arch", label: "SoftArch1" },
  { category: "High Arch", label: "HighArch2" },
  { category: "Straight", label: "Straight1" },
  { category: "Curved", label: "Curved4" },
];

describe("matchBrowPattern", () => {
  it.each([
    ["Soft Angled", "SoftArch1"],
    ["Hard Angled", "HighArch2"],
    ["Straight", "Straight1"],
    ["Rounded", "Curved4"],
  ])("%s → %s (lowest-numbered label in the mapped category)", (shape, label) => {
    expect(matchBrowPattern({ shape, thickness: "Average" }, patterns).name).toBe(label);
  });

  it("falls back to a soft arch and says the shape was not measured when obscured", () => {
    const m = matchBrowPattern({ shape: "Obscured", thickness: "Unknown" }, patterns);
    expect(m.name).toBe("SoftArch1");
    expect(m.measuredShape).toBe(false);
  });

  it("maps thickness to the VTO thickness offset", () => {
    expect(matchBrowPattern({ shape: "Straight", thickness: "Dense" }, patterns).thickness).toBe(30);
    expect(matchBrowPattern({ shape: "Straight", thickness: "Sparse" }, patterns).thickness).toBe(-20);
    expect(matchBrowPattern({ shape: "Straight", thickness: "Average" }, patterns).thickness).toBe(0);
  });
});
