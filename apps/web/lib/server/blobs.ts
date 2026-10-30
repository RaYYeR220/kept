import { del, get, list, put } from "@vercel/blob";
import type { BlobBackend } from "./share-store";

/** Private Vercel Blob store. Everything written here is already AES-GCM sealed. */
export function vercelBlobs(): BlobBackend {
  return {
    async put(path, body) {
      await put(path, Buffer.from(body), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/octet-stream",
      });
    },
    async get(path) {
      const r = await get(path, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return new Uint8Array(await new Response(r.stream).arrayBuffer());
    },
    async list(prefix) {
      const out: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        out.push(...page.blobs.map((b) => b.pathname));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
    async del(paths) {
      await del(paths).catch(() => undefined);
    },
  };
}
