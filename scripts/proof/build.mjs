// Collects the evaluation reports into apps/web/data/proof.json for the /proof page.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

const brows = Object.fromEntries(
  ["anna", "marcus"].map((p) => {
    const f = join(root, "apps", "web", "fixtures", "replay", p, "brows.json");
    if (!existsSync(f)) return [p, null];
    const b = JSON.parse(readFileSync(f, "utf8"));
    return [p, { targetHex: b.targetHex, rounds: b.rounds.map((r) => ({ round: r.round, measuredHex: r.measuredHex, deltaE: r.deltaE === null ? null : Number(r.deltaE.toFixed(1)), units: r.units })), best: b.deltaE === null ? null : Number(b.deltaE.toFixed(1)) }];
  }),
);
const auditFile = existsSync(join(root, "data")) ? readdirSync(join(root, "data")).filter((f) => /^audit-.*\.json$/.test(f)).sort().at(-1) : undefined;
const audit = auditFile ? (({ date, groups, crossed, measured }) => ({ file: `data/${auditFile}`, date, groups, crossed, measured }))(JSON.parse(readFileSync(join(root, "data", auditFile), "utf8"))) : null;
const out = { generatedAt: new Date().toISOString(), runs, brows, audit };
writeFileSync(join(root, "apps", "web", "data", "proof.json"), JSON.stringify(out, null, 1));
console.log(`proof.json: ${runs.length} runs, brows ${Object.keys(brows).length}, audit ${audit ? audit.measured : "none"}`);
