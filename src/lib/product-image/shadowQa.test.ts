import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeModelOwnedShadow } from "./shadowQa";

type ShadowFixtureKind =
  | "good"
  | "detached"
  | "double"
  | "absent"
  | "overlong"
  | "floor-seam";

function makeShadowFixture(kind: ShadowFixtureKind) {
  const width = 400;
  const height = 440;
  const background = { r: 246, g: 239, b: 232 };
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = background.r;
    pixels[i + 1] = background.g;
    pixels[i + 2] = background.b;
    pixels[i + 3] = 255;
  }

  const paint = (
    left: number,
    top: number,
    right: number,
    bottom: number,
    delta: number,
  ) => {
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const i = (y * width + x) * 4;
        pixels[i] = background.r - delta;
        pixels[i + 1] = background.g - delta;
        pixels[i + 2] = background.b - delta;
      }
    }
  };

  paint(170, 90, 230, 360, 120);
  if (kind === "good") {
    paint(214, 361, 246, 363, 32);
    paint(226, 364, 247, 368, 14);
  } else if (kind === "detached") {
    paint(214, 367, 247, 372, 28);
  } else if (kind === "double") {
    paint(214, 361, 246, 364, 28);
    paint(235, 371, 255, 374, 20);
  } else if (kind === "overlong") {
    paint(214, 361, 246, 363, 32);
    paint(226, 364, 247, 389, 14);
  } else if (kind === "floor-seam") {
    paint(214, 361, 246, 363, 16);
    paint(160, 368, 270, 370, 48);
  }

  return {
    pixels,
    width,
    height,
    background,
    productBounds: { left: 170, right: 230, top: 90, bottom: 360 },
    baselineYPx: 360,
  };
}

