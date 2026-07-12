import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SHADOW_SMOKE_SKU = "GB-SPR-CLR-3ML-BLK";

export function useBestBottlesApprovedComparison(
  organizationId: string | null,
  graceSku: string | null,
) {
  return useQuery({
    queryKey: ["best-bottles-approved-comparison", organizationId, graceSku],
    enabled: Boolean(organizationId && graceSku === SHADOW_SMOKE_SKU),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("best_bottles_pipeline_sku_jobs")
        .select("approved_image_id,approved_image_url")
        .eq("organization_id", organizationId!)
        .eq("grace_sku", graceSku!)
        .maybeSingle();
      if (error) throw error;
      return data?.approved_image_url ?? null;
    },
  });
}
