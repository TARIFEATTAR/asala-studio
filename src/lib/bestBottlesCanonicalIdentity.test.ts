import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseCsv } from "./bestBottlesGapWorklist";

const CANONICAL_MASTER_PATH = path.resolve(
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
);

test("maps the live-site 25 mL Cylinder spray to its explicit Madison Grace identity", async () => {
  const csv = await readFile(CANONICAL_MASTER_PATH, "utf8");
  const { records } = parseCsv(csv);
  const row = records.find(({ websiteSku }) => websiteSku === "GBcyl25SpryShnBlk");

  assert.ok(row, "GBcyl25SpryShnBlk must remain in canonical master truth");
  assert.equal(row.graceSku, "GB-CYL-CLR-25ML-SPR-SBLK");
  assert.equal(row.readinessStatus, "ready");
  assert.equal(row.readinessIssues, "");
  assert.match(row.conflict_flags, /manual_grace_identity_assignment_20260716/);
  assert.match(row.conflict_flags, /live_site_sku_absent_from_2026-07-12_join/);
  assert.doesNotMatch(row.conflict_flags, /missing_grace_identity/);
});
