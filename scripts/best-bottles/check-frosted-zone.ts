import { readFileSync } from "node:fs";
import { getBestBottlesFamilyProfileForProduct, getBestBottlesRelativeScaleZoneForProduct } from "../../src/config/bestBottlesFamilyProfiles";
const snap=JSON.parse(readFileSync("/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/2026-06-27-framing-profiles/convex_snapshot.json","utf8")) as {products:any[]};
const by=new Map(snap.products.map(p=>[p.graceSku,p]));
for (const sku of ["GB-CYL-CLR-9ML-T-11","GB-CYL-FRS-9ML-S-02","GB-CYL-FRS-9ML-T-11"]) {
  const p=by.get(sku); if(!p){console.log(sku,"missing");continue;}
  const inp={family:p.family,bottleCollection:p.bottleCollection,category:p.category,itemName:p.itemName,capacityMl:Number(p.capacityMl)||null,applicator:p.applicator,heightWithCap:p.heightWithCap,heightWithoutCap:p.heightWithoutCap,diameter:p.diameter};
  const prof=getBestBottlesFamilyProfileForProduct(inp as any);
  const zone=getBestBottlesRelativeScaleZoneForProduct(inp as any);
  console.log(sku, "| height(noCap):", p.heightWithoutCap, "| zone:", zone?.label, "| fill target:", prof?`${prof.targetProductHeightRangePct.min}-${prof.targetProductHeightRangePct.max}% (t=${prof.targetProductHeightPct})`:"none");
}
