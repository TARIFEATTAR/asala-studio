export type ShadowQaStatus = "pass" | "review" | "fail";

export interface ShadowQaRgb {
  r: number;
  g: number;
  b: number;
}

export interface ShadowQaBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ShadowQaObjectBounds {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

export interface AnalyzeModelOwnedShadowInput {
  pixels: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  background: ShadowQaRgb;
  productBounds?: ShadowQaBounds;
  /** Alias used by rig post-processing callers. */
  objectBounds?: ShadowQaObjectBounds;
  baselineYPx: number;
  topology?: import("../bestBottlesShadowTopology").BestBottlesShadowTopology;
  contactBounds?: Partial<
    Record<
      import("../bestBottlesShadowTopology").BestBottlesShadowContact,
      ShadowQaBounds
    >
  >;
}

export type ModelShadowAnalysisInput = AnalyzeModelOwnedShadowInput;

export interface ShadowQaReport {
  status: ShadowQaStatus;
  failures: string[];
  warnings: string[];
  /** Required for new V6.1 evidence; optional only when parsing historical records. */
  contacts?: ShadowContactQa[];
  measurements: {
    contactGapPx: number | null;
    contactCoreDensity: number | null;
    rightExtensionPx: number | null;
    rightExtensionRatio: number | null;
    leftExtensionPx: number | null;
    verticalDepthPx: number | null;
    componentCount: number;
    shadowPixelCount: number;
  };
  target: {
    maxContactGapPx: 2;
    rightExtensionRatio: { min: 0.2; max: 0.3 };
    contract: "contact-back-right-v1";
  };
}

export interface ShadowContactQa {
  contact: import("../bestBottlesShadowTopology").BestBottlesShadowContact;
  status: ShadowQaStatus;
  bounds: ShadowQaBounds | null;
  measurements: ShadowQaReport["measurements"];
  failures: string[];
  warnings: string[];
}

export interface ModelShadowAnalysis {
  /** All model-shadow candidate pixels, including disconnected/invalid components. */
  candidateMask: Uint8Array;
  /** The single seeded component retained for output pixel preservation. */
  preservationMask: Uint8Array;
  report: ShadowQaReport;
}

interface ShadowComponent {
  pixels: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  contactPixelCount: number;
  contactDeltaTotal: number;
  lowerPixelCount: number;
  lowerDeltaTotal: number;
  seeded: boolean;
}

const TARGET = {
  maxContactGapPx: 2 as const,
  rightExtensionRatio: { min: 0.2 as const, max: 0.3 as const },
  contract: "contact-back-right-v1" as const,
};

function luma(color: ShadowQaRgb): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function emptyReport(status: ShadowQaStatus, warnings: string[] = []): ShadowQaReport {
  return {
    status,
    failures: [],
    warnings,
    contacts: [],
    measurements: {
      contactGapPx: null,
      contactCoreDensity: null,
      rightExtensionPx: null,
      rightExtensionRatio: null,
      leftExtensionPx: null,
      verticalDepthPx: null,
      componentCount: 0,
      shadowPixelCount: 0,
    },
    target: TARGET,
  };
}

/**
 * Analyze the narrow, model-owned shadow lane beneath a product. The lane is
 * intentionally small so the result can be used as a preservation mask by
 * downstream post-processing without treating arbitrary scene shading as
 * canonical product detail.
 */
function analyzeSingleModelOwnedShadow(
  input: AnalyzeModelOwnedShadowInput,
): ModelShadowAnalysis {
  const width = Math.floor(input.width);
  const height = Math.floor(input.height);
  const preservationMask = new Uint8Array(
    width > 0 && height > 0 ? width * height : 0,
  );
  const candidateMask = new Uint8Array(preservationMask.length);

  if (
    width <= 0 ||
    height <= 0 ||
    !input.pixels ||
    input.pixels.length < width * height * 4 ||
    !(input.productBounds ?? input.objectBounds) ||
    !Number.isFinite(input.baselineYPx)
  ) {
    const report = emptyReport("review", [
      "No reliable model-owned shadow candidate could be analyzed.",
    ]);
    return { candidateMask, preservationMask, report };
  }

  const suppliedBounds = input.productBounds ?? input.objectBounds;
  const bounds = {
    left: clampInt(suppliedBounds!.left ?? 0, 0, width - 1),
    right: clampInt(suppliedBounds!.right ?? width - 1, 0, width - 1),
    top: clampInt(suppliedBounds!.top, 0, height - 1),
    bottom: clampInt(suppliedBounds!.bottom, 0, height - 1),
  };
  if (bounds.left > bounds.right || bounds.top > bounds.bottom) {
    const report = emptyReport("review", [
      "No reliable model-owned shadow candidate could be analyzed.",
    ]);
    return { candidateMask, preservationMask, report };
  }

  const baselineYPx = clampInt(input.baselineYPx, 0, height - 1);
  const productWidth = bounds.right - bounds.left + 1;
  const laneLeft = Math.max(0, Math.floor(bounds.left - productWidth * 0.1));
  const laneRight = Math.min(
    width - 1,
    Math.ceil(bounds.right + productWidth * 0.35),
  );
  const laneTop = Math.max(0, baselineYPx - 2);
  const laneBottom = Math.min(
    height - 1,
    baselineYPx + Math.max(12, Math.round(height * 0.035)),
  );
  const backgroundLuma = luma(input.background);
  const candidate = new Uint8Array(width * height);

  for (let y = laneTop; y <= laneBottom; y += 1) {
    for (let x = laneLeft; x <= laneRight; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = input.pixels[pixelIndex + 3] ?? 0;
      const pixelLuma = luma({
        r: input.pixels[pixelIndex] ?? 0,
        g: input.pixels[pixelIndex + 1] ?? 0,
        b: input.pixels[pixelIndex + 2] ?? 0,
      });
      const lumaDelta = backgroundLuma - pixelLuma;
      const outsideProduct =
        y > bounds.bottom || x < bounds.left || x > bounds.right;
      if (outsideProduct && alpha > 8 && lumaDelta >= 4) {
        candidate[y * width + x] = 1;
        candidateMask[y * width + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const components: ShadowComponent[] = [];
  const neighborOffsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  const pixelDelta = (index: number): number => {
    const pixelIndex = index * 4;
    return Math.max(
      0,
      backgroundLuma -
        luma({
          r: input.pixels[pixelIndex] ?? 0,
          g: input.pixels[pixelIndex + 1] ?? 0,
          b: input.pixels[pixelIndex + 2] ?? 0,
        }),
    );
  };

  for (let y = laneTop; y <= laneBottom; y += 1) {
    for (let x = laneLeft; x <= laneRight; x += 1) {
      const startIndex = y * width + x;
      if (candidate[startIndex] === 0 || visited[startIndex] === 1) continue;

      const stack = [startIndex];
      const componentPixels: number[] = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let contactPixelCount = 0;
      let contactDeltaTotal = 0;
      let lowerPixelCount = 0;
      let lowerDeltaTotal = 0;
      let seeded = false;

      visited[startIndex] = 1;
      while (stack.length > 0) {
        const index = stack.pop() as number;
        const currentX = index % width;
        const currentY = Math.floor(index / width);
        const delta = pixelDelta(index);
        componentPixels.push(index);
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);
        if (
          currentY <= baselineYPx + 2 &&
          currentX >= bounds.left - 2 &&
          currentX <= bounds.right + 2
        ) {
          seeded = true;
        }
        if (currentY > baselineYPx && currentY <= baselineYPx + 2) {
          contactPixelCount += 1;
          contactDeltaTotal += delta;
        } else if (currentY > baselineYPx + 2) {
          lowerPixelCount += 1;
          lowerDeltaTotal += delta;
        }

        for (const [offsetX, offsetY] of neighborOffsets) {
          const nextX = currentX + offsetX;
          const nextY = currentY + offsetY;
          if (
            nextX < laneLeft ||
            nextX > laneRight ||
            nextY < laneTop ||
            nextY > laneBottom
          ) {
            continue;
          }
          const nextIndex = nextY * width + nextX;
          if (candidate[nextIndex] === 1 && visited[nextIndex] === 0) {
            visited[nextIndex] = 1;
            stack.push(nextIndex);
          }
        }
      }

      components.push({
        pixels: componentPixels,
        minX,
        maxX,
        minY,
        maxY,
        contactPixelCount,
        contactDeltaTotal,
        lowerPixelCount,
        lowerDeltaTotal,
        seeded,
      });
    }
  }

  // Even when the main lane has no connected component, continue scanning the
  // lower continuation. A detached/overlong candidate must still be removed
  // from geometry analysis; only the preservation mask remains empty/review.
  let continuationCandidateMaxY = -1;
  for (let y = laneBottom + 1; y < height; y += 1) {
    for (let x = laneLeft; x <= laneRight; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = input.pixels[pixelIndex + 3] ?? 0;
      const delta = backgroundLuma -
        luma({
          r: input.pixels[pixelIndex] ?? 0,
          g: input.pixels[pixelIndex + 1] ?? 0,
          b: input.pixels[pixelIndex + 2] ?? 0,
        });
      const outsideProduct =
        y > bounds.bottom || x < bounds.left || x > bounds.right;
      if (outsideProduct && alpha > 8 && delta >= 4) {
        candidateMask[y * width + x] = 1;
        continuationCandidateMaxY = y;
      }
    }
  }

  if (components.length === 0) {
    const report = emptyReport("review", [
      "No reliable model-owned shadow candidate could be analyzed.",
    ]);
    return { candidateMask, preservationMask, report };
  }

  const largest = (items: ShadowComponent[]): ShadowComponent =>
    items.reduce((best, component) =>
      component.pixels.length > best.pixels.length ? component : best,
    );
  const seededComponents = components.filter((component) => component.seeded);
  const retained = seededComponents.length > 0 ? largest(seededComponents) : null;
  const representative = retained ?? largest(components);
  for (const index of retained?.pixels ?? []) preservationMask[index] = 1;

  // The candidate lane is bounded by design. Inspect its immediate continuation
  // to ensure a shadow that continues well past the depth contract is rejected.
  // The retained preservation mask intentionally remains limited to the
  // largest seeded component, but an overlong tail or floor seam is already
  // represented in candidateMask and must never inflate geometry metrics.
  const continuationMaxY = Math.max(representative.maxY, continuationCandidateMaxY);

  const contactGapPx = Math.max(0, representative.minY - baselineYPx - 1);
  const contactCoreDensity =
    representative.contactPixelCount > 0
      ? Math.min(
          1,
          representative.contactPixelCount /
            (Math.max(1, productWidth) * 2),
        )
      : null;
  const rightExtensionPx = Math.max(0, representative.maxX - bounds.right);
  const rightExtensionRatio = rightExtensionPx / Math.max(1, productWidth);
  const leftExtensionPx = Math.max(0, bounds.left - representative.minX);
  const verticalDepthPx = Math.max(0, continuationMaxY - baselineYPx);
  const lowerAverage =
    representative.lowerPixelCount > 0
      ? representative.lowerDeltaTotal / representative.lowerPixelCount
      : null;
  const contactAverage =
    representative.contactPixelCount > 0
      ? representative.contactDeltaTotal / representative.contactPixelCount
      : null;

  const failures: string[] = [];
  const warnings: string[] = [];
  if (contactGapPx > TARGET.maxContactGapPx) {
    failures.push(`Shadow contact gap is ${contactGapPx}px (maximum ${TARGET.maxContactGapPx}px).`);
  }
  if (components.length > 1) {
    failures.push(`Multiple connected shadow components detected (${components.length}).`);
  }
  if (seededComponents.length === 0) {
    warnings.push("Shadow candidate is not reliably connected to the product baseline.");
  }
  if (rightExtensionRatio > 0.32) {
    failures.push(
      `Shadow right extension ratio ${rightExtensionRatio.toFixed(3)} exceeds 0.32.`,
    );
  } else if (
    (rightExtensionRatio >= 0.18 && rightExtensionRatio <= 0.2) ||
    (rightExtensionRatio >= 0.3 && rightExtensionRatio <= 0.32)
  ) {
    warnings.push(
      `Shadow right extension ratio ${rightExtensionRatio.toFixed(3)} is near the target boundary.`,
    );
  } else if (rightExtensionRatio < 0.18) {
    warnings.push(
      `Shadow right extension ratio ${rightExtensionRatio.toFixed(3)} is below the target zone.`,
    );
  }
  if (leftExtensionPx / Math.max(1, productWidth) > 0.12) {
    failures.push("Shadow left extension exceeds the 0.12 product-width limit.");
  }
  if (verticalDepthPx > height * 0.035) {
    failures.push(
      `Shadow vertical depth ${verticalDepthPx}px exceeds ${Math.round(height * 0.035)}px.`,
    );
  }
  if (
    lowerAverage != null &&
    contactAverage != null &&
    lowerAverage > contactAverage + 1
  ) {
    failures.push("Lower shadow feather is darker than the contact band.");
  }

  const status: ShadowQaStatus =
    failures.length > 0 ? "fail" : seededComponents.length === 0 ? "review" : "pass";
  const report: ShadowQaReport = {
    status,
    failures,
    warnings,
    contacts: [],
    measurements: {
      contactGapPx,
      contactCoreDensity,
      rightExtensionPx,
      rightExtensionRatio,
      leftExtensionPx,
      verticalDepthPx,
      componentCount: components.length,
      shadowPixelCount: components.reduce(
        (total, component) => total + component.pixels.length,
        0,
      ),
    },
    target: TARGET,
  };
  return { candidateMask, preservationMask, report };
}

function emptyMeasurements(): ShadowQaReport["measurements"] {
  return {
    contactGapPx: null,
    contactCoreDensity: null,
    rightExtensionPx: null,
    rightExtensionRatio: null,
    leftExtensionPx: null,
    verticalDepthPx: null,
    componentCount: 0,
    shadowPixelCount: 0,
  };
}

export function analyzeModelOwnedShadow(
  input: AnalyzeModelOwnedShadowInput,
): ModelShadowAnalysis {
  const expectedContacts = input.topology?.expectedContacts ?? ["bottle"];
  const analyses: Array<{
    contact: import("../bestBottlesShadowTopology").BestBottlesShadowContact;
    bounds: ShadowQaBounds | null;
    analysis: ModelShadowAnalysis | null;
  }> = expectedContacts.map((contact) => {
    const supplied =
      input.contactBounds?.[contact] ??
      (contact === "bottle" ? input.productBounds ?? input.objectBounds : undefined);
    const bounds = supplied
      ? {
          left: supplied.left ?? 0,
          right: supplied.right ?? input.width - 1,
          top: supplied.top,
          bottom: supplied.bottom,
        }
      : null;
    return {
      contact,
      bounds,
      analysis: bounds
        ? analyzeSingleModelOwnedShadow({
            ...input,
            topology: undefined,
            contactBounds: undefined,
            productBounds: bounds,
            objectBounds: undefined,
          })
        : null,
    };
  });

  const maskLength = Math.max(0, Math.floor(input.width) * Math.floor(input.height));
  const candidateMask = new Uint8Array(maskLength);
  const preservationMask = new Uint8Array(maskLength);
  for (const { analysis } of analyses) {
    if (!analysis) continue;
    for (let index = 0; index < maskLength; index += 1) {
      if (analysis.candidateMask[index]) candidateMask[index] = 1;
      if (analysis.preservationMask[index]) preservationMask[index] = 1;
    }
  }

  const contacts: ShadowContactQa[] = analyses.map(({ contact, bounds, analysis }) => ({
    contact,
    status: analysis?.report.status ?? "fail",
    bounds,
    measurements: analysis?.report.measurements ?? emptyMeasurements(),
    failures: analysis
      ? [...analysis.report.failures]
      : [`${contact} contact bounds are missing.`],
    warnings: analysis ? [...analysis.report.warnings] : [],
  }));
  const isMultiContact = expectedContacts.length > 1;
  const failures = contacts.flatMap((contact) => {
    if (contact.status === "pass") return [];
    const details =
      contact.failures.length > 0
        ? contact.failures
        : [`${contact.contact} shadow contact did not pass (${contact.status}).`];
    return details.map((failure) => `${contact.contact}: ${failure}`);
  });
  const warnings = contacts.flatMap((contact) =>
    contact.warnings.map((warning) => `${contact.contact}: ${warning}`),
  );
  const primaryReport = analyses[0]?.analysis?.report;
  const measurements = {
    ...(primaryReport?.measurements ?? emptyMeasurements()),
    componentCount: contacts.reduce(
      (total, contact) => total + contact.measurements.componentCount,
      0,
    ),
    shadowPixelCount: contacts.reduce(
      (total, contact) => total + contact.measurements.shadowPixelCount,
      0,
    ),
  };
  const status: ShadowQaStatus = isMultiContact
    ? contacts.every((contact) => contact.status === "pass")
      ? "pass"
      : "fail"
    : primaryReport?.status ?? "review";

  return {
    candidateMask,
    preservationMask,
    report: {
      status,
      failures: isMultiContact ? failures : primaryReport?.failures ?? failures,
      warnings: isMultiContact ? warnings : primaryReport?.warnings ?? warnings,
      contacts,
      measurements,
      target: TARGET,
    },
  };
}
