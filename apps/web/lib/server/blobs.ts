import { del, get, put } from "@vercel/blob";
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
    async del(paths) {
      await del(paths).catch(() => undefined);
    },
  };
}
