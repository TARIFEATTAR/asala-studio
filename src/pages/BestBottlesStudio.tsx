/**
 * Best Bottles Product Studio — dedicated workspace for master creation,
 * paper-doll component generation, and composited variant preview for one
 * productGroup (family + capacity + color cohort).
 *
 * Routes: /best-bottles/studio/:groupSlug
 * Data source: Convex `productGroups` + `products` tables, read via the
 *   `bestbottles-convex` Supabase edge function proxy.
 *
 * Aesthetic: mirrors DarkRoom's camera-body tokens (`@/styles/darkroom.css`)
 * — .dark-room-container / .dark-room-header / .camera-panel /
 * LEDIndicator / LCDDisplay / FirmwarePresetButton — so the Studio feels
 * like another mode of the same instrument, not a foreign surface.
 *
 * Scope of this commit (shell only):
 * - Loads productGroup + variants from Convex
 * - Renders header, sidebar (SKU list + progress), and tab switcher
 * - Three tabs exist but content is skeleton: Masters / Components / Compose
 *
 * Master creation, component generation, and compositor are follow-up commits.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Beaker, Layers, Grid3x3, ImageIcon } from "lucide-react";
import {
  LEDIndicator,
  LCDDisplay,
  LCDCounter,
  CameraPanelHeader,
  FirmwarePresetButton,
} from "@/components/darkroom/LEDIndicator";
import { MastersTabPanel } from "@/components/darkroom/MastersTabPanel";
import { ComponentsTabPanel } from "@/components/darkroom/ComponentsTabPanel";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import {
  getProductGroupWithApplicatorSiblings,
  type ApplicatorBucket,
  type Product,
} from "@/integrations/convex/bestBottles";
import {
  findPipelineSkuJobForProductIdentity,
  findPipelineGroupByConvexSlug,
  listPipelineSkuJobs,
  shouldRecordGeneratedImageForSkuJob,
  updatePipelineSkuJob,
  updatePipelineGroupStatus,
} from "@/lib/bestBottlesPipeline";
import { markBestBottlesImageApprovedKeep } from "@/lib/imageLibraryTags";
import {
  applyBestBottlesMeasurementOverrides,
  type BestBottlesMeasurementOverridesPayload,
} from "@/lib/bestBottlesMeasurementOverrides";
import {
  buildBestBottlesGenerationIdentity,
  getBestBottlesGenerationIdentityIssue,
} from "@/lib/bestBottlesGenerationIdentity";
import "@/styles/darkroom.css";

type StudioTab = "masters" | "components" | "compose";

const TABS: Array<{ id: StudioTab; label: string; description: string }> = [
  {
    id: "masters",
    label: "Masters",
    description: "Preset + SKU → canonical image",
  },
  {
    id: "components",
    label: "Components",
    description: "Body · fitments · caps (paper-doll)",
  },
  {
    id: "compose",
    label: "Compose",
    description: "Layer preview + variant export",
  },
];

function applicatorCategoryKey(applicator: string): string {
  return applicator.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isCylinderFamilyName(family?: string | null): boolean {
  const normalized = (family ?? "").trim().toLowerCase();
  return normalized === "cylinder" || normalized === "tall cylinder";
}

function variantIdentityLabel(variant: Product): string {
  const identity = buildBestBottlesGenerationIdentity(variant);
  const issue = getBestBottlesGenerationIdentityIssue(identity);
  if (issue) return "Needs cap identity";
  if (identity.capColor) return `Cap: ${identity.capColor}`;
  if (identity.websiteSku) return `Website: ${identity.websiteSku}`;
  return "Unspecified cap";
}

async function loadMeasurementOverrides() {
  const response = await fetch("/data/best-bottles-measurement-overrides.json");
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`Unable to load measurement overrides (${response.status})`);
  }
  const payload = (await response.json()) as BestBottlesMeasurementOverridesPayload;
  return payload.overrides ?? [];
}

export default function BestBottlesStudio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentOrganizationId } = useOnboarding();
  const { groupSlug } = useParams<{ groupSlug: string }>();
  const [activeTab, setActiveTab] = useState<StudioTab>("masters");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bestbottles-studio-group-expanded", groupSlug],
    queryFn: async () => {
      if (!groupSlug) throw new Error("Missing group slug.");
      const result = await getProductGroupWithApplicatorSiblings(groupSlug);
      if (!result) {
        throw new Error(`No productGroup found for slug "${groupSlug}".`);
      }
      return result;
    },
    enabled: Boolean(groupSlug),
  });

  const { data: measurementOverrides = [] } = useQuery({
    queryKey: ["best-bottles-measurement-overrides"],
    queryFn: loadMeasurementOverrides,
    staleTime: 5 * 60 * 1000,
  });

  const { data: persistedSkuJobs = [], isFetched: hasFetchedPersistedSkuJobs } = useQuery({
    queryKey: ["best-bottles-studio-sku-job-references", currentOrganizationId, data?.group.family],
    queryFn: () =>
      listPipelineSkuJobs(currentOrganizationId!, {
        family: data!.group.family,
      }),
    enabled: Boolean(currentOrganizationId && data?.group.family),
    staleTime: 30 * 1000,
  });

  const persistedReferenceImagesBySku = useMemo(() => {
    return Object.fromEntries(
      persistedSkuJobs
        .filter((job) => Boolean(job.best_reference_candidate_path))
        .map((job) => [
          job.grace_sku,
          {
            url: job.best_reference_candidate_path!,
            name: job.expected_canonical_filename ?? job.grace_sku,
          },
        ]),
    );
  }, [persistedSkuJobs]);

  const hydratedData = useMemo(() => {
    if (!data) return null;
    const hydratedVariants = applyBestBottlesMeasurementOverrides(data.variants, measurementOverrides);
    const hydratedAllFamilyProducts = applyBestBottlesMeasurementOverrides(
      data.allFamilyProducts,
      measurementOverrides,
    );
    return {
      ...data,
      variants: hydratedVariants,
      allFamilyProducts: hydratedAllFamilyProducts,
      applicatorBuckets: data.applicatorBuckets.map((bucket) => ({
        ...bucket,
        variants: applyBestBottlesMeasurementOverrides(bucket.variants, measurementOverrides),
      })),
    };
  }, [data, measurementOverrides]);

  const studioData = hydratedData ?? data;
  const studioApplicatorBuckets: ApplicatorBucket[] = studioData?.applicatorBuckets ?? [];

  useEffect(() => {
    if (!studioData?.variants?.length) return;
    const shouldWaitForPersistedRefs = Boolean(currentOrganizationId && studioData?.group.family);
    if (shouldWaitForPersistedRefs && !hasFetchedPersistedSkuJobs) return;

    const isPrimaryGroupVariant = (variant: (typeof studioData.variants)[number]) => {
      if (variant.productGroupId && variant.productGroupId === studioData.group._id) return true;
      if (variant.productGroupSlug && variant.productGroupSlug === studioData.group.slug) return true;
      return false;
    };
    const primaryGroupVariants = studioData.variants.filter(isPrimaryGroupVariant);
    const selectionPool = primaryGroupVariants.length > 0 ? primaryGroupVariants : studioData.variants;

    if (selectedSku && selectionPool.some((variant) => variant.graceSku === selectedSku)) {
      return;
    }

    const shouldUsePersistedReferenceSelection = !isCylinderFamilyName(studioData.group.family);
    const firstReferencedVariant = shouldUsePersistedReferenceSelection
      ? selectionPool.find((variant) => Boolean(persistedReferenceImagesBySku[variant.graceSku])) ??
        selectionPool[0]
      : selectionPool[0];
    setSelectedSku(firstReferencedVariant.graceSku);
  }, [
    currentOrganizationId,
    studioData?.group.family,
    studioData?.group._id,
    studioData?.group.slug,
    studioData?.variants,
    hasFetchedPersistedSkuJobs,
    persistedReferenceImagesBySku,
    selectedSku,
  ]);

  // Component target math — paper-doll asset inventory for this family.
  // 1 body PNG + one fitment PNG per unique applicator-colorway combo.
  const componentTargetCount = useMemo(() => {
    if (!studioData?.variants) return 0;
    const uniqueCombos = new Set(
      studioData.variants.map((v) => {
        const identity = buildBestBottlesGenerationIdentity(v);
        const capKey = identity.identityStatus === "blocked"
          ? "needs-cap-identity"
          : identity.capColor ?? v.capColor ?? "?";
        return `${v.applicator ?? "?"}||${capKey}`;
      }),
    );
    return 1 + uniqueCombos.size;
  }, [studioData?.variants]);

  const selectedVariant = useMemo(
    () => studioData?.variants.find((v) => v.graceSku === selectedSku) ?? null,
    [studioData?.variants, selectedSku],
  );

  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());
  const toggleBucket = (applicator: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      const key = applicatorCategoryKey(applicator);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="dark-room-container min-h-screen overflow-y-auto">
      <header className="dark-room-header">
        <div className="dark-room-header__title flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/best-bottles/pipeline")}
            className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--darkroom-text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider">Pipeline</span>
          </button>
          <div className="flex items-center gap-2">
            <LEDIndicator state={isLoading ? "processing" : error ? "error" : "ready"} size="md" />
            <span className="font-serif text-lg">
              {data?.group.displayName ?? (isLoading ? "Loading…" : "Product Studio")}
            </span>
          </div>
        </div>

        {data?.group && (
          <div className="dark-room-header__session flex items-center gap-4">
            <LCDDisplay>
              {data.group.family}
              {data.group.capacity ? ` · ${data.group.capacity}` : ""}
              {data.group.color ? ` · ${data.group.color}` : ""}
              {data.group.neckThreadSize ? ` · ${data.group.neckThreadSize}` : ""}
            </LCDDisplay>
            <LCDCounter current={0} total={componentTargetCount} />
            <span className="text-xs" style={{ color: "var(--darkroom-text-dim)" }}>
              components
            </span>
          </div>
        )}
      </header>

      {isLoading && (
        <div className="p-8 text-sm" style={{ color: "var(--darkroom-text-muted)" }}>
          Loading productGroup from Best Bottles Convex…
        </div>
      )}

      {error && (
        <div
          className="m-6 p-4 rounded border text-sm"
          style={{
            borderColor: "var(--darkroom-error)",
            color: "var(--darkroom-error)",
            background: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div className="font-semibold mb-1">Failed to load productGroup</div>
          <div>{error instanceof Error ? error.message : String(error)}</div>
          <div className="mt-2 text-xs" style={{ color: "var(--darkroom-text-muted)" }}>
            Make sure the <code>bestbottles-convex</code> edge function is deployed
            and the <code>BESTBOTTLES_CONVEX_URL</code> secret is set.
          </div>
        </div>
      )}

      {studioData && (
        <div className="grid grid-cols-12 gap-4 p-4">
          {/* LEFT RAIL — SKU list + family metadata */}
          <aside className="camera-panel col-span-3 min-h-[600px]">
            <CameraPanelHeader
              title="Variants"
              icon={<Grid3x3 className="w-3.5 h-3.5" />}
              ledState="ready"
            />
            <div className="camera-panel__content space-y-3">
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--darkroom-text-dim)" }}>
                  Variant count
                </div>
                <LCDDisplay variant="large">{data.group.variantCount}</LCDDisplay>
              </div>

              <div
                className="pt-3 border-t space-y-2"
                style={{ borderColor: "var(--darkroom-border-subtle)" }}
              >
                <div
                  className="flex items-center justify-between text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--darkroom-text-dim)" }}
                >
                  <span>Variants by applicator</span>
                  <span>{studioData.variants.length} total</span>
                </div>
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {studioApplicatorBuckets.map((bucket) => {
                    const key = applicatorCategoryKey(bucket.applicator);
                    const collapsed = collapsedBuckets.has(key);
                    return (
                      <div key={key} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => toggleBucket(bucket.applicator)}
                          className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium uppercase tracking-wider hover:bg-white/[0.04] transition-colors"
                          style={{ color: "var(--darkroom-accent)" }}
                        >
                          <span className="truncate">
                            {collapsed ? "▸" : "▾"} {bucket.applicator}
                          </span>
                          <LCDDisplay>{bucket.count}</LCDDisplay>
                        </button>
                        {!collapsed && (
                          <div className="space-y-0.5 pl-2">
                            {bucket.variants.map((v) => (
                              <button
                                key={v._id}
                                type="button"
                                onClick={() => setSelectedSku(v.graceSku)}
                                className="w-full text-left px-2 py-1 rounded text-xs transition-colors"
                                style={{
                                  color:
                                    selectedSku === v.graceSku
                                      ? "var(--darkroom-accent)"
                                      : "var(--darkroom-text-muted)",
                                  background:
                                    selectedSku === v.graceSku
                                      ? "rgba(184, 149, 106, 0.08)"
                                      : "transparent",
                                }}
                              >
                                <div className="font-mono truncate text-[11px]">
                                  {v.graceSku}
                                </div>
                                <div
                                  className="truncate"
                                  style={{
                                    color: "var(--darkroom-text-dim)",
                                    fontSize: "10px",
                                  }}
                                >
                                  {variantIdentityLabel(v)}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN — tab switcher + content */}
          <main className="camera-panel col-span-9 min-h-[600px]">
            <CameraPanelHeader
              title={TABS.find((t) => t.id === activeTab)?.label ?? "Studio"}
              icon={
                activeTab === "masters" ? (
                  <Beaker className="w-3.5 h-3.5" />
                ) : activeTab === "components" ? (
                  <Layers className="w-3.5 h-3.5" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )
              }
              ledState="off"
            />
            <div className="camera-panel__content space-y-4">
              <div className="flex gap-2 flex-wrap">
                {TABS.map((t) => (
                  <FirmwarePresetButton
                    key={t.id}
                    label={t.label}
                    description={t.description}
                    isActive={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                  />
                ))}
              </div>

              <div
                className="rounded p-6 border min-h-[400px] max-h-[calc(100vh-260px)] overflow-y-auto"
                style={{
                  borderColor: "var(--darkroom-border-subtle)",
                  background: "var(--darkroom-surface)",
                }}
              >
                {activeTab === "masters" && (
                  <MastersTabPanel
                    selectedProduct={selectedVariant}
                    familyVariants={studioData.variants}
                    allFamilyProducts={studioData.allFamilyProducts}
                    familyName={studioData.group.family}
                    persistedReferenceImagesBySku={persistedReferenceImagesBySku}
                    onMasterGenerated={async (result, product) => {
                      if (!currentOrganizationId || !result.savedImageId || !result.imageUrl) {
                        return;
                      }
                      const skuJob = findPipelineSkuJobForProductIdentity(persistedSkuJobs, product);
                      if (!skuJob) {
                        toast({
                          title: "Generated image saved",
                          description: `${product.graceSku} is tagged in Library, but no matching SKU queue row was found to update.`,
                          variant: "destructive",
                        });
                        return;
                      }
                      if (!shouldRecordGeneratedImageForSkuJob(skuJob)) {
                        return;
                      }
                      await updatePipelineSkuJob(skuJob.id, {
                        status: "generated",
                        generated_image_id: result.savedImageId,
                        generated_image_url: result.imageUrl,
                        last_error: null,
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["best-bottles-pipeline-sku-jobs"],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["best-bottles-studio-sku-job-references"],
                      });
                    }}
                    onMasterGenerationFailed={async (errorMessage, product) => {
                      if (!currentOrganizationId) {
                        return;
                      }
                      const skuJob = findPipelineSkuJobForProductIdentity(persistedSkuJobs, product);
                      if (!skuJob || !shouldRecordGeneratedImageForSkuJob(skuJob)) {
                        return;
                      }
                      const isReferenceFailure = /reference|transparent|background-removed|mask|flattened/i.test(errorMessage);
                      await updatePipelineSkuJob(skuJob.id, {
                        status: isReferenceFailure ? "needs-reference" : skuJob.status,
                        last_error: errorMessage,
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["best-bottles-pipeline-sku-jobs"],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["best-bottles-studio-sku-job-references"],
                      });
                    }}
                    onApproveMaster={async (result, product) => {
                      if (!currentOrganizationId || !groupSlug) {
                        toast({
                          title: "Cannot record approval",
                          description: "Missing organization or group context.",
                          variant: "destructive",
                        });
                        return;
                      }
                      try {
                        const pipelineRow = await findPipelineGroupByConvexSlug(
                          currentOrganizationId,
                          groupSlug,
                        );
                        if (!pipelineRow) {
                          toast({
                            title: "Saved to Library — Pipeline row not found",
                            description: `No Pipeline row with convex_slug "${groupSlug}". Image is tagged in Library but status won't propagate to the tracker.`,
                          });
                          return;
                        }
                        await updatePipelineGroupStatus(pipelineRow.id, {
                          madison_status: "approved",
                          madison_approved_image_id: result.savedImageId,
                          madison_approved_at: new Date().toISOString(),
                          madison_approved_by: user?.id ?? null,
                        });
                        // Write the approved-keep verdict through to the image so
                        // the completeness metric + clean library read the approval.
                        await markBestBottlesImageApprovedKeep(result.savedImageId);
                        await queryClient.invalidateQueries({
                          queryKey: ["best-bottles-pipeline-groups"],
                        });
                        toast({
                          title: `${product.applicator ?? "Applicator"} group approved`,
                          description: `Pipeline row for this applicator group flipped to APPROVED. Represents the whole group — not just ${product.graceSku}.`,
                        });
                      } catch (e) {
                        const message =
                          e instanceof Error ? e.message : "Unknown error approving master.";
                        toast({
                          title: "Approval write failed",
                          description: message,
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                )}

                {activeTab === "components" && (
                  <ComponentsTabPanel
                    applicatorBuckets={studioApplicatorBuckets}
                    variants={studioData.variants}
                    familyName={studioData.group.family}
                    cohortSlug={studioData.group.slug ?? groupSlug ?? null}
                  />
                )}

                {activeTab === "compose" && (
                  <div
                    className="text-sm space-y-3"
                    style={{ color: "var(--darkroom-text-muted)" }}
                  >
                    <div className="flex items-center gap-2">
                      <LEDIndicator state="off" />
                      <span className="uppercase tracking-wider text-xs">
                        Composite preview — next commit
                      </span>
                    </div>
                    <p>
                      Overlay the approved body + any fitment + cap layers at
                      the paper-doll canonical anchor. Export the composite as
                      a final catalog asset or push to Sanity.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>

        </div>
      )}
    </div>
  );
}
