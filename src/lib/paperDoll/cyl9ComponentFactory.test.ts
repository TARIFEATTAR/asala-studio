import assert from "node:assert/strict";
import test from "node:test";

import {
  CYL9_COMPONENT_KEYS,
  buildCyl9ExpectedCatalogMappings,
  countCyl9RowsPerBody,
  loadCyl9ComponentFactory,
} from "./cyl9ComponentFactory";

test("CYL-9ML registers 23 component plates and 145 explicit assemblies", () => {
  const manifest = loadCyl9ComponentFactory();

  assert.equal(manifest.components.length, 23);
  assert.equal(CYL9_COMPONENT_KEYS.length, 23);
  assert.deepEqual(
    manifest.components.map(({ componentKey }) => componentKey),
    [...CYL9_COMPONENT_KEYS],
  );
  assert.equal(manifest.catalogMappings.length, 145);
  assert.deepEqual(countCyl9RowsPerBody(manifest), {
    AMB: 29,
    BLU: 29,
    CLR: 29,
    FRS: 29,
    SWL: 29,
  });
});

test("CYL-9ML inventory contains the exact slot counts", () => {
  const manifest = loadCyl9ComponentFactory();
  const counts = manifest.components.reduce<Record<string, number>>((result, { slot }) => {
    result[slot] = (result[slot] ?? 0) + 1;
    return result;
  }, {});

  assert.equal(counts.cap, 10);
  assert.equal(counts.roller, 2);
  assert.equal(counts.sprayer, 6);
  assert.equal(counts.pump, 3);
  assert.equal(counts.overcap, 2);
});

test("catalog mapping generation is deterministic and includes secondary overcaps", () => {
  const manifest = loadCyl9ComponentFactory();
  const generated = buildCyl9ExpectedCatalogMappings(manifest);

  assert.deepEqual(generated, manifest.catalogMappings);
  assert.equal(generated.filter(({ mode }) => mode === "rollon").length, 100);
  assert.equal(generated.filter(({ mode }) => mode === "spray").length, 30);
  assert.equal(generated.filter(({ mode }) => mode === "lotion").length, 15);
  assert.ok(
    generated
      .filter(({ mode }) => mode === "spray")
      .every(({ componentVariantKeys }) => componentVariantKeys.some((key) => key.includes("SPRAY-TRNS"))),
  );
  assert.ok(
    generated
      .filter(({ mode }) => mode === "lotion")
      .every(({ componentVariantKeys }) => componentVariantKeys.some((key) => key.includes("LOTION-TRNS"))),
  );
});

test("the five body hashes remain locked and the cap calibration stays inset", () => {
  const manifest = loadCyl9ComponentFactory();
  const expectedHashes = {
    AMB: "c84db213449da4ef6afbcb67fad0da5811ae937c3c9c1234be801cb473ea31c3",
    BLU: "87804d45a242795aaecf10d677ad469b22803e2f2476421ffbce5d4d944f148c",
    CLR: "97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f",
    FRS: "c844fb9f3a6ffb467daa02d17cb2378b659fc2e0be166f13073bb7b4f8422956",
    SWL: "c2b67ee9151dc89d44d3a8d65a112b908bb84a2c833ba0bcf643b16586371e68",
  };

  assert.deepEqual(
    Object.fromEntries(manifest.bodyPlates.map(({ bodyVariantKey, imageSha256 }) => [bodyVariantKey, imageSha256])),
    expectedHashes,
  );
  const capPlacement = manifest.placements.find(({ geometryFamilyId }) => (
    geometryFamilyId === "closure__17-415__rollon-overcap__v2"
  ));
  assert.ok(capPlacement);
  assert.equal(capPlacement.widthPx, 344);
  assert.equal(capPlacement.centerXPx, 1041);
  assert.equal(capPlacement.seatYPx, 1002);
});

test("every component preserves its real source filename and calibrated authority evidence", () => {
  const manifest = loadCyl9ComponentFactory();

  assert.ok(manifest.components.every(({ source }) => source.originalFilename.endsWith(".png")));
  assert.equal(new Set(manifest.components.map(({ source }) => source.originalFilename)).size, 23);
  assert.ok(manifest.components.every(({ authorityStatus, authority }) => (
    authorityStatus === "approved" &&
    authority !== null &&
    authority.expectedRegions === 1 &&
    authority.maskWidthPx === 2080 &&
    authority.maskHeightPx === 2288
  )));
  assert.equal(new Set(manifest.components.map(({ geometryFamilyId }) => geometryFamilyId)).size, 13);
  assert.ok(new Set(manifest.components.map(({ authority }) => authority?.maskSha256)).size >= 10);
  assert.ok(manifest.placements.every(({ locked }) => locked === false));
});
