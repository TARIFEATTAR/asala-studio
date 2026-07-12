import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CYLINDER_CLOSEOUT_EXPECTED_SKUS,
  buildCylinderCloseoutLedger,
  getCylinderCloseoutBlockers,
  type CylinderCloseoutSourceRow,
} from "./bestBottlesCylinderCloseout";

function row(
  graceSku: string,
  websiteSku: string,
  overrides: Partial<CylinderCloseoutSourceRow> = {},
): CylinderCloseoutSourceRow {
  return {
    graceSku,
    websiteSku,
    family: "Cylinder",
    productGroupSlug: "cylinder-test",
    status: "ready",
    issues: [],
    ...overrides,
  };
}

describe("buildCylinderCloseoutLedger", () => {
  it("collapses the Tall Cylinder alias into its canonical Cylinder row", async () => {
    const ledger = await buildCylinderCloseoutLedger({
      readinessRows: [
        row("GB-CYL-WHT-9ML-WHT-S", "GBTallCyl9WhtSht"),
        row("GBTallCyl9WhtSht", "GBTallCyl9WhtSht", {
          family: "Tall Cylinder",
          status: "needs-reference",
          issues: ["missing_catalog_join"],
        }),
      ],
      generatedAt: "2026-07-12T00:00:00.000Z",
    });

    assert.equal(ledger.rows.length, 1);
    assert.equal(ledger.rows[0].graceSku, "GB-CYL-WHT-9ML-WHT-S");
    assert.deepEqual(ledger.rows[0].aliases, ["GBTallCyl9WhtSht"]);
    assert.deepEqual(ledger.aliases, {
      GBTallCyl9WhtSht: "GB-CYL-WHT-9ML-WHT-S",
    });
  });

  it("produces a stable SHA-256 hash independent of input order and timestamp", async () => {
    const rows = [row("GB-CYL-B", "WEB-B"), row("GB-CYL-A", "WEB-A")];
    const first = await buildCylinderCloseoutLedger({
      readinessRows: rows,
      generatedAt: "2026-07-12T00:00:00.000Z",
    });
    const second = await buildCylinderCloseoutLedger({
      readinessRows: [...rows].reverse(),
      generatedAt: "2026-07-13T00:00:00.000Z",
    });

    assert.match(first.sha256, /^[a-f0-9]{64}$/);
    assert.equal(first.sha256, second.sha256);
  });
});

describe("getCylinderCloseoutBlockers", () => {
  it("fails closeout when the canonical universe is not exactly 384 rows", async () => {
    const ledger = await buildCylinderCloseoutLedger({
      readinessRows: [],
      generatedAt: "2026-07-12T00:00:00.000Z",
    });
    const blockers = getCylinderCloseoutBlockers(ledger);

    assert.ok(
      blockers.some(
        (blocker) =>
          blocker.code === "unexpected-sku-count" &&
          blocker.message.includes(String(CYLINDER_CLOSEOUT_EXPECTED_SKUS)),
      ),
    );
  });

  it("reports catalog joins, measurement overrides, and duplicate website SKUs", async () => {
    const ledger = await buildCylinderCloseoutLedger({
      readinessRows: [
        row("GB-CYL-A", "DUPLICATE", {
          issues: [
            "missing_catalog_join",
            "measurement_override_pending_convex_sync",
          ],
        }),
        row("GB-CYL-B", "DUPLICATE"),
      ],
      generatedAt: "2026-07-12T00:00:00.000Z",
    });
    const codes = new Set(getCylinderCloseoutBlockers(ledger).map((item) => item.code));

    assert.ok(codes.has("missing-catalog-join"));
    assert.ok(codes.has("measurement-override-pending"));
    assert.ok(codes.has("duplicate-website-sku"));
  });
});
