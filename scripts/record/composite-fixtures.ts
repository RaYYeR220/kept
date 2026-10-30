// Applies keepOnlyAdded to recorded brow renders (local, no API calls).
import { readFileSync, writeFileSync } from "node:fs";
import { undoRetouch } from "../../apps/web/lib/server/composite.ts";
for (const p of process.argv.slice(2)) {
  const orig = new Uint8Array(readFileSync(new URL(`../../apps/web/public/demo/${p}-during.jpg`, import.meta.url)));
  const file = new URL(`../../apps/web/fixtures/replay/${p}/renders/brows.jpg`, import.meta.url);
  const raw = new URL(`../../apps/web/fixtures/replay/${p}/renders/brows-raw.jpg`, import.meta.url);
  let render: Uint8Array;
  try { render = new Uint8Array(readFileSync(raw)); } catch { render = new Uint8Array(readFileSync(file)); writeFileSync(raw, render); }
  const t0 = Date.now();
  const { image, gain, offset } = await undoRetouch(orig, render);
  writeFileSync(file, image);
  console.log(p, "gain", gain.map((g) => g.toFixed(3)), "offset", offset.map((o) => o.toFixed(1)), Date.now() - t0, "ms");
}
