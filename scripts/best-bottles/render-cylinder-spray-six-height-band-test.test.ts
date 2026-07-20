import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(
  "scripts/best-bottles/render-cylinder-spray-six-height-band-test.ts",
);
const MANIFEST_PATH = path.resolve(
  "tmp/best-bottles-reference-production/cylinder-spray-six-cap-on-curve-v1/manifest.json",
);

describe("Cylinder six-spray cap-on scale plate", () => {
  it("preserves the selected cap-on references without claiming they are cap-off sidecars", async () => {
    await execFileAsync("npx", ["tsx", SCRIPT_PATH], {
      cwd: path.resolve("."),
    });

    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    assert.deepEqual(
      manifest.selectedPanels.map((panel: { sourceIndex: number; label: string }) => ({
        sourceIndex: panel.sourceIndex,
        label: panel.label,
      })),
      [
        { sourceIndex: 0, label: "3 mL spray — source panel" },
        { sourceIndex: 2, label: "5 mL spray — source panel" },
        { sourceIndex: 3, label: "9 mL regular spray — cap on" },
        { sourceIndex: 5, label: "25 mL spray — cap on" },
        { sourceIndex: 6, label: "50 mL spray — cap on" },
        { sourceIndex: 7, label: "100 mL spray — cap on" },
      ],
    );
    assert.deepEqual(manifest.excludedSourcePanels, [
      { sourceIndex: 1, label: "4 mL spray" },
      { sourceIndex: 4, label: "9 mL tall spray" },
    ]);
    assert.equal(manifest.constraints.capState, "mixed-source-panels-four-right-cap-on");
  });
});
