import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env", ".env.local"]) { try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} }
(async () => {
  const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.from("generated_images").select("image_url,library_tags,created_at").eq("organization_id", "4ab1ac72-cd7e-4faf-9152-5aa5f2862411").order("created_at", { ascending: false }).limit(60);
  for (const r of data ?? []) {
    const tags: string[] = Array.isArray(r.library_tags) ? r.library_tags : [];
    const sku = tags.find((t) => t.startsWith("sku:"))?.slice(4) ?? "";
    if (sku === "GB-CYL-CLR-100ML-AST-BLK" || sku === "GB-CYL-CLR-50ML-AST-GLD") console.log(sku, r.created_at, r.image_url);
  }
})();
