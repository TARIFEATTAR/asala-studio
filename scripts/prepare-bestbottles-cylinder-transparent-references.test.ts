import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("writes public Cylinder reference rig readiness with cap-state counts", () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "bb-cylinder-reference-rig-"));
  const outJson = path.join(tmpDir, "prep.json");
  const outCsv = path.join(tmpDir, "prep.csv");
  const publicOutJson = path.join(tmpDir, "public-rig.json");
  const report = path.join(tmpDir, "prep.md");

  try {
    const result = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/prepare-bestbottles-cylinder-transparent-references.ts",
        "--out-json",
        outJson,
        "--out-csv",
        outCsv,
        "--public-out-json",
        publicOutJson,
        "--report",
        report,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(readFileSync(publicOutJson, "utf8"));

    assert.equal(payload.policy.filename, "{graceSku}.png");
    assert.equal(payload.policy.capStates, "cap-on or cap-off only");
    assert.equal(typeof payload.summary.capOn, "number");
    assert.equal(typeof payload.summary.capOff, "number");
    assert.equal(typeof payload.summary.capStateMissing, "number");
    assert.equal(typeof payload.summary.readyCapOn, "number");
    assert.equal(typeof payload.summary.readyCapOff, "number");
    assert.equal(payload.rows.length, payload.summary.totalRows);
    assert.ok(payload.rows.every((row: { targetPath: string | null }) => row.targetPath == null || row.targetPath.endsWith(".png")));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
