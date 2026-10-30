import sharp from "sharp";
import type { FaceBox } from "@kept/youcam";

/**
 * Crops a photo so the face fills `share` of the frame width. The face box comes from
 * YouCam's own pre-process step (normalised 0–1 coordinates). Portrait 4:5 frame.
 */
export async function cropToFace(bytes: Uint8Array, box: FaceBox, share = 0.7): Promise<Uint8Array> {
  const img = sharp(bytes).rotate();
  const { width = 0, height = 0 } = await img.metadata();
  if (!width || !height) throw new Error("Unreadable image");
  const faceW = box.width * width;
  const cropW = Math.min(width, Math.round(faceW / share));
  const cropH = Math.min(height, Math.round(cropW * 1.25));
  const cx = (box.left + box.width / 2) * width;
  const cy = (box.top + box.height / 2) * height;
  const left = Math.round(Math.min(Math.max(cx - cropW / 2, 0), width - cropW));
  const top = Math.round(Math.min(Math.max(cy - cropH * 0.45, 0), height - cropH));
  const out = await img.extract({ left, top, width: cropW, height: cropH }).jpeg({ quality: 92 }).toBuffer();
  return new Uint8Array(out);
}
