/**
 * Geometry-only proof that a detached right-sidecar component exists and rests
 * on the same floor as the primary bottle. This deliberately records no cap
 * bounding box and applies no cap centerline requirement.
 */

export interface DetachedSidecarLaneBounds {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

export interface DetachedSidecarLaneFloorInput {
  pixels: ArrayLike<number>;
  width: number;
  height: number;
  background: { r: number; g: number; b: number };
  primaryBounds: DetachedSidecarLaneBounds | null;
  groupBounds: DetachedSidecarLaneBounds | null;
  primaryBaselineYPx: number | null;
  sharedGroupBaselineYPx: number | null;
  baselineTolerancePx?: number;
}

export interface DetachedSidecarLaneFloorQa {
  policy: "distinct-right-sidecar-lane-shared-floor-no-cap-box";
  status: "pass" | "fail";
  sidecarPresent: boolean;
  sidecarLaneStartXPx: number | null;
  sidecarLaneEndXPx: number | null;
  sidecarForegroundPixelCount: number;
  sidecarOccupiedRowCount: number;
  sidecarVerticalSpanPx: number | null;
  sidecarLowestContactRowYPx: number | null;
  primaryBaselineYPx: number | null;
  sharedGroupBaselineYPx: number | null;
  sidecarPrimaryBaselineDeltaPx: number | null;
  sidecarGroupBaselineDeltaPx: number | null;
  baselineTolerancePx: number;
  capBoundingBoxUsed: false;
  capCenterlineRequired: false;
  failures: string[];
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isForeground(
  pixels: ArrayLike<number>,
  index: number,
  background: DetachedSidecarLaneFloorInput["background"],
): boolean {
  const alpha = Number(pixels[index + 3] ?? 255);
  if (alpha < 200) return true;
  const red = Number(pixels[index] ?? background.r);
  const green = Number(pixels[index + 1] ?? background.g);
  const blue = Number(pixels[index + 2] ?? background.b);
  const distance = Math.abs(red - background.r)
    + Math.abs(green - background.g)
    + Math.abs(blue - background.b);
  const paleForeground = distance >= 16
    && red >= background.r
    && green >= background.g
    && blue >= background.b;
  return distance >= 52 || paleForeground;
}

export function analyzeDetachedSidecarLaneFloor(
  input: DetachedSidecarLaneFloorInput,
): DetachedSidecarLaneFloorQa {
  const tolerance = input.baselineTolerancePx ?? 8;
  const failures: string[] = [];
  const primary = input.primaryBounds;
  const group = input.groupBounds;
  const validCanvas = Number.isInteger(input.width)
    && input.width > 0
    && Number.isInteger(input.height)
    && input.height > 0
    && input.pixels.length >= input.width * input.height * 4;
  if (!validCanvas) failures.push("Detached sidecar lane requires complete RGBA canvas pixels.");

  const validPrimary = Boolean(
    primary
    && finite(primary.top)
    && finite(primary.bottom)
    && finite(primary.left)
    && finite(primary.right),
  );
  const validGroup = Boolean(
    group
    && finite(group.top)
    && finite(group.bottom)
    && finite(group.left)
    && finite(group.right),
  );
  if (!validPrimary) failures.push("Detached primary bottle bounds are required for right sidecar lane QA.");
  if (!validGroup) failures.push("Detached complete group bounds are required for right sidecar lane QA.");

  let laneStart: number | null = null;
  let laneEnd: number | null = null;
  let foregroundPixels = 0;
  let occupiedRows = 0;
  let firstOccupiedRow: number | null = null;
  let lastOccupiedRow: number | null = null;

  if (validCanvas && validPrimary && validGroup && primary && group) {
    const separationGap = Math.max(4, Math.round(input.width * 0.01));
    laneStart = Math.max(0, Math.ceil(primary.right as number) + separationGap);
    laneEnd = Math.min(input.width - 1, Math.floor(group.right as number));
    if (laneEnd < laneStart) {
      failures.push("Detached complete group bounds do not establish a distinct right sidecar lane.");
    } else {
      const laneWidth = laneEnd - laneStart + 1;
      const minimumRowHits = Math.max(2, Math.floor(laneWidth * 0.015));
      const scanTop = Math.max(0, Math.floor(group.top));
      const floorCeiling = Math.max(
        finite(input.primaryBaselineYPx) ? input.primaryBaselineYPx : group.bottom,
        finite(input.sharedGroupBaselineYPx) ? input.sharedGroupBaselineYPx : group.bottom,
      );
      const scanBottom = Math.min(input.height - 1, Math.ceil(floorCeiling + tolerance));
      for (let y = scanTop; y <= scanBottom; y += 1) {
        let rowHits = 0;
        for (let x = laneStart; x <= laneEnd; x += 1) {
          if (!isForeground(input.pixels, (y * input.width + x) * 4, input.background)) continue;
          rowHits += 1;
        }
        if (rowHits < minimumRowHits) continue;
        foregroundPixels += rowHits;
        occupiedRows += 1;
        firstOccupiedRow = firstOccupiedRow == null ? y : firstOccupiedRow;
        lastOccupiedRow = y;
      }
    }
  }

  const verticalSpan = firstOccupiedRow != null && lastOccupiedRow != null
    ? lastOccupiedRow - firstOccupiedRow + 1
    : null;
  const minimumVerticalSpan = Math.max(24, Math.round(input.height * 0.04));
  const minimumOccupiedRows = Math.max(12, Math.round(minimumVerticalSpan * 0.5));
  const sidecarPresent = verticalSpan != null
    && verticalSpan >= minimumVerticalSpan
    && occupiedRows >= minimumOccupiedRows;
  if (!sidecarPresent && !failures.some((failure) => /distinct right sidecar lane/i.test(failure))) {
    failures.push("Detached output requires distinct sidecar foreground presence in the right sidecar lane.");
  }

  const primaryDelta = sidecarPresent
    && lastOccupiedRow != null
    && finite(input.primaryBaselineYPx)
    ? lastOccupiedRow - input.primaryBaselineYPx
    : null;
  const groupDelta = sidecarPresent
    && lastOccupiedRow != null
    && finite(input.sharedGroupBaselineYPx)
    ? lastOccupiedRow - input.sharedGroupBaselineYPx
    : null;
  if (sidecarPresent && (primaryDelta == null || Math.abs(primaryDelta) > tolerance)) {
    failures.push("Detached sidecar lowest contact row must be within shared floor tolerance of the primary bottle.");
  }
  if (sidecarPresent && (groupDelta == null || Math.abs(groupDelta) > tolerance)) {
    failures.push("Detached sidecar lowest contact row must be within shared floor tolerance of the complete group.");
  }

  return {
    policy: "distinct-right-sidecar-lane-shared-floor-no-cap-box",
    status: failures.length === 0 ? "pass" : "fail",
    sidecarPresent,
    sidecarLaneStartXPx: laneStart,
    sidecarLaneEndXPx: laneEnd,
    sidecarForegroundPixelCount: foregroundPixels,
    sidecarOccupiedRowCount: occupiedRows,
    sidecarVerticalSpanPx: verticalSpan,
    sidecarLowestContactRowYPx: sidecarPresent ? lastOccupiedRow : null,
    primaryBaselineYPx: input.primaryBaselineYPx,
    sharedGroupBaselineYPx: input.sharedGroupBaselineYPx,
    sidecarPrimaryBaselineDeltaPx: primaryDelta,
    sidecarGroupBaselineDeltaPx: groupDelta,
    baselineTolerancePx: tolerance,
    capBoundingBoxUsed: false,
    capCenterlineRequired: false,
    failures,
  };
}
