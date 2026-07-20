import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env", ".env.local"]) { try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} }
const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const ARMS = [["cap-lock","CAP-LOCK v1  ·  minimal  ·  ← clean glass"],["none","CANON-ONLY  ·  no addendum  ·  clean glass"],["truth-v2","TRUTH v2  ·  full stack  ·  mottled glass"]];
const SKUS = ["GB-CYL-CLR-9ML-T-11","GB-SPR-CLR-3ML-WHT"];
(async () => {
  const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: jobs } = await sb.from("best_bottles_pipeline_sku_jobs").select("grace_sku,best_reference_candidate_path").eq("organization_id","4ab1ac72-cd7e-4faf-9152-5aa5f2862411").eq("family","Cylinder");
  const ref = new Map((jobs ?? []).map((j) => [j.grace_sku as string, (j.best_reference_candidate_path as string) || ""]));
  const cell = (url: string, label: string, cls = "") =>
    `<figure class="${cls}"><div class="iw"><img src="${esc(url)}"><i class="bl"></i></div><figcaption>${esc(label)}</figcaption></figure>`;
  let body = "";
  for (const [arm, label] of ARMS) {
    const clsArm = arm === "truth-v2" ? "bad" : "good";
    let row = `<h2 class="${clsArm}">${esc(label)}</h2>`;
    for (const sku of SKUS) {
      const cells: string[] = [];
      if (ref.get(sku)) cells.push(cell(ref.get(sku)!, `REFERENCE · ${sku}`, "ref"));
      for (const rep of [1, 2]) {
        try {
          const e = JSON.parse(readFileSync(`tmp/bestbottles-generation/promptab-${arm}-${rep}.json`, "utf8")).entries[sku];
          if (e?.status === "rendered") cells.push(cell(e.imageUrl, `${sku} · sample ${rep}`));
        } catch {}
      }
      row += `<div class="row">${cells.join("")}</div>`;
    }
    body += `<section class="${clsArm}">${row}</section>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Prompt A/B — glass comparison</title><style>
:root{--bone:#F5F3EF}body{margin:0;background:#111;color:#eee;font:14px/1.4 -apple-system,system-ui,sans-serif}
header{padding:16px 24px;background:#000;border-bottom:1px solid #333;position:sticky;top:0;z-index:5}
header b{font-size:17px}header span{color:#999;margin-left:10px}
section{padding:14px 24px;border-bottom:2px solid #222}
section.good{background:#0e1a0e}section.bad{background:#1e0e0e}
h2{font-size:16px;margin:4px 0 12px}h2.good{color:#7ed321}h2.bad{color:#ff6b5e}
.row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px}
figure{margin:0}
.iw{position:relative;width:360px;height:396px}
.iw img{width:100%;height:100%;object-fit:contain;background:var(--bone);border-radius:6px;cursor:zoom-in}
.ref .iw img{border:3px solid #7ed321}
.bl{position:absolute;left:3%;right:3%;top:91%;border-top:2px dashed rgba(255,60,60,.85)}
figcaption{color:#aaa;font-size:12px;margin-top:5px;text-align:center;width:360px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:20;cursor:zoom-out}
#lb.on{display:flex}#lb img{max-width:96vw;max-height:96vh;background:var(--bone)}
</style></head><body>
<header><b>Prompt A/B — glass comparison</b><span>green = clean glass · red = mottled · dashed line = baseline · click any image to zoom full-res</span></header>
${body}
<div id="lb" onclick="this.classList.remove('on')"><img id="lbi"></div>
<script>document.querySelectorAll('.iw img').forEach(im=>im.onclick=e=>{document.getElementById('lbi').src=im.src;document.getElementById('lb').classList.add('on');});</script>
</body></html>`;
  const out = path.resolve("tmp/bestbottles-generation/prompt-ab-comparison.html");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log("wrote", out);
})();
