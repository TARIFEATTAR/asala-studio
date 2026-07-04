import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FAMILY_RIG } from "./familyRig";
import {
  applyMaskControlledForegroundMatte,
  applyRigForegroundMatte,
  computeRigFrameTransform,
  detectAlphaControlBounds,
  getMaskControlledBoundsQaIssues,
  getMaskControlledVisualContinuityQaIssues,
  getVisibleMatteArtifactQaIssues,
  detectStrongBounds,
  flattenBackgroundLikePixels,
} from "./rigPostprocess";

describe("computeRigFrameTransform", () => {
  it("scales down a too-tall output while keeping the rig baseline fixed", () => {
    const rig = FAMILY_RIG.cylinder;
    const result = computeRigFrameTransform({
      width: 2080,
      height: 2288,
      rig,
      detectedBaselineYPx: 1999,
      strongBounds: { top: 12, bottom: 2000 },
    });

    assert.ok(result.scale < 0.95);
    assert.equal(result.shiftXPx, 0);
    assert.ok(result.shiftYPx > 120);
    assert.equal(Math.round(result.detectedBaselineYPx * result.scale + result.shiftYPx), 2082);
    assert.ok(result.transformedTopYPx >= 120);
    assert.ok(result.transformedBottomYPx <= 2276);
  });

  it("leaves an already 76%-rig-sized output essentially unchanged", () => {
    const rig = FAMILY_RIG.cylinder;
    const result = computeRigFrameTransform({
      width: 2080,
      height: 2288,
      rig,
      detectedBaselineYPx: 2082,
      strongBounds: { top: 343, bottom: 2082 },
    });

    assert.equal(result.scale, 1);
    assert.equal(result.shiftXPx, 0);
    assert.equal(result.shiftYPx, 0);
  });

  it("scales up small outputs without crowding the top of the canvas", () => {
    const rig = FAMILY_RIG.cylinder;
    const result = computeRigFrameTransform({
      width: 2080,
      height: 2288,
      rig,
      detectedBaselineYPx: 1660,
      strongBounds: { top: 610, bottom: 1660 },
    });

    assert.ok(result.scale > 1);
    assert.equal(Math.round(result.detectedBaselineYPx * result.scale + result.shiftYPx), 2082);
    assert.ok(result.transformedTopYPx != null);
    assert.ok(result.transformedTopYPx >= 340);
    assert.ok(result.transformedTopYPx <= 350);
  });

  it("normalizes the oversized 3 ml fine-mist sprayer envelope to the Cylinder target", () => {
    const rig = FAMILY_RIG.cylinder;
    const result = computeRigFrameTransform({
      width: 2080,
      height: 2288,
      rig,
      detectedBaselineYPx: 2093,
      strongBounds: { top: 154, bottom: 2093 },
    });

    assert.ok(result.scale < 0.9);
    assert.equal(Math.round(result.detectedBaselineYPx * result.scale + result.shiftYPx), 2082);
    assert.ok(result.transformedTopYPx != null);
    assert.ok(result.transformedBottomYPx != null);
    assert.ok(result.transformedTopYPx >= 340);
    assert.ok(result.transformedTopYPx <= 350);
    assert.ok(result.transformedBottomYPx >= 2081);
    assert.ok(result.transformedBottomYPx <= 2083);
  });
});

