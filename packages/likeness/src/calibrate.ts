import type { Lab } from "./colour.ts";

// Closed-loop colour calibration. A rendered colour lands somewhere other than the colour
// asked for (pigment blends with the skin under it). After each render the result is
// measured again, and the next request is shifted by the error, in CIELAB.

export const CALIBRATION_TARGET_DE00 = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function correctTowards(input: Lab, target: Lab, measured: Lab, gain = 1): Lab {
  return {
    l: clamp(input.l + gain * (target.l - measured.l), 5, 95),
    a: clamp(input.a + gain * (target.a - measured.a), -60, 60),
    b: clamp(input.b + gain * (target.b - measured.b), -60, 60),
  };
}

export function shouldStop(deltaE: number, round: number, maxRounds: number, target = CALIBRATION_TARGET_DE00): boolean {
  return deltaE <= target || round >= maxRounds;
}
