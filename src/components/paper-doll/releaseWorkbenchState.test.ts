import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseReleaseWorkbenchState,
  serializeReleaseWorkbenchState,
  type ReleaseWorkbenchState,
} from "./releaseWorkbenchState";

test("workbench URLs preserve family, component, candidate, plate, lifecycle view, and filters", () => {
  for (const view of ["inventory", "plate", "candidate", "family-fit", "release", "sanity"] as const) {
    const state = parseReleaseWorkbenchState(
      new URLSearchParams(`view=${view}&family=CYL-9ML&component=closure__17-415__rollon-overcap__SSLV&candidate=c1&plate=BLU&pdSystem=rollon&pdRole=cap&pdFinish=mirror-chrome&pdStatus=approved`),
    );
    assert.equal(state.view, view);
    assert.equal(state.familyKey, "CYL-9ML");
    assert.equal(state.componentKey, "closure__17-415__rollon-overcap__SSLV");
    assert.equal(state.candidateId, "c1");
    assert.equal(state.bodyVariantKey, "BLU");
    assert.deepEqual(state.filters, {
      system: "rollon",
      role: "cap",
      finish: "mirror-chrome",
      status: "approved",
    });
    assert.equal(state.mode, "release-lock");
  }
});

test("invalid query values fail back to inventory without losing the family default", () => {
  assert.deepEqual(
    parseReleaseWorkbenchState(
      new URLSearchParams("view=edit&family=%20&component=../bad&pdRole=unknown&pdStatus=done"),
    ),
    {
      view: "inventory",
      mode: "release-lock",
      familyKey: "CYL-9ML",
      componentKey: null,
      candidateId: null,
      bodyVariantKey: null,
      filters: { system: null, role: null, finish: null, status: null },
    },
  );
});

test("serialization is stable and preserves unrelated Studio query parameters", () => {
  const state: ReleaseWorkbenchState = {
    view: "family-fit",
    mode: "release-lock",
    familyKey: "CYL-9ML",
    componentKey: "closure__17-415__rollon-overcap__SSLV",
    candidateId: "candidate-1",
    bodyVariantKey: "AMB",
    filters: { system: "rollon", role: "cap", finish: null, status: "blocked" },
  };
  const params = serializeReleaseWorkbenchState(state, new URLSearchParams("sku=ABC&view=inventory"));
  assert.equal(
    params.toString(),
    "sku=ABC&view=family-fit&family=CYL-9ML&component=closure__17-415__rollon-overcap__SSLV&candidate=candidate-1&plate=AMB&pdSystem=rollon&pdRole=cap&pdStatus=blocked",
  );
  assert.deepEqual(parseReleaseWorkbenchState(params), state);
});