describe("detectStrongBounds", () => {
  it("counts low-contrast pale caps as foreground against the Bone background", () => {
    const width = 200;
    const height = 260;
    const bg = { r: 238, g: 230, b: 212 };
    const paleCap = { r: 245, g: 241, b: 232 };
    const darkBody = { r: 80, g: 72, b: 58 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 255;
    }

    const paintRect = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: { r: number; g: number; b: number },
    ) => {
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          pixels[i] = color.r;
          pixels[i + 1] = color.g;
          pixels[i + 2] = color.b;
        }
      }
    };

    paintRect(84, 30, 116, 76, paleCap);
    paintRect(76, 76, 124, 220, darkBody);

    const bounds = detectStrongBounds(pixels, width, height, bg);

    assert.deepEqual(bounds, { top: 30, bottom: 218, left: 76, right: 122 });
  });

  it("ignores isolated pale background noise when finding foreground bounds", () => {
    const width = 200;
    const height = 260;
    const bg = { r: 238, g: 230, b: 212 };
    const noise = { r: 248, g: 242, b: 232 };
    const darkBody = { r: 80, g: 72, b: 58 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 255;
    }

    for (const [x, y] of [[20, 10], [171, 18], [110, 24]]) {
      const i = (y * width + x) * 4;
      pixels[i] = noise.r;
      pixels[i + 1] = noise.g;
      pixels[i + 2] = noise.b;
    }

    for (let y = 82; y < 220; y += 1) {
      for (let x = 76; x < 124; x += 1) {
        const i = (y * width + x) * 4;
        pixels[i] = darkBody.r;
        pixels[i + 1] = darkBody.g;
        pixels[i + 2] = darkBody.b;
      }
    }

    const bounds = detectStrongBounds(pixels, width, height, bg);

    assert.deepEqual(bounds, { top: 82, bottom: 218, left: 76, right: 122 });
  });
});

describe("detectAlphaControlBounds", () => {
  it("uses transparent mask alpha as the deterministic product envelope", () => {
    const width = 20;
    const height = 24;
    const mask = new Uint8ClampedArray(width * height * 4);

    for (let y = 5; y <= 18; y += 1) {
      for (let x = 8; x <= 12; x += 1) {
        mask[(y * width + x) * 4 + 3] = 255;
      }
    }

    const bounds = detectAlphaControlBounds({ data: mask, width, height });

    assert.deepEqual(bounds, {
      left: 8,
      right: 12,
      top: 5,
      bottom: 18,
      foregroundPixels: 70,
      foregroundPixelRatio: 70 / (width * height),
    });
  });
});

describe("getMaskControlledBoundsQaIssues", () => {
  it("blocks tiny generated products even when the mask envelope is large enough", () => {
    const issues = getMaskControlledBoundsQaIssues({
      generatedBounds: { left: 18, right: 22, top: 38, bottom: 45 },
      controlBounds: {
        left: 8,
        right: 30,
        top: 5,
        bottom: 45,
        foregroundPixels: 700,
        foregroundPixelRatio: 0.2,
      },
    });

    assert.match(issues.join(" "), /too small/i);
  });

  it("blocks generated products that do not overlap the transparent mask envelope", () => {
    const issues = getMaskControlledBoundsQaIssues({
      generatedBounds: { left: 2, right: 8, top: 5, bottom: 20 },
      controlBounds: {
        left: 24,
        right: 32,
        top: 5,
        bottom: 45,
        foregroundPixels: 700,
        foregroundPixelRatio: 0.2,
      },
    });

    assert.match(issues.join(" "), /does not overlap/i);
  });

  it("passes generated products that align with the mask envelope", () => {
    const issues = getMaskControlledBoundsQaIssues({
      generatedBounds: { left: 10, right: 28, top: 7, bottom: 44 },
      controlBounds: {
        left: 8,
        right: 30,
        top: 5,
        bottom: 45,
        foregroundPixels: 700,
        foregroundPixelRatio: 0.2,
      },
    });

    assert.deepEqual(issues, []);
  });
});

