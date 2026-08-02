import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPaidPilotAuthorized,
  parseCylinderSixRolePilotRunnerArgs,
  selectCylinderSixRolePilotAttempts,
  type LocalCylinderSixRolePilotManifest,
} from "./run-cylinder-six-role-material-pilot";

const manifest = {
  version: "cylinder-six-role-material-pilot-v1",
  sha256: "m".repeat(64),
  canonicalMaster: {
    path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
    sha256: "c".repeat(64),
  },
  authorization: {
    scope: "controlled-visual-test-only",
    paidGeneration: "not-authorized-by-manifest",
    remoteWrites: "forbidden",
    publishing: "forbidden",
  },
  attempts: [3, 5, 9, 25, 50, 100].flatMap((capacityMl) =>
    (["cap-on", "sidecar"] as const).map((assetRole) => ({
      jobKey: `SKU${capacityMl}|${assetRole}`,
      websiteSku: `SKU${capacityMl}`,
      graceSku: capacityMl === 25 ? null : `GRACE${capacityMl}`,
      family: "Cylinder" as const,
      capacityMl,
      assetRole,
      rendererId: "openai-gpt-image-2" as const,
      attemptOrdinal: 1 as const,
      prompt: `prompt ${capacityMl} ${assetRole}`,
      promptHash: `${capacityMl}`.padEnd(64, assetRole === "cap-on" ? "a" : "b"),
      promptVersion: assetRole === "cap-on"
        ? "best-bottles-cylinder-cap-on-identity-prompt-v4-glass-only-material" as const
        : "best-bottles-cylinder-cap-off-sidecar-prompt-v6-masked-sidewall-material" as const,
      canonicalTruth: { capacityMl },
      canonicalTruthHash: `${capacityMl}`.padEnd(64, "c"),
      scaleContract: {
        version: "best-bottles-canonical-body-scale-v2",
        canvasWidthPx: 2080,
        canvasHeightPx: 2288,
        baselinePct: 9,
        baselineYPx: 2082,
        assembledTargetPct: 60,
        assembledTargetPx: 1373,
        bodyTargetPx: 1000 + capacityMl,
        bodyTargetRangePx: { min: 950, max: 1100 },
        bodyWidthTargetPx: 320,
        bodyWidthTargetRangePx: { min: 300, max: 340 },
        canonicalBodyHeightMm: 50,
        canonicalBodyWidthMm: 17,
        canonicalAssembledHeightMm: 70,
        qaStatus: "measurement-required" as const,
      },
      references: [
        {
          kind: "product-truth" as const,
          role: assetRole === "cap-on"
            ? "cap-on-product-truth" as const
            : "sidecar-product-truth" as const,
          locator: `tmp/${capacityMl}-${assetRole}.png`,
          sha256: `${capacityMl}`.padEnd(64, "d"),
        },
        {
          kind: "material-calibration" as const,
          role: "material-calibration" as const,
          locator: "https://example.com/material.png",
          sha256: "e".repeat(64),
        },
      ],
      productionStatus: capacityMl === 25 ? "blocked" as const : "ready" as const,
      productionBlockers: capacityMl === 25 ? ["missing-grace-sku"] : [],
    }))
  ),
} satisfies LocalCylinderSixRolePilotManifest;

test("execute requires an explicit paid-pilot authorization flag", () => {
  const args = parseCylinderSixRolePilotRunnerArgs(["execute"]);
  assert.equal(args.command, "execute");
  assert.equal(args.authorizePaidPilot, false);
  assert.throws(
    () => assertPaidPilotAuthorized(args, manifest),
    /--authorize-paid-pilot/,
  );

  const authorized = parseCylinderSixRolePilotRunnerArgs([
    "execute",
    "--authorize-paid-pilot",
  ]);
  assert.doesNotThrow(() => assertPaidPilotAuthorized(authorized, manifest));
});

test("selection is deterministic and can isolate boundary sidecar attempts", () => {
  const args = parseCylinderSixRolePilotRunnerArgs([
    "execute",
    "--role",
    "sidecar",
    "--capacity",
    "3,100",
    "--limit",
    "2",
  ]);
  const selected = selectCylinderSixRolePilotAttempts(manifest, args);
  assert.deepEqual(
    selected.map((attempt) => attempt.jobKey),
    ["SKU3|sidecar", "SKU100|sidecar"],
  );
});

test("visual pilot selection retains unresolved production blockers instead of hiding them", () => {
  const args = parseCylinderSixRolePilotRunnerArgs([
    "preflight",
    "--capacity",
    "25",
  ]);
  const selected = selectCylinderSixRolePilotAttempts(manifest, args);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].productionStatus, "blocked");
  assert.deepEqual(selected[0].productionBlockers, ["missing-grace-sku"]);
});
