import assert from "node:assert/strict";

import { deriveReleaseAssetRows } from "./paperDollReleaseAssetContract.ts";

const bounds = { left: 10, top: 20, width: 30, height: 40 };

Deno.test("release rows are derived only from the reviewed manifest assets", () => {
  const rows = deriveReleaseAssetRows({
    assets: [
      {
        slot: "cap",
        variantKey: "SGLD",
        componentVersionId: "version-1",
        candidateId: "candidate-1",
        placementVersionId: "placement-1",
        sourceBounds: bounds,
        editBounds: bounds,
        authorityBounds: bounds,
        placementBounds: bounds,
      },
      {
        slot: "body",
        variantKey: "CLR",
        componentVersionId: "body-1",
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      component_candidate_id: "candidate-1",
      component_version_id: "version-1",
      placement_version_id: "placement-1",
      slot: "cap",
      variant_key: "SGLD",
      source_bounds: bounds,
      edit_bounds: bounds,
      authority_bounds: bounds,
      placement_bounds: bounds,
    },
    {
      component_candidate_id: null,
      component_version_id: "body-1",
      placement_version_id: null,
      slot: "body",
      variant_key: "CLR",
      source_bounds: null,
      edit_bounds: null,
      authority_bounds: null,
      placement_bounds: null,
    },
  ]);
});

Deno.test("release rows reject an asset whose immutable provenance is incomplete", () => {
  assert.throws(
    () => deriveReleaseAssetRows({
      assets: [{
        slot: "cap",
        variantKey: "SGLD",
        componentVersionId: "version-1",
        candidateId: "candidate-1",
        sourceBounds: bounds,
        editBounds: bounds,
        authorityBounds: bounds,
        placementBounds: bounds,
      }],
    }),
    /placementVersionId/,
  );
});

Deno.test("release rows preserve the canonical Px-suffixed four-box evidence", () => {
  const rows = deriveReleaseAssetRows({
    assets: [{
      slot: "roller",
      variantKey: "METAL",
      componentVersionId: "version-2",
      candidateId: "candidate-2",
      placementVersionId: "placement-2",
      sourceBoundsPx: bounds,
      editBoundsPx: bounds,
      authorityBoundsPx: bounds,
      placementBoundsPx: bounds,
    }],
  });

  assert.deepEqual(rows[0], {
    component_candidate_id: "candidate-2",
    component_version_id: "version-2",
    placement_version_id: "placement-2",
    slot: "roller",
    variant_key: "METAL",
    source_bounds: bounds,
    edit_bounds: bounds,
    authority_bounds: bounds,
    placement_bounds: bounds,
  });
});