describe("getMaskControlledVisualContinuityQaIssues", () => {
  it("blocks generated products that collapse into disconnected sparse foreground", () => {
    const width = 120;
    const height = 160;
    const bg = { r: 238, g: 230, b: 212 };
    const pixels = new Uint8ClampedArray(width * height * 4);
    const controlBounds = {
      left: 42,
      right: 78,
      top: 18,
      bottom: 138,
      foregroundPixels: 3200,
      foregroundPixelRatio: 3200 / (width * height),
    };

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 255;
    }

    const paintRect = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: { r: number; g: number; b: number },
    ) => {
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          pixels[i] = color.r;
          pixels[i + 1] = color.g;
          pixels[i + 2] = color.b;
        }
      }
    };

    paintRect(55, 20, 66, 30, { r: 180, g: 172, b: 154 });
    paintRect(54, 112, 67, 138, { r: 72, g: 68, b: 60 });

    const issues = getMaskControlledVisualContinuityQaIssues({
      pixels,
      width,
      height,
      bg,
      controlBounds,
    });

    assert.match(issues.join(" "), /discontinuous|too little visible/i);
  });

  it("passes clear-glass products with continuous edge signal through the mask envelope", () => {
    const width = 120;
    const height = 160;
    const bg = { r: 238, g: 230, b: 212 };
    const pixels = new Uint8ClampedArray(width * height * 4);
    const controlBounds = {
      left: 42,
      right: 78,
      top: 18,
      bottom: 138,
      foregroundPixels: 3200,
      foregroundPixelRatio: 3200 / (width * height),
    };

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 255;
    }

    for (let y = 20; y <= 136; y += 1) {
      for (const x of [45, 46, 74, 75]) {
        const i = (y * width + x) * 4;
        pixels[i] = 90;
        pixels[i + 1] = 84;
        pixels[i + 2] = 74;
      }
    }

    const issues = getMaskControlledVisualContinuityQaIssues({
      pixels,
      width,
      height,
      bg,
      controlBounds,
    });

    assert.deepEqual(issues, []);
  });

  it("blocks pale mask-shaped silhouettes that do not contain real product detail", () => {
    const width = 120;
    const height = 160;
    const bg = { r: 238, g: 230, b: 212 };
    const pixels = new Uint8ClampedArray(width * height * 4);
    const controlBounds = {
      left: 38,
      right: 82,
      top: 18,
      bottom: 138,
      foregroundPixels: 4200,
      foregroundPixelRatio: 4200 / (width * height),
    };

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 255;
    }

    for (let y = 20; y <= 136; y += 1) {
      for (let x = 42; x <= 78; x += 1) {
        const i = (y * width + x) * 4;
        pixels[i] = 250;
        pixels[i + 1] = 246;
        pixels[i + 2] = 236;
      }
      for (const x of [42, 78]) {
        const i = (y * width + x) * 4;
        pixels[i] = 78;
        pixels[i + 1] = 72;
        pixels[i + 2] = 62;
      }
    }

    const issues = getMaskControlledVisualContinuityQaIssues({
      pixels,
      width,
      height,
      bg,
      controlBounds,
    });

    assert.match(issues.join(" "), /detail|visible foreground/i);
  });
});

