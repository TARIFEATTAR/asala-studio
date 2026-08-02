import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}catch{} }
(async()=>{const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const {data}=await sb.from("best_bottles_pipeline_sku_jobs").select("grace_sku,best_reference_candidate_path").eq("organization_id","4ab1ac72-cd7e-4faf-9152-5aa5f2862411").eq("family","Cylinder");
const usable=(p:string)=>p&&p.includes("/best-bottles/reference-images/")&&p.includes("pdp-main");
const pick=(re:RegExp)=>(data??[]).filter(r=>re.test(r.grace_sku as string)&&usable(r.best_reference_candidate_path as string)).slice(0,2).map(r=>r.grace_sku);
console.log("FROSTED w/ ref:",pick(/-FRS-/));
console.log("COBALT/BLUE w/ ref:",pick(/-BLU-/));
console.log("SWIRL w/ ref:",pick(/-SWL-|SWRL/));
console.log("AMBER w/ ref:",pick(/-AMB-/));
})();
