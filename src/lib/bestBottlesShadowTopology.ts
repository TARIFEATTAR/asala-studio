export type BestBottlesShadowContact = "bottle" | "sidecar" | "accessory";

export interface BestBottlesShadowTopology {
  kind: "assembled" | "detached-sidecar" | "complex-contact";
  expectedContacts: BestBottlesShadowContact[];
  source: "reviewed-reference" | "catalog-cap-state";
}

export interface BestBottlesShadowTopologyProductLike {
  family?: string | null;
  capState?: string | null;
  mode?: string | null;
  applicator?: string | null;
  accessoryCode?: string | null;
  accessoryContactsSurface?: boolean | null;
  itemName?: string | null;
  itemDescription?: string | null;
  /** Reviewed component topology from the Cylinder role authority, when present. */
  componentTopology?: string | null;
}

/**
 * Reviewed component topology → shadow topology. This is the SAME mapping the
 * generation edge function enforces (bestBottlesPrecompiledPrompt.ts), so when
 * reviewed evidence is present the compiled record is consistent with the gate
 * by construction. The text heuristics below remain only as a fallback for
 * products without reviewed topology — marketing copy ("vintage", "antique")
 * must never override reviewed evidence (2026-07-19: it deterministically
 * blocked all 5 mL sprayers with a complex-contact/sidecar conflict).
 */
const REVIEWED_COMPONENT_SHADOW_TOPOLOGY: Record<
  string,
  BestBottlesShadowTopology["kind"]
> = {
  assembled: "assembled",
  "fitment-attached-cap-right-sidecar": "detached-sidecar",
  "assembled-live-site-exception": "complex-contact",
  "assembled-closure-live-site-exception": "assembled",
};

export interface BestBottlesShadowTopologyPromptSkuLike {
  sku?: string | null;
  detached_components?: string[] | null;
  closure_type?: string | null;
  applicator_type?: string | null;
}

function normalizedText(...values: unknown[]): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

export function resolveBestBottlesShadowTopology(
  product: BestBottlesShadowTopologyProductLike,
  promptSku: BestBottlesShadowTopologyPromptSkuLike,
): BestBottlesShadowTopology {
  const reviewedKind = product.componentTopology
    ? REVIEWED_COMPONENT_SHADOW_TOPOLOGY[product.componentTopology]
    : undefined;
  if (reviewedKind) {
    return {
      kind: reviewedKind,
      expectedContacts:
        reviewedKind === "detached-sidecar" ? ["bottle", "sidecar"] : ["bottle"],
      source: "reviewed-reference",
    };
  }
  const compositionText = normalizedText(
    product.capState,
    product.mode,
    promptSku.detached_components,
  );
  const productText = normalizedText(
    product.applicator,
    product.accessoryCode,
    product.itemName,
    product.itemDescription,
    promptSku.closure_type,
    promptSku.applicator_type,
  );
  const hasSidecar =
    (promptSku.detached_components?.length ?? 0) > 0 ||
    /detached|sidecar|cap[ -]?off|exploded/.test(compositionText);
  const hasComplexAccessory =
    /tassel|antique|vintage|bulb|hose|accessory|ast[-_ ]/.test(productText);
  const source = product.capState || product.mode
    ? "reviewed-reference"
    : "catalog-cap-state";

  if (hasComplexAccessory) {
    return {
      kind: "complex-contact",
      expectedContacts: [
        "bottle",
        ...(hasSidecar ? (["sidecar"] as const) : []),
        ...(product.accessoryContactsSurface ? (["accessory"] as const) : []),
      ],
      source,
    };
  }
  if (hasSidecar) {
    return {
      kind: "detached-sidecar",
      expectedContacts: ["bottle", "sidecar"],
      source,
    };
  }
  return {
    kind: "assembled",
    expectedContacts: ["bottle"],
    source,
  };
}

export function buildModelOwnedShadowPrompt(
  topology: BestBottlesShadowTopology,
): string {
  const contactInstruction =
    topology.kind === "assembled"
      ? "The bottle stands on a very subtle, light, softly feathered grounded shadow."
      : topology.kind === "detached-sidecar"
        ? "The bottle and the detached cap each stand on a very subtle, light, softly feathered grounded shadow."
        : "The bottle and each piece touching the surface stand on a very subtle, light, softly feathered grounded shadow.";

  return [
    "GROUNDING SHADOW — MODEL OWNED:",
    contactInstruction,
    "Barely there — like quiet natural studio light. No hard edges, no long casts, no reflections, no floor plane.",
  ].join("\n");
}
