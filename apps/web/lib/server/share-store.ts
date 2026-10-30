import { lookupStatus, type LikenessSummary, type ShareLookup, type SharedLikeness } from "@kept/likeness";
import { newToken, open, seal } from "./crypto";

export type InventoryItem = {
  id: string;
  title: string;
  url: string | null;
  imageUrl: string;
  /** Colour measured or sampled on the listing photo, with where it came from. */
  hex: string | null;
  colourFamily: string | null;
  source: string;
  addedAt: string;
};

/** Minimal blob API so the store runs on Vercel Blob in production and in memory in tests. */
export type BlobBackend = {
  put(path: string, body: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  del(paths: string[]): Promise<void>;
  list(prefix: string): Promise<string[]>;
};

export class ShareStore {
  constructor(
    private readonly blobs: BlobBackend,
    private readonly key: Buffer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async putJson(path: string, value: unknown) {
    await this.blobs.put(path, seal(new TextEncoder().encode(JSON.stringify(value)), this.key));
  }

  private async getJson<T>(path: string): Promise<T | null> {
    const raw = await this.blobs.get(path);
    return raw ? (JSON.parse(new TextDecoder().decode(open(raw, this.key))) as T) : null;
  }

  async create(input: { summary: LikenessSummary; label: string | null; photo?: Uint8Array; ttlDays?: number }): Promise<SharedLikeness> {
    const token = newToken();
    const created = this.now();
    const share: SharedLikeness = {
      token,
      summary: input.summary,
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + (input.ttlDays ?? 7) * 86_400_000).toISOString(),
      revoked: false,
      photoShared: Boolean(input.photo),
      label: input.label,
    };
    await this.putJson(`shares/${token}/share`, share);
    if (input.photo) await this.blobs.put(`shares/${token}/photo`, seal(input.photo, this.key));
    return share;
  }

  async raw(token: string): Promise<SharedLikeness | null> {
    if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) return null;
    return this.getJson<SharedLikeness>(`shares/${token}/share`);
  }

  async get(token: string): Promise<ShareLookup> {
    const lookup = lookupStatus(await this.raw(token), this.now().toISOString());
    if (lookup.status === "expired") await this.purge(token);
    return lookup;
  }

  async photo(token: string): Promise<Uint8Array | null> {
    const l = await this.get(token);
    if (l.status !== "ok" || !l.share.photoShared) return null;
    const raw = await this.blobs.get(`shares/${token}/photo`);
    return raw ? open(raw, this.key) : null;
  }

  /** Withdrawing a share deletes the photo and inventory at once and leaves only a tombstone. */
  async revoke(token: string): Promise<void> {
    const s = await this.raw(token);
    if (!s) return;
    await this.blobs.del([`shares/${token}/photo`, `shares/${token}/inventory`]);
    // Only a tombstone remains: no measurements, no label.
    const tomb = { token, createdAt: s.createdAt, expiresAt: s.expiresAt, revoked: true, photoShared: false, label: null, summary: null };
    await this.putJson(`shares/${token}/share`, tomb);
  }

  private async purge(token: string) {
    await this.blobs.del([`shares/${token}/photo`, `shares/${token}/inventory`]);
  }

  /** Deletes the photo and inventory of every expired share. Run on a schedule. */
  async sweep(): Promise<{ checked: number; purged: number }> {
    const tokens = [...new Set((await this.blobs.list("shares/")).map((p) => p.split("/")[1]).filter((t): t is string => Boolean(t)))];
    let purged = 0;
    for (const t of tokens) {
      const s = await this.raw(t);
      if (!s || s.revoked || Date.parse(s.expiresAt) <= this.now().getTime()) {
        await this.purge(t);
        purged++;
      }
    }
    return { checked: tokens.length, purged };
  }

  async addInventory(token: string, items: Omit<InventoryItem, "id" | "addedAt">[]): Promise<InventoryItem[]> {
    const l = await this.get(token);
    if (l.status !== "ok") throw new Error(l.status);
    const current = (await this.getJson<InventoryItem[]>(`shares/${token}/inventory`)) ?? [];
    const at = this.now().toISOString();
    const next = [...current, ...items.map((i) => ({ ...i, id: newToken().slice(0, 10), addedAt: at }))].slice(-60);
    await this.putJson(`shares/${token}/inventory`, next);
    return next;
  }

  async listInventory(token: string): Promise<InventoryItem[]> {
    const l = await this.get(token);
    if (l.status !== "ok") return [];
    return (await this.getJson<InventoryItem[]>(`shares/${token}/inventory`)) ?? [];
  }
}

export function memoryBlobs(): BlobBackend & { paths(): string[] } {
  const m = new Map<string, Uint8Array>();
  return {
    put: async (p, b) => void m.set(p, b),
    get: async (p) => m.get(p) ?? null,
    del: async (ps) => ps.forEach((p) => m.delete(p)),
    list: async (prefix) => [...m.keys()].filter((k) => k.startsWith(prefix)),
    paths: () => [...m.keys()],
  };
}
