import React from "react";
import ReactDOM from "react-dom/client";

import { ProductionRoutePanel } from "../../src/components/paper-doll/ProductionRoutePanel";
import { cyl9ProductionRoute } from "../../src/lib/paperDoll/cyl9ProductionRoute";
import "../../src/index.css";
import "../../src/styles/darkroom.css";

/**
 * Manual visual QA only. This file is not an application route and is not part
 * of the production entry graph. Import it explicitly from a local Vite session
 * to inspect the real ProductionRoutePanel without weakening ProtectedRoute.
 */
export function mountProductionRouteVisualHarness() {
  document.title = "Madison · Production Route Visual QA";
  document.body.innerHTML = '<div id="production-route-visual-harness"></div>';
  const root = document.getElementById("production-route-visual-harness");
  if (!root) throw new Error("Could not mount the production route visual harness.");

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <main
        className="dark-room-container min-h-screen p-6"
        style={{ background: "var(--darkroom-bg)", color: "var(--darkroom-text)" }}
      >
        <div className="mx-auto min-w-0 w-full max-w-[1600px]">
          <div
            className="mb-3 text-[10px] uppercase tracking-[0.16em]"
            style={{ color: "var(--darkroom-text-dim)" }}
          >
            Product Studio · Production · local visual QA
          </div>
          <ProductionRoutePanel
            route={cyl9ProductionRoute}
            liveRelease={{
              version: "1.3.10",
              status: "ready",
              manifestSha256: "visual-qa-live-release-snapshot",
              assetCount: 14,
              bodyCount: 5,
              componentCount: 9,
            }}
          />
          <section
            className="rounded border p-4"
            style={{
              borderColor: "var(--darkroom-border-subtle)",
              background: "rgba(0,0,0,0.12)",
            }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.2em]"
              style={{ color: "var(--darkroom-accent)" }}
            >
              Existing production candidate bench continues below
            </div>
          </section>
        </div>
      </main>
    </React.StrictMode>,
  );
}
