import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseReleaseWorkbenchState,
  serializeReleaseWorkbenchState,
  type ReleaseWorkbenchState,
} from "./releaseWorkbenchState";

test("parses every supported workbench view and filter", () => {
  for (const view of ["assembly", "matrix", "lineup", "evidence", "publish"] as const) {
    const state = parseReleaseWorkbenchState(
      new URLSearchParams(`pdView=${view}&pdSystem=rollon&pdRole=cap&pdFinish=mirror-chrome&pdStatus=approved`),
    );
    assert.equal(state.view, view);
    assert.deepEqual(state.filters, {
      system: "rollon",
      role: "cap",
      finish: "mirror-chrome",
      status: "approved",
    });
    assert.equal(state.mode, "release-lock");
  }
});

test("invalid query values fail back to the locked assembly view", () => {
  assert.deepEqual(
    parseReleaseWorkbenchState(
      new URLSearchParams("pdView=edit&pdSystem=%20&pdRole=unknown&pdStatus=done"),
    ),
    {
      view: "assembly",
      mode: "release-lock",
      filters: { system: null, role: null, finish: null, status: null },
    },
  );
});

test("serialization is stable and preserves unrelated Studio query parameters", () => {
  const state: ReleaseWorkbenchState = {
    view: "lineup",
    mode: "release-lock",
    filters: { system: "rollon", role: "cap", finish: null, status: "blocked" },
  };
  const params = serializeReleaseWorkbenchState(state, new URLSearchParams("sku=ABC&pdView=matrix"));
  assert.equal(
    params.toString(),
    "sku=ABC&pdView=lineup&pdSystem=rollon&pdRole=cap&pdStatus=blocked",
  );
  assert.deepEqual(parseReleaseWorkbenchState(params), state);
});
