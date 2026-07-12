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
}

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
      ? "Render one continuous soft contact shadow attached directly to the bottle base."
      : topology.kind === "detached-sidecar"
        ? "Render separate but visually coherent soft contact shadows at the bottle base and detached cap; each must attach directly to its own physical contact line."
        : "Render only the physically required soft contact shadows for the bottle base and every accessory or sidecar that actually touches the surface; each contact must attach directly to that component.";

  return [
    "GROUNDING SHADOW — MODEL OWNED:",
    contactInstruction,
    "Each contact core must be darkest and most concentrated at the physical contact line, approximately 32–42% opacity at its densest point, then feather softly behind and toward camera-right, fading within approximately 20–30% of the primary bottle's width.",
    "Every contact core and its feather must read as one continuous grounded shadow. Use one soft key-light direction across all contacts.",
    "No missing expected contact, unexpected disconnected shadow, detached oval, gap beneath a grounded component, hard outline, long dramatic cast, doubled shadow, reflection, floor plane, smear, or horizon.",
  ].join("\n");
}
