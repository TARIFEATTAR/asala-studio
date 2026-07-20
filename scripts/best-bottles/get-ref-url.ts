import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,"");}}catch{} }
(async()=>{const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const {data}=await sb.from("best_bottles_pipeline_sku_jobs").select("best_reference_candidate_path").eq("organization_id","4ab1ac72-cd7e-4faf-9152-5aa5f2862411").eq("grace_sku","GB-CYL-CLR-9ML-T-11").limit(1);
console.log(data?.[0]?.best_reference_candidate_path);})();
