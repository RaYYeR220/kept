import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sampleHairFromBox } from "../lib/server/sample";

const box = { left: 0.3, top: 0.3, width: 0.4, height: 0.4 };

async function frame(background: string, hair: string) {
  const band = await sharp({ create: { width: 200, height: 70, channels: 3, background: hair } }).png().toBuffer();
  return new Uint8Array(
    await sharp({ create: { width: 400, height: 400, channels: 3, background } }).composite([{ input: band, top: 60, left: 100 }]).jpeg({ quality: 95 }).toBuffer(),
  );
}

describe("sampleHairFromBox", () => {
  it("reads the hair band above the face", async () => {
    const s = await sampleHairFromBox(await frame("#e9e6e0", "#3a2418"), box);
    expect(s?.name).toBe("Dark brown");
  });

  it("returns null when the band is the same as the background", async () => {
    expect(await sampleHairFromBox(await frame("#e9e6e0", "#e9e6e0"), box)).toBeNull();
  });

  it("can skip the background check for a guided photo whose hair reaches the corners", async () => {
    expect(await sampleHairFromBox(await frame("#3a2418", "#3a2418"), box)).toBeNull();
    expect((await sampleHairFromBox(await frame("#3a2418", "#3a2418"), box, false))?.name).toBe("Dark brown");
  });
});