describe("flattenBackgroundLikePixels", () => {
  it("removes cream plate drift without flattening the cap, product, or contact shadow", () => {
    const bg = { r: 238, g: 230, b: 212 };
    const nearCreamPlate = { r: 245, g: 236, b: 218 };
    const subtleDarkerPlate = { r: 228, g: 220, b: 202 };
    const whiteCap = { r: 252, g: 250, b: 242 };
    const shadow = { r: 198, g: 187, b: 164 };
    const darkProduct = { r: 44, g: 42, b: 36 };
    const pixels = new Uint8ClampedArray(5 * 4);

    const write = (pixelIndex: number, color: { r: number; g: number; b: number }) => {
      const i = pixelIndex * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    write(0, nearCreamPlate);
    write(1, subtleDarkerPlate);
    write(2, whiteCap);
    write(3, shadow);
    write(4, darkProduct);

    const result = flattenBackgroundLikePixels(pixels, bg);

    assert.deepEqual(Array.from(pixels.slice(0, 3)), [bg.r, bg.g, bg.b]);
    assert.deepEqual(Array.from(pixels.slice(4, 7)), [bg.r, bg.g, bg.b]);
    assert.deepEqual(Array.from(pixels.slice(8, 11)), [whiteCap.r, whiteCap.g, whiteCap.b]);
    assert.deepEqual(Array.from(pixels.slice(12, 15)), [shadow.r, shadow.g, shadow.b]);
    assert.deepEqual(Array.from(pixels.slice(16, 19)), [darkProduct.r, darkProduct.g, darkProduct.b]);
    assert.equal(result.flattenedPixels, 2);
  });
});

describe("getVisibleMatteArtifactQaIssues", () => {
  const bg = { r: 238, g: 230, b: 212 };

  function makePixels(width: number, height: number): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 255;
    }
    return pixels;
  }

  function paintRect(
    pixels: Uint8ClampedArray,
    width: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: { r: number; g: number; b: number },
  ) {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * width + x) * 4;
        pixels[i] = color.r;
        pixels[i + 1] = color.g;
        pixels[i + 2] = color.b;
        pixels[i + 3] = 255;
      }
    }
  }

  it("flags a large pale matte rectangle left behind by generation", () => {
    const width = 120;
    const height = 140;
    const pixels = makePixels(width, height);

    paintRect(pixels, width, 58, 28, 98, 124, { r: 250, g: 246, b: 235 });
    paintRect(pixels, width, 46, 76, 56, 126, { r: 34, g: 32, b: 30 });

    const issues = getVisibleMatteArtifactQaIssues({ pixels, width, height, bg });

    assert.match(issues.join(" "), /matte|blotch/i);
  });

  it("allows a clean product with a local contact shadow on Bone", () => {
    const width = 120;
    const height = 140;
    const pixels = makePixels(width, height);

    paintRect(pixels, width, 54, 32, 66, 126, { r: 34, g: 32, b: 30 });
    paintRect(pixels, width, 64, 119, 88, 126, { r: 202, g: 190, b: 166 });

    const issues = getVisibleMatteArtifactQaIssues({ pixels, width, height, bg });

    assert.deepEqual(issues, []);
  });
});

