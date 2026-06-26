import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countUnrecognizedLanes,
  findGapWorklistEntryForFamily,
  gapWorklistToCsv,
  indexIntakeByGraceSku,
  joinGapWorklistToIntake,
  normalizeGapWorklistLane,
  parseCsv,
  parseGapWorklistCsv,
  selectNewestGapWorklistPerFamily,
  summarizeGapWorklistLanes,
  type GapWorklistManifestEntry,
} from "./bestBottlesGapWorklist";

const CSV = [
  "graceSku,websiteSku,productName,capacityMl,color,applicator,capStyle,lane,action,resolutionNeeded,suggestedOwner,legacyUrl,legacyDescription",
  'GB-CYL-AMB-9ML-ROL-BKDT,GBCylAmb9RollBlkDot,Amber Roll-On,9,Amber,Metal Roller Ball,Dot Cap,A. rembg-cutout,run-rembg,Run run_cylinder_rembg_fallback.py,Internal / Mac,https://bestbottles.com/p/amber-9ml,"Amber glass, black dotted cap"',
  "GB-CYL-FRO-30ML-SPR-MAT,GBCylFro30SprMatte,Frosted Sprayer,30,Frosted,Sprayer,Matte,C. matte sprayer — only shiny art,confirm-variant,Confirm matte sprayer is sold,Nemat,https://bestbottles.com/p/frosted-30ml,Frosted with matte sprayer",
  "GB-CYL-MYS-7ML-SCR-GLD,GBCylMys7ScrewGold,Mystery,7,Clear,Screw Cap,Gold,rembg-cutout,run-rembg,Keyword-only lane,Internal,,",
  "GB-CYL-UNK-5ML-XXX,GBCylUnk5,Unknown,5,Clear,Dauber,Plain,Z. nonsense,review,Review identity,Internal,,",
].join("\n");

describe("Best Bottles gap worklist — CSV parsing", () => {
  it("parses quoted fields containing commas", () => {
    const { headers, records } = parseCsv(CSV);
    assert.equal(headers[0], "graceSku");
    assert.equal(records.length, 4);
    assert.equal(records[0].legacyDescription, "Amber glass, black dotted cap");
  });

  it("returns zero records for a header-only file", () => {
    const headerOnly = "graceSku,websiteSku,lane\n";
    const { headers, records } = parseCsv(headerOnly);
    assert.deepEqual(headers, ["graceSku", "websiteSku", "lane"]);
    assert.equal(records.length, 0);
  });

  it("maps rows to typed fields and preserves unknown columns in extra", () => {
    const withExtra =
      "graceSku,lane,notes\nGB-X,A,hello\n";
    const [row] = parseGapWorklistCsv(withExtra);
    assert.equal(row.graceSku, "GB-X");
    assert.equal(row.laneId, "A");
    assert.deepEqual(row.extra, { notes: "hello" });
  });
});

describe("Best Bottles gap worklist — lane normalization", () => {
  it("normalizes the README forms and a keyword-only token", () => {
    assert.equal(normalizeGapWorklistLane("A"), "A");
    assert.equal(normalizeGapWorklistLane("A. rembg-cutout"), "A");
    assert.equal(normalizeGapWorklistLane("C. matte sprayer — only shiny art (17)"), "C");
    assert.equal(normalizeGapWorklistLane("rembg-cutout"), "A"); // keyword fallback
    assert.equal(normalizeGapWorklistLane("Z. nonsense"), null);
    assert.equal(normalizeGapWorklistLane(""), null);
  });

  it("counts unrecognized lanes and tallies per-lane counts", () => {
    const rows = parseGapWorklistCsv(CSV);
    assert.equal(countUnrecognizedLanes(rows), 1); // the "Z. nonsense" row
    const summary = summarizeGapWorklistLanes(rows);
    const a = summary.find((s) => s.laneId === "A");
    const c = summary.find((s) => s.laneId === "C");
    assert.equal(a?.count, 2); // explicit "A." + keyword "rembg-cutout"
    assert.equal(c?.count, 1);
    assert.equal(summary.length, 7); // all lanes present, including zero-count ones
  });
});

describe("Best Bottles gap worklist — manifest selection", () => {
  const entries: GapWorklistManifestEntry[] = [
    { family: "Cylinder", familySlug: "cylinder", date: "2026-06-14", file: "/data/audits/cylinder-gap-worklist-2026-06-14.csv" },
    { family: "Cylinder", familySlug: "cylinder", date: "2026-06-21", file: "/data/audits/cylinder-gap-worklist-2026-06-21.csv" },
    { family: "Boston Round", familySlug: "boston-round", date: "2026-06-10", file: "/data/audits/boston-round-gap-worklist-2026-06-10.csv" },
  ];

  it("keeps only the newest dated file per family", () => {
    const newest = selectNewestGapWorklistPerFamily(entries);
    assert.equal(newest.length, 2);
    const cylinder = newest.find((e) => e.familySlug === "cylinder");
    assert.equal(cylinder?.date, "2026-06-21");
  });

  it("finds the newest entry for a family by name or slug", () => {
    const manifest = { generatedAt: "2026-06-21", entries };
    assert.equal(findGapWorklistEntryForFamily(manifest, "Cylinder")?.date, "2026-06-21");
    assert.equal(findGapWorklistEntryForFamily(manifest, "boston-round")?.familySlug, "boston-round");
    assert.equal(findGapWorklistEntryForFamily(manifest, "all"), null);
    assert.equal(findGapWorklistEntryForFamily(null, "Cylinder"), null);
  });
});

describe("Best Bottles gap worklist — intake join", () => {
  it("flags rows present/absent in the live intake by graceSku", () => {
    const rows = parseGapWorklistCsv(CSV);
    const intake = indexIntakeByGraceSku([
      { graceSku: "GB-CYL-AMB-9ML-ROL-BKDT", productGroupSlug: "cylinder-9ml-amber-17-415-rollon" },
    ]);
    const joined = joinGapWorklistToIntake(rows, intake);
    assert.equal(joined[0].inIntake, true);
    assert.equal(joined[0].productGroupSlug, "cylinder-9ml-amber-17-415-rollon");
    assert.equal(joined[1].inIntake, false);
    assert.equal(joined[1].productGroupSlug, null);
  });
});

describe("Best Bottles gap worklist — export round-trip", () => {
  it("serializes back to CSV, quoting commas and keeping extra columns", () => {
    const rows = parseGapWorklistCsv("graceSku,lane,notes\nGB-X,A,\"a,b\"\n");
    const csv = gapWorklistToCsv(rows);
    const reparsed = parseGapWorklistCsv(csv);
    assert.equal(reparsed[0].graceSku, "GB-X");
    assert.equal(reparsed[0].extra.notes, "a,b");
    assert.ok(csv.includes('"a,b"'));
  });
});
