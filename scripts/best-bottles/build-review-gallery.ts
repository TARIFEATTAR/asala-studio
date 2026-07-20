/**
 * Build a self-contained local HTML review gallery for Best Bottles cylinder
 * renders: every generated version grouped by SKU, newest-first, shown next to
 * its live reference. READ-ONLY. Emits one .html file you open in a browser —
 * loads images straight from their Supabase public URLs (no server needed).
 *
 * Purpose: finally SEE and COMPARE the render pile so keep/trash decisions are
 * possible. Also serves as a portable index (all URLs in one file).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getBestBottlesRelativeScaleZoneForProduct } from "../../src/config/bestBottlesFamilyProfiles";
for (const f of [".env", ".env.local"]) {
  try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch { /* */ }
}
const ORG = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tagsOf = (t: unknown): string[] => (Array.isArray(t) ? (t as string[]).filter((x) => typeof x === "string") : []);
const skuOf = (tags: string[]): string | null => { const s = tags.find((x) => x.startsWith("sku:")); return s ? s.slice(4) : null; };
const runOf = (tags: string[]): string => { const r = tags.find((x) => x.startsWith("family-run:")); return r ? r.slice(11) : ""; };

(async () => {
  const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // Renders (cylinder) from generated_images.
  // Prompt lineage: prompt-addendum:<id> tag → short badge label + class.
  const promptBadge = (tags: string[]): { label: string; cls: string } => {
    const a = tags.find((x) => x.startsWith("prompt-addendum:"))?.slice("prompt-addendum:".length) ?? "";
    // component-identity-lock-v1 is the LOCKED winner (with the v6 reproduce-only
    // canon — canon version isn't tagged, so use the smoke-test run filter to
    // isolate the newest good batch). Everything else was tried and rejected.
    if (a === "component-identity-lock-v1") return { label: "★ LOCKED · cap-lock v1", cls: "p4" };
    if (a === "cylinder-truth-v2") return { label: "truth v2 (rejected)", cls: "p1" };
    if (a === "cylinder-truth-v1") return { label: "truth v1 (rejected)", cls: "p1" };
    if (a === "component-identity-glass-presence-v2") return { label: "glass v2 (rejected)", cls: "p1" };
    if (a === "component-identity-glass-presence-v1") return { label: "glass v1 (rejected)", cls: "p1" };
    if (a) return { label: a.slice(0, 22), cls: "p0" };
    return { label: "canon-only (no lock)", cls: "p1" };
  };
  const renders: Array<{ url: string; sku: string; created: string; run: string; pLabel: string; pCls: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("generated_images").select("image_url,library_tags,created_at").eq("organization_id", ORG).order("created_at", { ascending: false }).range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const tags = tagsOf(r.library_tags);
      const sku = skuOf(tags);
      const isCyl = tags.includes("family:cylinder") || (sku && (sku.startsWith("GB-CYL") || sku.startsWith("GB-SPR")));
      const url = String(r.image_url || "");
      if (!isCyl || !sku) continue;
      if (url.includes("/reference-images/") || url.includes("/clean-references/")) continue; // skip refs
      const pb = promptBadge(tags);
      renders.push({ url, sku, created: String(r.created_at || ""), run: runOf(tags), pLabel: pb.label, pCls: pb.cls });
    }
    if (data.length < 1000) break;
  }

  // References + product group lane from the job table.
  const refBySku = new Map<string, string>();
  const groupBySku = new Map<string, string>();
  const { data: jobs } = await sb.from("best_bottles_pipeline_sku_jobs").select("grace_sku,best_reference_candidate_path,product_group_slug").eq("organization_id", ORG).eq("family", "Cylinder");
  for (const j of jobs ?? []) {
    refBySku.set(j.grace_sku as string, (j.best_reference_candidate_path as string) || "");
    groupBySku.set(j.grace_sku as string, (j.product_group_slug as string) || "unknown");
  }

  // Per-SKU fill-height target zone — computed with the SAME resolver + Convex
  // product join the rig QA uses, so the guides show the actual contract.
  const SNAPSHOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/2026-06-27-framing-profiles/convex_snapshot.json";
  const zoneBySku = new Map<string, { min: number; max: number; label: string }>();
  try {
    const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { products: Array<Record<string, unknown>> };
    for (const row of snap.products) {
      const sku = typeof row.graceSku === "string" ? row.graceSku : null;
      if (!sku) continue;
      const zone = getBestBottlesRelativeScaleZoneForProduct({
        family: (row.family as string) ?? null,
        bottleCollection: (row.bottleCollection as string) ?? null,
        category: (row.category as string) ?? null,
        itemName: (row.itemName as string) ?? null,
        capacityMl: typeof row.capacityMl === "number" ? row.capacityMl : Number(row.capacityMl) || null,
        applicator: (row.applicator as string) ?? null,
        heightWithCap: (row.heightWithCap as string) ?? null,
        heightWithoutCap: (row.heightWithoutCap as string) ?? null,
        diameter: (row.diameter as string) ?? null,
      } as Parameters<typeof getBestBottlesRelativeScaleZoneForProduct>[0]);
      if (zone) zoneBySku.set(sku, { min: zone.targetProductHeightRangePct.min, max: zone.targetProductHeightRangePct.max, label: zone.label });
    }
  } catch (e) {
    console.warn("Convex snapshot join failed — fill bands omitted:", (e as Error).message);
  }

  // Group renders by SKU.
  const bySku = new Map<string, typeof renders>();
  for (const r of renders) { (bySku.get(r.sku) ?? bySku.set(r.sku, []).get(r.sku)!).push(r); }
  const skus = [...bySku.keys()].sort();

  // Baseline: rig contract puts the product base BEST_BOTTLES_SHARED_BASELINE_PCT
  // (9%) above the bottom edge → dashed line at 91% of image height. Cells use
  // the exact 2080:2288 ratio, so the CSS overlay maps 1:1 onto true pixels.
  // Guides per render: baseline (91%), canvas center line, and the SKU's
  // fill-height target band (top of bottle must land inside the band:
  // from (91 - max)% to (91 - min)% of canvas height).
  const guidesFor = (sku: string): string => {
    const z = zoneBySku.get(sku);
    const band = z
      ? `<i class="band" style="top:${(91 - z.max).toFixed(1)}%;height:${(z.max - z.min).toFixed(1)}%"></i><b class="bandlbl" style="top:${(91 - z.max).toFixed(1)}%">${esc(z.label)} ${z.min}–${z.max}%</b>`
      : "";
    return `<i class="bl"></i><i class="cl"></i>${band}`;
  };
  const sections = skus.map((sku) => {
    const list = (bySku.get(sku) ?? []).sort((a, b) => b.created.localeCompare(a.created));
    const ref = refBySku.get(sku) || "";
    const group = groupBySku.get(sku) || "unknown";
    const refCell = ref
      ? `<figure class="ref"><div class="iw"><img loading="lazy" src="${esc(ref)}"></div><figcaption>REFERENCE</figcaption></figure>`
      : `<figure class="ref none"><div class="iw"><div class="noref">no reference</div></div><figcaption>REFERENCE</figcaption></figure>`;
    const cells = list.map((r, i) => `<figure class="rend${i === 0 ? " latest" : ""}" data-sku="${esc(sku)}" data-url="${esc(r.url)}" data-created="${esc(r.created)}" data-plabel="${esc(r.pLabel)}" data-pcls="${r.pCls}" data-run="${esc(r.run)}"><span class="pick" title="select as keeper">✓</span><span class="pv ${r.pCls}">${esc(r.pLabel)}</span><div class="iw"><img loading="lazy" src="${esc(r.url)}">${guidesFor(sku)}</div><figcaption>${i === 0 ? "◀ latest · " : ""}${esc(r.created.slice(0, 16).replace("T", " "))}</figcaption></figure>`).join("");
    return `<section data-sku="${esc(sku)}" data-group="${esc(group)}"><h2>${esc(sku)} <span class="grp">${esc(group)}</span> <span class="count">${list.length} version${list.length === 1 ? "" : "s"}</span><button class="gz" onclick="groupZoom('${esc(sku)}')">⤢ zoom row</button></h2><div class="row">${refCell}${cells}</div></section>`;
  }).join("\n");
  const groupOptions = [...new Set([...groupBySku.values()])].sort().map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");

  // Smoke-test / run options: distinct family-run ids, most recent first.
  const runMap = new Map<string, { count: number; labels: Set<string>; latest: string }>();
  for (const r of renders) {
    if (!r.run) continue;
    const e = runMap.get(r.run) ?? { count: 0, labels: new Set<string>(), latest: "" };
    e.count++; e.labels.add(r.pLabel); if (r.created > e.latest) e.latest = r.created;
    runMap.set(r.run, e);
  }
  const runOptions = [...runMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([run, e], i) =>
    `<option value="${esc(run)}">${i === 0 ? "★ latest · " : ""}${esc((e.latest || run).slice(0, 16).replace("T", " "))} · ${esc([...e.labels].join("/"))} · ${e.count} renders</option>`,
  ).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Best Bottles — Cylinder review gallery</title>
<style>
:root{--bone:#F5F3EF;--w:150px;--h:165px}
body{margin:0;background:#111;color:#eee;font:13px/1.4 -apple-system,system-ui,sans-serif}
header{position:sticky;top:0;background:#000;padding:12px 20px;border-bottom:1px solid #333;z-index:10;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header b{font-size:16px}header .sub{color:#999}
.sizes button,.actions button{background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:12px}
.sizes button.on{background:#4a90d9;border-color:#4a90d9;color:#fff}
.sizes button.newest{background:#2a3a1a;border-color:#7ed321;color:#7ed321;font-weight:600}
.sizes button.newest.on{background:#7ed321;border-color:#7ed321;color:#000}
.actions button.export{background:#7ed321;border-color:#7ed321;color:#000;font-weight:600}
#selcount{color:#f5a623;font-weight:600}
section{padding:10px 20px;border-bottom:1px solid #222}
h2{font-size:14px;margin:6px 0;position:sticky;top:56px;background:#111;padding:6px 0;z-index:5}
h2 .count{color:#f5a623;font-weight:normal;margin-left:8px}
h2 .gz{margin-left:12px;background:#222;color:#bbb;border:1px solid #444;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px}
.row{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px}
figure{margin:0;flex:0 0 auto;width:var(--w);text-align:center;position:relative}
.iw{position:relative;width:var(--w);height:var(--h)}
.iw img{width:100%;height:100%;object-fit:contain;background:var(--bone);border-radius:4px;border:2px solid transparent;cursor:zoom-in;box-sizing:border-box}
.bl{position:absolute;left:3%;right:3%;top:91%;border-top:2px dashed rgba(255,59,48,.8);pointer-events:none}
.cl{position:absolute;top:3%;bottom:3%;left:50%;border-left:1px dashed rgba(74,144,217,.55);pointer-events:none}
.band{position:absolute;left:3%;right:3%;background:rgba(126,211,33,.12);border-top:1.5px dashed rgba(126,211,33,.75);border-bottom:1.5px dashed rgba(126,211,33,.75);pointer-events:none}
.bandlbl{position:absolute;left:4%;transform:translateY(-110%);font-size:9px;color:rgba(126,211,33,.95);background:rgba(0,0,0,.45);padding:1px 4px;border-radius:2px;pointer-events:none;font-weight:600}
body.noguides .bl,body.noguides .cl,body.noguides .band,body.noguides .bandlbl{display:none}
h2 .grp{color:#4a90d9;font-weight:normal;font-size:12px;margin-left:8px}
.filters select{background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:4px 8px;font-size:12px;max-width:280px}
figure.latest .iw img{border-color:#4a90d9}
figure.ref .iw img,figure.ref .noref{border-color:#7ed321}
figure.sel .iw img{border-color:#f5a623;box-shadow:0 0 0 2px #f5a623}
.pick{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.55);color:#888;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;z-index:2;user-select:none}
figure.sel .pick{background:#f5a623;color:#000;font-weight:700}
.pv{position:absolute;top:6px;left:6px;z-index:2;font-size:10px;padding:2px 6px;border-radius:3px;background:#333;color:#bbb;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv.p4{background:#7ed321;color:#000;font-weight:700}
.pv.p3{background:#4a90d9;color:#fff}
.pv.p2{background:#9b59b6;color:#fff}
.pv.p1{background:#333;color:#999}
.pv.p0{background:#555;color:#ddd}
.noref{width:100%;height:100%;background:#222;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;border:2px solid #7ed321;box-sizing:border-box}
figcaption{color:#999;font-size:11px;margin-top:3px}
figure.latest figcaption{color:#4a90d9}figure.ref figcaption{color:#7ed321}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:100;cursor:zoom-out}
#lb.on{display:flex}
#lb .iw{width:auto;height:92vh;aspect-ratio:2080/2288}
#lb .iw img{cursor:zoom-out}
#lb .cap{position:fixed;bottom:14px;left:0;right:0;text-align:center;color:#ccc;font-size:13px}
#gzv{position:fixed;inset:0;background:rgba(0,0,0,.95);display:none;z-index:100;flex-direction:column}
#gzv.on{display:flex}
#gzv .bar{padding:12px 20px;color:#eee;display:flex;gap:16px;align-items:center}
#gzv .bar b{font-size:15px}
#gzv .bar button{background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:4px 14px;cursor:pointer}
#gzv .strip{flex:1;display:flex;gap:14px;overflow-x:auto;align-items:center;padding:0 24px 24px}
#gzv figure{width:auto}
#gzv .iw{width:auto;height:72vh;aspect-ratio:2080/2288}
#gzv .pick{width:32px;height:32px;font-size:18px;top:10px;right:10px}
#gzv .pv{font-size:12px;top:10px;left:10px}
#gzv figcaption{font-size:13px;margin-top:6px}
</style></head><body>
<header>
  <b>Best Bottles — Cylinder review gallery</b><span class="sub">${skus.length} SKUs · ${renders.length} renders · green=ref · blue=latest · gold=selected · <span id="shown">${skus.length} SKUs shown</span></span>
  <span class="sizes">size <button data-s="S" class="on">S</button><button data-s="M">M</button><button data-s="L">L</button></span>
  <span class="sizes"><button id="gtoggle" class="on" onclick="toggleGuides()">guides ON</button></span>
  <span class="sizes"><button id="newestonly" class="newest" onclick="toggleNewest()">★ Newest prompt only</button></span>
  <span class="filters">lane <select id="gfilter" onchange="applyFilters()"><option value="">all product groups</option>${groupOptions}</select>
  prompt <select id="pfilter" onchange="applyFilters()"><option value="">all prompts</option><option value="p4">★ LOCKED · cap-lock v1</option><option value="p1">rejected / canon-only</option></select>
  smoke test <select id="rfilter" onchange="applyRunFilter()"><option value="">— pick a run —</option>${runOptions}</select></span>
  <span class="actions"><span id="selcount">0 selected</span> <button class="export" onclick="exportSel()">Export selections</button> <button onclick="clearSel()">Clear</button></span>
</header>
<div id="flatview" style="display:none;padding:10px 20px">
  <h2 id="flattitle" style="position:static"></h2>
  <div class="row" id="flatrow" style="flex-wrap:wrap;align-items:flex-start"></div>
</div>
${sections}
<div id="lb" onclick="this.classList.remove('on')"><div class="iw"><img id="lbimg"><i class="bl" id="lbbl"></i></div><div class="cap" id="lbcap"></div></div>
<div id="gzv"><div class="bar"><b id="gztitle"></b><span id="gzhint" style="color:#999">✓ to select · click image for full zoom · red dashes = target baseline</span><button onclick="document.getElementById('gzv').classList.remove('on')">✕ close</button></div><div class="strip" id="gzstrip"></div></div>
<style>#lb{z-index:130}</style>
<script>
const SIZES={S:[150,165],M:[280,308],L:[460,506]};
document.querySelectorAll('.sizes button').forEach(b=>b.onclick=()=>{const[w,h]=SIZES[b.dataset.s];document.documentElement.style.setProperty('--w',w+'px');document.documentElement.style.setProperty('--h',h+'px');document.querySelectorAll('.sizes button').forEach(x=>x.classList.toggle('on',x===b));});
const KEY='bb-cyl-gallery-selections';
let sel={};try{sel=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
function paint(){let n=0;document.querySelectorAll('figure.rend').forEach(f=>{const on=!!sel[f.dataset.url];f.classList.toggle('sel',on);if(on)n++;});document.getElementById('selcount').textContent=n+' selected';}
function save(){localStorage.setItem(KEY,JSON.stringify(sel));paint();}
function togglePick(f){const u=f.dataset.url;if(sel[u])delete sel[u];else sel[u]={sku:f.dataset.sku,url:u,created:f.dataset.created,prompt:f.dataset.plabel||''};save();}
function wire(scope){
  scope.querySelectorAll('figure.rend .pick').forEach(p=>p.onclick=e=>{e.stopPropagation();const f=p.closest('figure');togglePick(f);if(scope!==document)f.classList.toggle('sel',!!sel[f.dataset.url]);});
  scope.querySelectorAll('figure .iw img').forEach(im=>im.onclick=()=>{const fig=im.closest('figure');const isRend=fig.classList.contains('rend');document.getElementById('lbimg').src=im.src;document.getElementById('lbbl').style.display=isRend?'':'none';document.getElementById('lbcap').textContent=((fig.dataset.sku||'reference'))+(fig.dataset.plabel?' · '+fig.dataset.plabel:'')+' — click anywhere to close';document.getElementById('lb').classList.add('on');});
}
function groupZoom(sku){
  const section=document.querySelector('section[data-sku="'+CSS.escape(sku)+'"]');if(!section)return;
  const strip=document.getElementById('gzstrip');strip.innerHTML='';
  section.querySelectorAll('figure').forEach(f=>{const c=f.cloneNode(true);c.classList.toggle('sel',!!(c.dataset.url&&sel[c.dataset.url]));strip.appendChild(c);});
  document.getElementById('gztitle').textContent=sku;
  wire(strip);
  document.getElementById('gzv').classList.add('on');
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('lb').classList.remove('on');document.getElementById('gzv').classList.remove('on');}});
function toggleGuides(){const on=!document.body.classList.toggle('noguides');const b=document.getElementById('gtoggle');b.textContent='guides '+(on?'ON':'off');b.classList.toggle('on',on);}
function toggleNewest(){const b=document.getElementById('newestonly');const on=b.classList.toggle('on');document.getElementById('pfilter').value=on?'p4':'';b.textContent=on?'★ Newest only ✓':'★ Newest prompt only';document.getElementById('rfilter').value='';document.getElementById('flatview').style.display='none';applyFilters();}
function applyRunFilter(){
  const run=document.getElementById('rfilter').value;
  const fv=document.getElementById('flatview');
  if(!run){fv.style.display='none';document.querySelectorAll('section').forEach(s=>s.style.display='');applyFilters();return;}
  // Flat "all in a row" view of one smoke test.
  document.querySelectorAll('section').forEach(s=>s.style.display='none');
  const row=document.getElementById('flatrow');row.innerHTML='';
  let n=0;const opt=document.querySelector('#rfilter option[value="'+CSS.escape(run)+'"]');
  document.querySelectorAll('figure.rend').forEach(f=>{if(f.dataset.run===run){const c=f.cloneNode(true);c.classList.toggle('sel',!!sel[c.dataset.url]);const cap=c.querySelector('figcaption');if(cap)cap.textContent=f.dataset.sku+' · '+cap.textContent.replace('◀ latest · ','');row.appendChild(c);n++;}});
  document.getElementById('flattitle').textContent=(opt?opt.textContent:run)+'  —  '+n+' renders in a row';
  fv.style.display='';wire(row);document.getElementById('shown').textContent=n+' renders (1 run)';
}
function applyFilters(){
  const g=document.getElementById('gfilter').value;
  const p=document.getElementById('pfilter').value;
  let shown=0;
  document.querySelectorAll('section').forEach(s=>{
    const gOk=!g||s.dataset.group===g;
    let anyFig=false;
    s.querySelectorAll('figure.rend').forEach(f=>{const pOk=!p||f.dataset.pcls===p;f.style.display=pOk?'':'none';if(pOk)anyFig=true;});
    const show=gOk&&anyFig;
    s.style.display=show?'':'none';if(show)shown++;
  });
  document.getElementById('shown').textContent=shown+' SKUs shown';
}
function exportSel(){const items=Object.values(sel);const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),count:items.length,purpose:'approved-keep candidates',items},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bb-cylinder-selections.json';a.click();}
function clearSel(){if(confirm('Clear all selections?')){sel={};save();}}
wire(document);paint();
</script>
</body></html>`;

  const outDir = path.resolve("tmp/bestbottles-generation");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "cylinder-review-gallery.html");
  writeFileSync(out, html);
  console.log(`Gallery written: ${out}`);
  console.log(`  ${skus.length} cylinder SKUs, ${renders.length} render versions, refs for ${[...refBySku.values()].filter(Boolean).length} SKUs`);
})();