describe("applyRigForegroundMatte", () => {
  it("removes pale matte pollution inside protected clear-glass bounds while preserving real edges", () => {
    const width = 28;
    const height = 32;
    const bg = { r: 245, g: 243, b: 239 };
    const darkGlassEdge = { r: 86, g: 88, b: 86 };
    const paleInterior = { r: 255, g: 255, b: 255 };
    const subtleInteriorPollution = { r: 250, g: 248, b: 244 };
    const looseHalo = { r: 255, g: 255, b: 255 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    const write = (x: number, y: number, color: { r: number; g: number; b: number }) => {
      const i = (y * width + x) * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(x, y, bg);
      }
    }

    for (let y = 7; y < 27; y += 1) {
      write(10, y, darkGlassEdge);
      write(17, y, darkGlassEdge);
    }
    for (let y = 12; y < 22; y += 1) {
      for (let x = 12; x < 16; x += 1) {
        write(x, y, paleInterior);
      }
    }
    write(14, 16, subtleInteriorPollution);
    for (let y = 12; y < 22; y += 1) {
      for (let x = 2; x < 6; x += 1) {
        write(x, y, looseHalo);
      }
    }

    applyRigForegroundMatte(pixels, width, height, bg, {
      protectedProductBounds: { left: 10, right: 17, top: 7, bottom: 26 },
    });

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.equal(alphaAt(10, 16), 255);
    assert.equal(alphaAt(17, 16), 255);
    assert.equal(alphaAt(13, 16), 0);
    assert.equal(alphaAt(14, 16), 0);
    assert.equal(alphaAt(3, 16), 0);
  });

  it("removes a generated background plate while preserving product pixels and contact shadow", () => {
    const width = 12;
    const height = 10;
    const bg = { r: 238, g: 230, b: 212 };
    const plate = { r: 230, g: 221, b: 204 };
    const darkGlass = { r: 68, g: 62, b: 52 };
    const paleCap = { r: 252, g: 248, b: 238 };
    const shadow = { r: 190, g: 180, b: 158 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    const write = (x: number, y: number, color: { r: number; g: number; b: number }) => {
      const i = (y * width + x) * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(x, y, bg);
      }
    }

    for (let y = 2; y < 9; y += 1) {
      for (let x = 2; x < 11; x += 1) {
        write(x, y, plate);
      }
    }

    write(5, 2, paleCap);
    write(5, 3, paleCap);
    write(5, 4, darkGlass);
    write(5, 5, darkGlass);
    write(5, 6, darkGlass);
    write(5, 7, darkGlass);
    write(6, 8, shadow);
    write(7, 8, shadow);

    const result = applyRigForegroundMatte(pixels, width, height, bg);

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.equal(alphaAt(2, 2), 0);
    assert.equal(alphaAt(10, 8), 0);
    assert.equal(alphaAt(5, 2), 255);
    assert.equal(alphaAt(5, 5), 255);
    assert.ok(alphaAt(6, 8) > 0);
    assert.ok(alphaAt(6, 8) < 255);
    assert.equal(result.mattedBackgroundPixels, 112);
    assert.equal(result.opaqueForegroundPixels, 6);
    assert.equal(result.shadowPixels, 2);
  });

  it("removes diffuse pale halo texture away from the product", () => {
    const width = 24;
    const height = 20;
    const bg = { r: 238, g: 230, b: 212 };
    const halo = { r: 252, g: 247, b: 236 };
    const darkGlass = { r: 62, g: 58, b: 48 };
    const paleCap = { r: 252, g: 248, b: 238 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    const write = (x: number, y: number, color: { r: number; g: number; b: number }) => {
      const i = (y * width + x) * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(x, y, bg);
      }
    }

    for (let y = 4; y < 14; y += 1) {
      for (let x = 3; x < 21; x += 1) {
        write(x, y, halo);
      }
    }

    for (let y = 5; y < 9; y += 1) {
      for (let x = 10; x < 14; x += 1) {
        write(x, y, paleCap);
      }
    }
    for (let y = 8; y < 17; y += 1) {
      write(9, y, darkGlass);
      write(14, y, darkGlass);
    }

    applyRigForegroundMatte(pixels, width, height, bg);

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.equal(alphaAt(4, 5), 0);
    assert.equal(alphaAt(19, 12), 0);
    assert.equal(alphaAt(11, 6), 255);
    assert.equal(alphaAt(9, 12), 255);
  });

  it("keeps contact shadow near the product but removes far shadow plate texture", () => {
    const width = 24;
    const height = 20;
    const bg = { r: 238, g: 230, b: 212 };
    const darkGlass = { r: 62, g: 58, b: 48 };
    const shadow = { r: 190, g: 180, b: 158 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    const write = (x: number, y: number, color: { r: number; g: number; b: number }) => {
      const i = (y * width + x) * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(x, y, bg);
      }
    }

    for (let y = 7; y < 17; y += 1) {
      write(9, y, darkGlass);
      write(14, y, darkGlass);
    }
    write(15, 16, shadow);
    write(16, 16, shadow);
    write(22, 16, shadow);

    applyRigForegroundMatte(pixels, width, height, bg, { shadowNeighborhoodPx: 4 });

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.ok(alphaAt(15, 16) > 0);
    assert.ok(alphaAt(15, 16) < 255);
    assert.equal(alphaAt(22, 16), 0);
  });

  it("removes disconnected lower-right texture while keeping the close contact shadow", () => {
    const width = 60;
    const height = 60;
    const bg = { r: 238, g: 230, b: 212 };
    const darkGlass = { r: 62, g: 58, b: 48 };
    const contactShadow = { r: 190, g: 180, b: 158 };
    const grittyTexture = { r: 198, g: 188, b: 166 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    const write = (x: number, y: number, color: { r: number; g: number; b: number }) => {
      const i = (y * width + x) * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(x, y, bg);
      }
    }

    for (let y = 20; y < 48; y += 1) {
      write(26, y, darkGlass);
      write(27, y, darkGlass);
    }

    for (let x = 28; x <= 33; x += 1) {
      write(x, 48, contactShadow);
      write(x, 49, contactShadow);
    }

    for (let y = 44; y <= 52; y += 2) {
      for (let x = 42; x <= 48; x += 2) {
        write(x, y, grittyTexture);
      }
    }

    applyRigForegroundMatte(pixels, width, height, bg);

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.ok(alphaAt(30, 48) > 0);
    assert.ok(alphaAt(30, 48) < 255);
    assert.equal(alphaAt(42, 48), 0);
  });

  it("removes a long horizontal shadow smear beyond the close grounding zone", () => {
    const width = 60;
    const height = 60;
    const bg = { r: 238, g: 230, b: 212 };
    const darkGlass = { r: 62, g: 58, b: 48 };
    const contactShadow = { r: 190, g: 180, b: 158 };
    const pixels = new Uint8ClampedArray(width * height * 4);

    const write = (x: number, y: number, color: { r: number; g: number; b: number }) => {
      const i = (y * width + x) * 4;
      pixels[i] = color.r;
      pixels[i + 1] = color.g;
      pixels[i + 2] = color.b;
      pixels[i + 3] = 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(x, y, bg);
      }
    }

    for (let y = 20; y < 48; y += 1) {
      write(26, y, darkGlass);
      write(27, y, darkGlass);
    }

    for (let x = 28; x <= 31; x += 1) {
      write(x, 48, contactShadow);
    }
    write(34, 48, contactShadow);

    applyRigForegroundMatte(pixels, width, height, bg);

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.ok(alphaAt(30, 48) > 0);
    assert.ok(alphaAt(30, 48) < 255);
    assert.equal(alphaAt(34, 48), 0);
  });
});

