import cyl9FactoryJson from "../../../docs/paper-doll-rig/cyl9-component-factory.json";

import {
  parsePaperDollFamilyProductionManifest,
  type PaperDollFamilyProductionManifest,
} from "./componentPlateContract";

export const CYL9_BODY_VARIANT_KEYS = ["AMB", "BLU", "CLR", "FRS", "SWL"] as const;
export const CYL9_CAP_VARIANT_KEYS = [
  "SSLV",
  "MSLV",
  "SGLD",
  "MGLD",
  "SBLK",
  "MCPR",
  "WHT",
  "SLDT",
  "BKDT",
  "PKDT",
] as const;
export const CYL9_ROLLER_VARIANT_KEYS = ["PLASTIC", "METAL"] as const;
export const CYL9_SPRAYER_VARIANT_KEYS = ["GLD", "MSLV", "BLK", "SSLV", "RED", "TUR"] as const;
export const CYL9_PUMP_VARIANT_KEYS = ["BLK", "GLD", "MSLV"] as const;

export const CYL9_COMPONENT_KEYS = [
  ...CYL9_CAP_VARIANT_KEYS.map((variantKey) => `closure__17-415__rollon-overcap__${variantKey}`),
  ...CYL9_ROLLER_VARIANT_KEYS.map((variantKey) => `roller__17-415__${variantKey}`),
  ...CYL9_SPRAYER_VARIANT_KEYS.map((variantKey) => `sprayer__17-415__${variantKey}`),
  ...CYL9_PUMP_VARIANT_KEYS.map((variantKey) => `pump__17-415__${variantKey}`),
  "overcap__17-415__SPRAY-TRNS",
  "overcap__17-415__LOTION-TRNS",
] as const;

type CatalogMapping = PaperDollFamilyProductionManifest["catalogMappings"][number];
type Component = PaperDollFamilyProductionManifest["components"][number];

function componentByVariant(
  manifest: PaperDollFamilyProductionManifest,
  slot: Component["slot"],
  variantKey: string,
): Component {
  const component = manifest.components.find((entry) => (
    entry.slot === slot && entry.variants[0]?.variantKey === variantKey
  ));
  if (!component) throw new Error(`CYL-9ML inventory is missing ${slot}:${variantKey}.`);
  return component;
}

function componentVariantReference(component: Component): string {
  return `${component.componentKey}:${component.variants[0].variantKey}`;
}

export function buildCyl9ExpectedCatalogMappings(
  manifest: PaperDollFamilyProductionManifest,
): CatalogMapping[] {
  const mappings: CatalogMapping[] = [];
  const sprayOvercap = componentByVariant(manifest, "overcap", "SPRAY-TRNS");
  const lotionOvercap = componentByVariant(manifest, "overcap", "LOTION-TRNS");

  for (const bodyVariantKey of CYL9_BODY_VARIANT_KEYS) {
    for (const capVariantKey of CYL9_CAP_VARIANT_KEYS) {
      const cap = componentByVariant(manifest, "cap", capVariantKey);
      for (const rollerVariantKey of CYL9_ROLLER_VARIANT_KEYS) {
        const roller = componentByVariant(manifest, "roller", rollerVariantKey);
        mappings.push({
          mappingKey: `CYL-9ML:${bodyVariantKey}:ROLLON:${capVariantKey}:${rollerVariantKey}`,
          bodyVariantKey,
          mode: "rollon",
          componentVariantKeys: [
            componentVariantReference(cap),
            componentVariantReference(roller),
          ],
        });
      }
    }
    for (const sprayerVariantKey of CYL9_SPRAYER_VARIANT_KEYS) {
      const sprayer = componentByVariant(manifest, "sprayer", sprayerVariantKey);
      mappings.push({
        mappingKey: `CYL-9ML:${bodyVariantKey}:SPRAY:${sprayerVariantKey}`,
        bodyVariantKey,
        mode: "spray",
        componentVariantKeys: [
          componentVariantReference(sprayer),
          componentVariantReference(sprayOvercap),
        ],
      });
    }
    for (const pumpVariantKey of CYL9_PUMP_VARIANT_KEYS) {
      const pump = componentByVariant(manifest, "pump", pumpVariantKey);
      mappings.push({
        mappingKey: `CYL-9ML:${bodyVariantKey}:LOTION:${pumpVariantKey}`,
        bodyVariantKey,
        mode: "lotion",
        componentVariantKeys: [
          componentVariantReference(pump),
          componentVariantReference(lotionOvercap),
        ],
      });
    }
  }
  return mappings;
}

export function loadCyl9ComponentFactory(): PaperDollFamilyProductionManifest {
  const inventory = parsePaperDollFamilyProductionManifest(cyl9FactoryJson);
  return parsePaperDollFamilyProductionManifest({
    ...inventory,
    catalogMappings: buildCyl9ExpectedCatalogMappings(inventory),
  });
}

export function countCyl9RowsPerBody(
  manifest: PaperDollFamilyProductionManifest,
): Record<string, number> {
  return manifest.catalogMappings.reduce<Record<string, number>>((counts, mapping) => {
    counts[mapping.bodyVariantKey] = (counts[mapping.bodyVariantKey] ?? 0) + 1;
    return counts;
  }, {});
}

