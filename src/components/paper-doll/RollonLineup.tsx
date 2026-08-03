import { AlertTriangle, Columns3, Crosshair } from "lucide-react";

import type { PaperDollReleaseWorkbenchData } from "@/lib/paperDoll/releaseRepository";
import { buildRollonLineup, type RollonLineupAsset } from "./rollonLineupModel";
import { IDENTITY_FAMILY_PLACEMENT, type FamilyPlacementTransform } from "./familyPlacementModel";

interface RollonLineupProps {
  assets: PaperDollReleaseWorkbenchData["assets"];
  rollerVariantKey?: string;
  rollerImageUrlOverride?: string;
  overcapVariantKey?: string;
  overcapImageUrlOverride?: string;
  placementTransform?: FamilyPlacementTransform;
  placementSlot?: "roller" | "overcap";
  placementId?: string;
}

const BODY_LABELS: Record<string, string> = {
  CLR: "Clear",
  AMB: "Amber",
  BLU: "Cobalt",
  FRS: "Frosted",
  SWL: "Swirl",
};

export function RollonLineup({
  assets,
  rollerVariantKey = "PLASTIC",
  rollerImageUrlOverride,
  overcapVariantKey = null,
  overcapImageUrlOverride,
  placementTransform = IDENTITY_FAMILY_PLACEMENT,
  placementSlot = "roller",
  placementId,
}: RollonLineupProps) {
  const lineupAssets: RollonLineupAsset[] = assets
    .filter((asset) => asset.slot === "body" || asset.slot === "roller" || asset.slot === "overcap" || asset.slot === "cap")
    .map((asset) => ({
      componentVersionId: asset.componentVersionId,
      displayName: asset.displayName,
      slot: (asset.slot === "cap" ? "overcap" : asset.slot) as RollonLineupAsset["slot"],
      variantKey: asset.variantKey,
      imageUrl: asset.imageUrl,
    }));
  const lineup = buildRollonLineup(lineupAssets, { rollerVariantKey, overcapVariantKey, rollerImageUrlOverride, overcapImageUrlOverride });
  const complete = lineup.filter((item) => item.status === "complete").length;
  const placementPreviewActive = placementTransform.translateXPx !== 0
    || placementTransform.translateYPx !== 0
    || placementTransform.scaleX !== 1;

  return (
    <section className="rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(0,0,0,0.12)" }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--darkroom-accent)" }}><Columns3 className="h-3.5 w-3.5" />Five-body catalog lineup</div>
          <p className="mt-1 text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>{placementPreviewActive ? "One roller placement candidate · identical X/Y/scale across every locked body" : "Exact full-canvas layers · shared centerline, seat and baseline · no fallback assets"}</p>
        </div>
        <div className="text-right font-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: complete === 5 ? "#6ee7a8" : "#f2c078" }}>
          {complete}/5 complete · {overcapVariantKey ? `${rollerVariantKey} + ${overcapVariantKey}` : `${rollerVariantKey} roller fit`}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {lineup.map((item) => (
          <article key={item.bodyVariantKey} className="min-w-0 overflow-hidden rounded border" style={{ borderColor: item.status === "complete" ? "rgba(110,231,168,0.35)" : "rgba(242,192,120,0.28)", background: "rgba(255,255,255,0.015)" }}>
            <div className="relative aspect-[10/11] overflow-hidden bg-[#F5F3EF]">
              {([item.layers.body, item.layers.roller, item.layers.overcap] as const).map((layer, layerIndex) => layer ? (
                <img
                  key={layer.componentVersionId}
                  src={layer.imageUrl}
                  alt={layer.displayName}
                  className="absolute h-full w-full object-contain"
                  style={(placementSlot === "roller" && layerIndex === 1) || (placementSlot === "overcap" && layerIndex === 2) ? {
                    left: `${placementTransform.translateXPx / 2080 * 100}%`,
                    top: `${placementTransform.translateYPx / 2288 * 100}%`,
                    transform: `scale(${placementTransform.scaleX})`,
                    transformOrigin: "top left",
                  } : { inset: 0 }}
                />
              ) : null)}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-[#d7a85f]/50" />
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#61d6c8]/55" style={{ top: placementPreviewActive ? "33.22%" : "43.79%" }} />
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#c98068]/45" style={{ top: "90.38%" }} />
              {!item.layers.body && <div className="absolute inset-0 flex items-center justify-center text-[8px] uppercase tracking-wider text-[#c98068]">Body missing</div>}
            </div>
            <div className="border-t px-2 py-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--darkroom-text-muted)" }}>{BODY_LABELS[item.bodyVariantKey]}</span>
                <Crosshair className="h-3 w-3 shrink-0" style={{ color: "var(--darkroom-text-dim)" }} />
              </div>
              {placementId && <div className="mt-1 truncate font-mono text-[7px]" style={{ color: "#6ee7a8" }}>placement {placementId.slice(0, 8)}…</div>}
              {item.status === "blocked" && (
                <div className="mt-1.5 flex items-start gap-1 text-[7px] leading-3" style={{ color: "#f2c078" }}>
                  <AlertTriangle className="mt-px h-2.5 w-2.5 shrink-0" />
                  <span className="line-clamp-2">{item.issues.join(" · ")}</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