describe("analyzeModelOwnedShadow", () => {
  it("passes both required contacts for a detached-sidecar topology", () => {
    const fixture = makeShadowFixture("good");
    const paint = (left: number, top: number, right: number, bottom: number, delta: number) => {
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const index = (y * fixture.width + x) * 4;
          fixture.pixels[index] = fixture.background.r - delta;
          fixture.pixels[index + 1] = fixture.background.g - delta;
          fixture.pixels[index + 2] = fixture.background.b - delta;
        }
      }
    };
    paint(280, 300, 320, 360, 120);
    paint(314, 361, 325, 363, 32);
    paint(320, 364, 330, 368, 14);

    const analysis = analyzeModelOwnedShadow({
      ...fixture,
      topology: {
        kind: "detached-sidecar",
        expectedContacts: ["bottle", "sidecar"],
        source: "reviewed-reference",
      },
      contactBounds: {
        bottle: fixture.productBounds,
        sidecar: { left: 280, right: 320, top: 300, bottom: 360 },
      },
    });

    assert.equal(analysis.report.contacts?.length, 2);
    assert.equal(analysis.report.status, "pass", JSON.stringify(analysis.report));
    assert.ok(analysis.preservationMask.some((value) => value === 1));
  });

  it("partitions nearby expected contact shadows instead of reporting a false double", () => {
    const fixture = makeShadowFixture("good");
    const paint = (
      left: number,
      top: number,
      right: number,
      bottom: number,
      delta: number,
    ) => {
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const index = (y * fixture.width + x) * 4;
          fixture.pixels[index] = fixture.background.r - delta;
          fixture.pixels[index + 1] = fixture.background.g - delta;
          fixture.pixels[index + 2] = fixture.background.b - delta;
        }
      }
    };
    paint(260, 300, 360, 360, 120);
    // The sidecar feather extends left into the bottle's default 35% right
    // analysis lane, but remains the expected sidecar contact—not a double.
    paint(250, 361, 385, 363, 32);
    paint(330, 364, 388, 368, 14);

    const analysis = analyzeModelOwnedShadow({
      ...fixture,
      topology: {
        kind: "detached-sidecar",
        expectedContacts: ["bottle", "sidecar"],
        source: "reviewed-reference",
      },
      contactBounds: {
        bottle: fixture.productBounds,
        sidecar: { left: 260, right: 360, top: 300, bottom: 360 },
      },
    });

    assert.equal(analysis.report.status, "pass", JSON.stringify(analysis.report));
    assert.equal(analysis.report.contacts?.[0]?.measurements.componentCount, 1);
    assert.equal(analysis.report.contacts?.[1]?.measurements.componentCount, 1);
  });

  it("fails a detached-sidecar topology when the cap shadow is missing", () => {
    const fixture = makeShadowFixture("good");
    const analysis = analyzeModelOwnedShadow({
      ...fixture,
      topology: {
        kind: "detached-sidecar",
        expectedContacts: ["bottle", "sidecar"],
        source: "reviewed-reference",
      },
      contactBounds: {
        bottle: fixture.productBounds,
        sidecar: { left: 280, right: 320, top: 300, bottom: 360 },
      },
    });

    assert.equal(analysis.report.status, "fail");
    assert.match(analysis.report.failures.join(" "), /sidecar/i);
  });

  it("passes a continuous back-right feather and preserves its connected component", () => {
    const good = analyzeModelOwnedShadow(makeShadowFixture("good"));

    assert.equal(good.report.status, "pass");
    assert.ok((good.report.measurements.contactGapPx ?? 99) <= 2);
    assert.ok((good.report.measurements.rightExtensionRatio ?? 0) >= 0.2);
    assert.ok((good.report.measurements.rightExtensionRatio ?? 1) <= 0.32);
    assert.ok(good.preservationMask.some((value) => value === 1));
  });

  it("ignores tiny disconnected specks for QA and disconnected depth while masking every candidate", () => {
    const fixture = makeShadowFixture("good");
    const specks = [
      [164, 365],
      [166, 371],
      [250, 374],
      [200, 401],
    ] as const;
    for (const [x, y] of specks) {
      const index = (y * fixture.width + x) * 4;
      fixture.pixels[index] = fixture.background.r - 5;
      fixture.pixels[index + 1] = fixture.background.g - 5;
      fixture.pixels[index + 2] = fixture.background.b - 5;
    }

    const analysis = analyzeModelOwnedShadow(fixture);

    assert.equal(analysis.report.status, "pass");
    assert.equal(analysis.report.measurements.componentCount, 1);
    assert.equal(analysis.report.measurements.verticalDepthPx, 8);
    for (const [x, y] of specks) {
      assert.equal(analysis.candidateMask[y * fixture.width + x], 1);
    }
  });

  it("does not extend depth for a connected but non-meaningful continuation fringe", () => {
    const fixture = makeShadowFixture("good");
    for (let y = 369; y <= 376; y += 1) {
      const x = 235;
      const index = (y * fixture.width + x) * 4;
      fixture.pixels[index] = fixture.background.r - 5;
      fixture.pixels[index + 1] = fixture.background.g - 5;
      fixture.pixels[index + 2] = fixture.background.b - 5;
    }

    const analysis = analyzeModelOwnedShadow(fixture);

    assert.equal(analysis.report.status, "pass");
    assert.equal(analysis.report.measurements.verticalDepthPx, 15);
    assert.equal(analysis.candidateMask[376 * fixture.width + 235], 1);
  });

  it("fails a detached shadow with an excessive contact gap", () => {
    const report = analyzeModelOwnedShadow(makeShadowFixture("detached")).report;

    assert.equal(report.status, "fail");
    assert.match(report.failures.join(" "), /contact gap/i);
  });

  it("fails multiple connected shadow components", () => {
    const report = analyzeModelOwnedShadow(makeShadowFixture("double")).report;

    assert.equal(report.status, "fail");
    assert.match(report.failures.join(" "), /multiple connected/i);
  });

  it("requests review when no shadow candidate is present", () => {
    const report = analyzeModelOwnedShadow(makeShadowFixture("absent")).report;

    assert.equal(report.status, "review");
    assert.match(report.warnings.join(" "), /connected shadow|shadow/i);
  });

  it("masks a detached continuation even when the primary lane is empty", () => {
    const fixture = makeShadowFixture("absent");
    for (let y = 380; y <= 392; y += 1) {
      for (let x = 214; x <= 230; x += 1) {
        const i = (y * fixture.width + x) * 4;
        fixture.pixels[i] = fixture.background.r - 18;
        fixture.pixels[i + 1] = fixture.background.g - 18;
        fixture.pixels[i + 2] = fixture.background.b - 18;
      }
    }

    const analysis = analyzeModelOwnedShadow(fixture);

    assert.equal(analysis.report.status, "review");
    assert.ok(analysis.candidateMask.some((value) => value === 1));
    assert.equal(analysis.preservationMask.some((value) => value === 1), false);
  });

  it("fails an overlong feather and a dark floor seam", () => {
    const overlong = analyzeModelOwnedShadow(makeShadowFixture("overlong")).report;
    const floorSeam = analyzeModelOwnedShadow(makeShadowFixture("floor-seam")).report;

    assert.equal(overlong.status, "fail");
    assert.match(overlong.failures.join(" "), /depth|overlong/i);
    assert.equal(floorSeam.status, "fail");
  });
});
