/**
 * Environment plate registry for the paper-doll lane.
 *
 * The production plate is Best Bottles Bone `#F5F3EF`. `useAsFinalBackground:
 * true` is the Option A decision: rendering happens on the plate; we do not
 * generate clear glass on transparency and composite later.
 */

import type { EnvironmentPlate } from "@/lib/product-image/types";

export const BEST_BOTTLES_BONE_V1: EnvironmentPlate = {
  id: "best_bottles_bone_v1",
  name: "Best Bottles Bone",
  backgroundHex: "#F5F3EF",
  useAsFinalBackground: true,
  texture: "flat",
  lightingStyle: "neutral_studio",
  tone: "warm",
};

export const ENVIRONMENT_PLATES: Record<string, EnvironmentPlate> = {
  [BEST_BOTTLES_BONE_V1.id]: BEST_BOTTLES_BONE_V1,
  // Backward-compatible resolver for persisted rows that still carry the old
  // id. It intentionally resolves to the new Bone plate and never emits the
  // retired color.
  parchment_cream_v1: BEST_BOTTLES_BONE_V1,
};

export const DEFAULT_PAPER_DOLL_PLATE_ID = BEST_BOTTLES_BONE_V1.id;

export function getEnvironmentPlate(id: string): EnvironmentPlate {
  const plate = ENVIRONMENT_PLATES[id];
  if (!plate) {
    throw new Error(
      `Unknown environment plate "${id}". Registered ids: ${Object.keys(
        ENVIRONMENT_PLATES,
      ).join(", ")}`,
    );
  }
  return plate;
}
