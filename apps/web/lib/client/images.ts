"use client";

/** Re-encode a photo as JPEG with its long side capped (hair try-on needs ≤ 1024). */
export async function toJpeg(blob: Blob, maxSide: number, quality = 0.9): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

export const b64ToBlob = (b64: string, type = "image/jpeg") => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type });

export async function demoPhoto(persona: string, slot: string): Promise<Blob> {
  const res = await fetch(`/demo/${persona}-${slot === "today" ? "during" : slot}.jpg`);
  if (!res.ok) throw new Error("Demo photo missing");
  return res.blob();
}
