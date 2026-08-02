import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildGeometryLockBlock,
  buildPlateBirthPrompt,
  neckDiameterMmFromThread,
  resolvePlateBirthGeometry,
} from "./plateBirthPrompt";

test("GPI thread designation yields neck outer diameter", () => {
  assert.equal(neckDiameterMmFromThread("17-415"), 17);
  assert.equal(neckDiameterMmFromThread("13-415"), 13);
  assert.equal(neckDiameterMmFromThread("18-415"), 18);
  assert.equal(neckDiameterMmFromThread("20-400"), 20);
  assert.equal(neckDiameterMmFromThread("8-425"), 8);
  assert.equal(neckDiameterMmFromThread("17mm"), 17);
  assert.equal(neckDiameterMmFromThread("Ground"), null);
  assert.equal(neckDiameterMmFromThread(""), null);
});

test("geometry resolves ratios that anchor proportion", () => {
  const g = resolvePlateBirthGeometry({
    family: "Cylinder", capacityMl: 9, color: "Clear",
    bodyHeightMm: 70, bodyWidthMm: 20, neckThreadSize: "17-415",
  });
  assert.equal(g.aspectRatio, 3.5);
  assert.ok(Math.abs(g.widthToHeightPct - 28.57) < 0.01);
  assert.ok(g.neckToBodyPct !== null && Math.abs(g.neckToBodyPct - 85) < 0.01);
  assert.match(g.silhouetteDescriptor, /sturdy/);
});

test("silhouette descriptor tracks the aspect band", () => {
  const at = (h: number, w: number) =>
    resolvePlateBirthGeometry({
      family: "F", capacityMl: 1, color: "Clear",
      bodyHeightMm: h, bodyWidthMm: w, neckThreadSize: "13-415",
    }).silhouetteDescriptor;
  assert.match(at(106, 18), /slender tube|slender vial/);
  assert.match(at(70, 20), /sturdy/);
  assert.match(at(50, 25), /stout/);
});

test("geometry lock states measurements, ratios, and the anti-slender rule", () => {
  const block = buildGeometryLockBlock(resolvePlateBirthGeometry({
    family: "Cylinder", capacityMl: 9, color: "Clear",
    bodyHeightMm: 70, bodyWidthMm: 20, neckThreadSize: "17-415",
  }));
  assert.match(block, /70mm tall and 20mm wide/);
  assert.match(block, /29% of the body height/);
  assert.match(block, /3\.50:1/);
  assert.match(block, /wider rather than narrower/);
  assert.match(block, /17mm outer diameter/);
  assert.match(block, /85% of the body width/);
});

test("missing thread data degrades gracefully (no neck claims invented)", () => {
  const block = buildGeometryLockBlock(resolvePlateBirthGeometry({
    family: "Apothecary", capacityMl: 30, color: "Clear",
    bodyHeightMm: 80, bodyWidthMm: 30, neckThreadSize: "Ground",
  }));
  assert.equal(/Neck finish/.test(block), false);
  assert.match(block, /80mm tall and 30mm wide/);
});

test("pass 1 targets a white sweep; pass 2 births on Bone with no shadow", () => {
  const m = {
    family: "Cylinder", capacityMl: 9, color: "Clear",
    bodyHeightMm: 70, bodyWidthMm: 20, neckThreadSize: "17-415",
  };
  const p1 = buildPlateBirthPrompt(m, { pass: 1 });
  const p2 = buildPlateBirthPrompt(m, { pass: 2 });
  assert.match(p1, /warm-white studio sweep/);
  assert.match(p1, /lost its optics/);
  assert.match(p2, /#F5F3EF/);
  assert.match(p2, /SHADOW:\nNONE/);
  // Both must carry the canonical proportions and the override rule.
  for (const p of [p1, p2]) {
    assert.match(p, /3\.50:1/);
    assert.match(p, /85% of the body width/);
    assert.match(p, /GEOMETRY LOCK wins/);
  }
});

test("colored glass swaps optics language without touching geometry", () => {
  const amber = buildPlateBirthPrompt({
    family: "Cylinder", capacityMl: 9, color: "Amber",
    bodyHeightMm: 70, bodyWidthMm: 20, neckThreadSize: "17-415",
  }, { pass: 2 });
  assert.match(amber, /Saturated amber transmitted color/);
  assert.match(amber, /never black, never opaque/);
  assert.match(amber, /3\.50:1/);
});
