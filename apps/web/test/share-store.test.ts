import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LikenessSummary } from "@kept/likeness";
import { open, seal } from "../lib/server/crypto";
import { memoryBlobs, ShareStore } from "../lib/server/share-store";

const key = randomBytes(32);
const prov = { api: "skin-tone-analysis", version: "v2.0", taskId: "t", units: 20, at: "2026-10-31T10:00:00Z", source: "replay" as const };
const summary: LikenessSummary = {
  id: "l1",
  createdAt: "2026-10-31T10:00:00Z",
  status: "complete",
  hair: { color: { value: { hex: "#42280e", name: "Brown" }, prov }, type: null, length: null, density: null, frizz: null },
  brows: { color: { value: { hex: "#4a3222" }, prov }, shape: null },
  skin: { tone: { value: { hex: "#c99d7f" }, prov }, fitzpatrick: null, baseline: null },
  eyes: null,
  lips: null,
  face: null,
};

function store(at = "2026-11-01T00:00:00Z") {
  const blobs = memoryBlobs();
  let now = new Date(at);
  const s = new ShareStore(blobs, key, () => now);
  return { s, blobs, setNow: (iso: string) => (now = new Date(iso)) };
}

describe("crypto", () => {
  it("round-trips and rejects a wrong key", () => {
    const sealed = seal(new TextEncoder().encode("hello"), key);
    expect(new TextDecoder().decode(open(sealed, key))).toBe("hello");
    expect(() => open(sealed, randomBytes(32))).toThrow();
  });
});

describe("ShareStore", () => {
  it("creates and reads back a share; stored bytes are ciphertext", async () => {
    const { s, blobs } = store();
    const share = await s.create({ summary, label: "Anna" });
    const got = await s.get(share.token);
    expect(got.status).toBe("ok");
    expect(got.status === "ok" && got.share.summary.brows.color?.value.hex).toBe("#4a3222");
    const raw = await blobs.get(`shares/${share.token}/share`);
    expect(new TextDecoder().decode(raw!)).not.toContain("#4a3222");
  });

  it("keeps the photo only when the person opted in", async () => {
    const { s } = store();
    const a = await s.create({ summary, label: null });
    expect(a.photoShared).toBe(false);
    expect(await s.photo(a.token)).toBeNull();
    const b = await s.create({ summary, label: null, photo: new Uint8Array([1, 2, 3]) });
    expect(await s.photo(b.token)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("revoking deletes the photo and inventory and reports revoked", async () => {
    const { s, blobs } = store();
    const sh = await s.create({ summary, label: null, photo: new Uint8Array([9]) });
    await s.addInventory(sh.token, [{ title: "Wig", url: null, imageUrl: "https://x/y.jpg", hex: null, colourFamily: "Brown", source: "salon" }]);
    await s.revoke(sh.token);
    expect((await s.get(sh.token)).status).toBe("revoked");
    expect(blobs.paths()).toEqual([`shares/${sh.token}/share`]);
  });

  it("expires after the TTL and purges the photo", async () => {
    const { s, blobs, setNow } = store();
    const sh = await s.create({ summary, label: null, photo: new Uint8Array([9]), ttlDays: 7 });
    setNow("2026-11-08T00:00:01Z");
    expect((await s.get(sh.token)).status).toBe("expired");
    expect(blobs.paths()).not.toContain(`shares/${sh.token}/photo`);
  });

  it("treats malformed tokens as missing without touching storage", async () => {
    const { s } = store();
    expect((await s.get("../../etc")).status).toBe("missing");
  });

  it("refuses inventory on a withdrawn share", async () => {
    const { s } = store();
    const sh = await s.create({ summary, label: null });
    await s.revoke(sh.token);
    await expect(s.addInventory(sh.token, [])).rejects.toThrow(/revoked/);
  });
});
