import sharp from "sharp";
import { hairRegion, hairShadeName, labToHex, rgbToLab, robustMedianLab, type Lab } from "@kept/likeness";
import { parseFaceBoxes, type FaceBox, type YouCam } from "@kept/youcam";

export type HairSample = { hex: string; name: string; pixels: number };

/** Reads the hair colour above the forehead, given YouCam's face box for this image. */
export async function sampleHairFromBox(bytes: Uint8Array, box: FaceBox): Promise<HairSample | null> {
  const { data, info } = await sharp(bytes).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const region = hairRegion(box, info.width, info.height);
  if (!region) return null;
  const px: Lab[] = [];
  const step = Math.max(1, Math.floor(((region.x1 - region.x0) * (region.y1 - region.y0)) / 20_000));
  for (let y = region.y0; y < region.y1; y++) {
    for (let x = region.x0; x < region.x1; x += step) {
      const i = (y * info.width + x) * info.channels;
      px.push(rgbToLab(data[i]!, data[i + 1]!, data[i + 2]!));
    }
  }
  const median = robustMedianLab(px);
  return median ? { hex: labToHex(median), name: hairShadeName(median), pixels: px.length } : null;
}

/** Finds the face with YouCam's free pre-process step, then samples the hair. */
export async function sampleHair(yc: YouCam, bytes: Uint8Array, sessionId: string): Promise<(HairSample & { taskId: string }) | null> {
  const jpeg = new Uint8Array(await sharp(bytes).rotate().jpeg({ quality: 92 }).toBuffer());
  const { fileId } = await yc.upload(jpeg, "image/jpeg", "sample.jpg");
  const pre = await yc.run("facePre", { src_file_id: fileId }, { sessionId });
  await yc.deleteTask(pre.taskId).catch(() => undefined);
  const box = parseFaceBoxes(pre.results)[0];
  if (!box) return null;
  const s = await sampleHairFromBox(jpeg, box);
  return s ? { ...s, taskId: pre.taskId } : null;
}
