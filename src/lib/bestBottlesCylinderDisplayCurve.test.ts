import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMonotonicCylinderBodies,
  resolveCylinderDisplayScale,
} from "./bestBottlesCylinderDisplayCurve";

describe("Cylinder measurement-driven display curve", () => {
  it("keeps the 9 ml body taller than the 5 ml body", () => {
    const five = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 55, heightWithoutCapMm: 53, diameterMm: 17,
    });
    const nine = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 75, heightWithoutCapMm: 63, diameterMm: 21,
    });
    assert.ok(nine.bodyTargetPx >= five.bodyTargetPx * 1.06);
    assert.equal(five.assembledTargetPct, 58);
    assert.equal(nine.assembledTargetPct, 71);
  });

  it("keeps the 100 ml body taller than the 50 ml body", () => {
    const fifty = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 128, heightWithoutCapMm: 117, diameterMm: 32,
    });
    const hundred = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 180, heightWithoutCapMm: 154, diameterMm: 35,
    });
    assert.ok(hundred.bodyTargetPx >= fifty.bodyTargetPx * 1.04);
    assert.equal(fifty.assembledTargetPct, 79);
    assert.equal(hundred.assembledTargetPct, 88);
  });

  it("rejects a body-order reversal", () => {
    assert.throws(() => assertMonotonicCylinderBodies([
      { key: "small", heightWithoutCapMm: 53, bodyTargetPx: 1400 },
      { key: "large", heightWithoutCapMm: 63, bodyTargetPx: 1399 },
    ]), /body target reversal/i);
  });
});
