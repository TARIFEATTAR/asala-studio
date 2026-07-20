import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { useBestBottlesCylinderRoleAwareReadiness } from "./useBestBottlesCylinderProductionReadiness";

function RoleAwareReadinessProbe() {
  useBestBottlesCylinderRoleAwareReadiness();
  return createElement("div", null, "ready");
}

test("constructs the Cylinder role-aware readiness query without an undefined version binding", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  assert.doesNotThrow(() => renderToString(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(RoleAwareReadinessProbe),
    ),
  ));
});
