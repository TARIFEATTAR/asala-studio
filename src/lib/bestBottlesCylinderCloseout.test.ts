import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CYLINDER_CLOSEOUT_EXPECTED_PUBLICATION_TARGETS,
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
  it("preserves source rows while collapsing approved website-SKU alias pairs into one publication target", async () => {
    const ledger = await buildCylinderCloseoutLedger({
      readinessRows: [
        row("GB-CYL-CLR-50ML-RDC-MSLV", "GBCyl50RdcrMtSl"),
        row("GB-CYL-CLR-50ML-RDC-MSLV-01", "GBCyl50RdcrMtSl"),
      ],
      generatedAt: "2026-07-12T00:00:00.000Z",
    });

    assert.equal(ledger.rows.length, 2);
    assert.equal(ledger.publicationTargets.length, 1);
    assert.equal(
      ledger.publicationTargets[0].graceSku,
      "GB-CYL-CLR-50ML-RDC-MSLV",
    );
    assert.deepEqual(ledger.publicationTargets[0].sourceGraceSkus, [
      "GB-CYL-CLR-50ML-RDC-MSLV",
      "GB-CYL-CLR-50ML-RDC-MSLV-01",
    ]);
    assert.equal(
      ledger.aliases["GB-CYL-CLR-50ML-RDC-MSLV-01"],
      "GB-CYL-CLR-50ML-RDC-MSLV",
    );
    assert.equal(
      getCylinderCloseoutBlockers(ledger).some(
        (blocker) => blocker.code === "duplicate-website-sku",
      ),
      false,
    );
  });

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

  it("requires 377 unique publication targets independently of the 384 source rows", async () => {
    const ledger = await buildCylinderCloseoutLedger({
      readinessRows: [row("GB-CYL-A", "WEB-A")],
      generatedAt: "2026-07-12T00:00:00.000Z",
    });
    const blocker = getCylinderCloseoutBlockers(ledger).find(
      (item) => item.code === "unexpected-publication-target-count",
    );

    assert.ok(blocker);
    assert.match(
      blocker.message,
      new RegExp(String(CYLINDER_CLOSEOUT_EXPECTED_PUBLICATION_TARGETS)),
    );
  });
});
