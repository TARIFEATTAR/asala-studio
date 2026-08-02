import { readFileSync } from "node:fs";
import { getBestBottlesFamilyProfileForProduct } from "../../src/config/bestBottlesFamilyProfiles";
const SNAP="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/2026-06-27-framing-profiles/convex_snapshot.json";
const snap=JSON.parse(readFileSync(SNAP,"utf8")) as {products:Array<Record<string,unknown>>};
const bySku=new Map(snap.products.map(p=>[p.graceSku as string,p]));
const skus=["GB-SPR-CLR-3ML-WHT","GB-CYL-CLR-9ML-T-11","GB-CYL-CLR-100ML-AST-BLK","GB-CYL-AMB-9ML-MRL-MCPR","GB-CYL-FRS-9ML-T-11","GB-CYL-BLU-5ML-MRL-BKDT"];
const isClear=(p:any)=>{const t=`${p.color??""} ${p.itemName??""}`.toLowerCase(); return t.includes("clear")&&!/amber|cobalt|blue|frost|swirl|green/.test(t);};
console.log("SKU".padEnd(26),"| material block   | fill target        | applicator");
console.log("-".repeat(95));
for(const s of skus){
  const p=bySku.get(s); if(!p){console.log(s,"(not in snapshot)");continue;}
  const prof=getBestBottlesFamilyProfileForProduct({family:p.family as string,bottleCollection:p.bottleCollection as string,category:p.category as string,itemName:p.itemName as string,capacityMl:Number(p.capacityMl)||null,applicator:p.applicator as string,heightWithCap:p.heightWithCap as string,heightWithoutCap:p.heightWithoutCap as string,diameter:p.diameter as string} as any);
  const mat=isClear(p)?"CLEAR_GLASS":"KEEP_MATERIAL";
  const rng=prof?`${prof.targetProductHeightRangePct.min}-${prof.targetProductHeightRangePct.max}% (${prof.relativeScaleZoneLabel})`:"(none)";
  console.log(s.padEnd(26),"|",mat.padEnd(15),"|",rng.padEnd(30).slice(0,30),"|",(p.applicator as string||"").slice(0,26));
}
