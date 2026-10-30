import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for everything a share stores at rest. The key lives only in the
// deployment's environment, so a leaked storage URL yields ciphertext.

const ALG = "aes-256-gcm";

export function keyFromEnv(b64 = process.env.SHARE_ENCRYPTION_KEY): Buffer {
  if (!b64) throw new Error("SHARE_ENCRYPTION_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("SHARE_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

/** Layout: 12-byte IV · 16-byte tag · ciphertext. */
export function seal(plain: Uint8Array, key: Buffer): Uint8Array {
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return new Uint8Array(Buffer.concat([iv, c.getAuthTag(), body]));
}

export function open(sealed: Uint8Array, key: Buffer): Uint8Array {
  const buf = Buffer.from(sealed);
  const d = createDecipheriv(ALG, key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return new Uint8Array(Buffer.concat([d.update(buf.subarray(28)), d.final()]));
}

export const newToken = () => randomBytes(18).toString("base64url");
