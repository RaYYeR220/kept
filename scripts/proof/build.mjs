// Collects the evaluation reports into apps/web/data/proof.json for the /proof page.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const dir = join(root, "eval", "reports");

const runs = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && !f.includes("smoke"))
  .map((f) => {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const tag = f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.json$/, "");
    const byMode = {};
    for (const x of r.results) {
      const m = (byMode[x.mode] ??= {});
      const c = (m[x.category] ??= { pass: 0, total: 0 });
      c.total++;
      if (x.pass) c.pass++;
    }
    return { tag, file: `eval/reports/${f.replace(/\.json$/, ".md")}`, date: r.date, model: r.model, code: r.code, byMode };
  });

const out = { generatedAt: new Date().toISOString(), runs };
writeFileSync(join(root, "apps", "web", "data", "proof.json"), JSON.stringify(out, null, 1));
console.log(`proof.json: ${runs.length} runs`);