describe("applyMaskControlledForegroundMatte", () => {
  it("removes the generated white matte rectangle outside the mask-controlled product", () => {
    const width = 40;
    const height = 50;
    const bg = { r: 238, g: 230, b: 212 };
    const whiteMatte = { r: 255, g: 252, b: 244 };
    const darkGlass = { r: 56, g: 52, b: 44 };
    const shadow = { r: 194, g: 184, b: 162 };
    const pixels = new Uint8ClampedArray(width * height * 4);
    const mask = new Uint8ClampedArray(width * height * 4);

    const write = (target: Uint8ClampedArray, x: number, y: number, color: { r: number; g: number; b: number }, alpha = 255) => {
      const i = (y * width + x) * 4;
      target[i] = color.r;
      target[i + 1] = color.g;
      target[i + 2] = color.b;
      target[i + 3] = alpha;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        write(pixels, x, y, bg);
      }
    }

    for (let y = 17; y < 46; y += 1) {
      for (let x = 12; x < 29; x += 1) {
        write(pixels, x, y, whiteMatte);
      }
    }
    for (let y = 20; y < 42; y += 1) {
      for (let x = 18; x < 22; x += 1) {
        write(pixels, x, y, darkGlass);
        mask[(y * width + x) * 4 + 3] = 255;
      }
    }
    for (let x = 22; x <= 28; x += 1) {
      write(pixels, x, 42, shadow);
    }

    const result = applyMaskControlledForegroundMatte(pixels, width, height, bg, {
      data: mask,
      width,
      height,
    });
    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

    assert.equal(alphaAt(13, 18), 0);
    assert.equal(alphaAt(27, 44), 0);
    assert.equal(alphaAt(19, 30), 255);
    assert.ok(alphaAt(23, 42) > 0);
    assert.ok(alphaAt(23, 42) < 255);
    assert.ok(result.mattedBackgroundPixels > 0);
    assert.ok(result.opaqueForegroundPixels > 0);
    assert.ok(result.shadowPixels > 0);
  });
});
