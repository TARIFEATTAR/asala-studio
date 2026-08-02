export interface FilledHoverTwinPixelPlane {
  width: number;
  height: number;
  rgba: Uint8ClampedArray | Uint8Array;
}

export type FilledHoverTwinQaFailure =
  | "dimension_mismatch"
  | "invalid_pixel_plane"
  | "empty_edit_mask"
  | "outside_mask_pixels_changed"
  | "no_liquid_change_detected"
  | "fill_level_out_of_range"
  | "meniscus_not_detected";

export interface FilledHoverTwinQaResult {
  status: "pass" | "fail";
  failures: FilledHoverTwinQaFailure[];
  observed: {
    width: number;
    height: number;
    editablePixels: number;
    changedInsideMaskPixels: number;
    outsideMaskChangedPixels: number;
    fillPercent: number | null;
    meniscusDetected: boolean;
  };
}

export interface EvaluateFilledHoverTwinQaInput {
  parent: FilledHoverTwinPixelPlane;
  child: FilledHoverTwinPixelPlane;
  mask: FilledHoverTwinPixelPlane;
  targetFillPercent: number;
  fillTolerancePercent?: number;
  outsideMaskCodecTolerance?: number;
  insideChangeThreshold?: number;
}

function hasValidPixels(plane: FilledHoverTwinPixelPlane): boolean {
  return Number.isInteger(plane.width) &&
    Number.isInteger(plane.height) &&
    plane.width > 0 &&
    plane.height > 0 &&
    plane.rgba.length === plane.width * plane.height * 4;
}

function maxChannelDelta(
  a: Uint8ClampedArray | Uint8Array,
  b: Uint8ClampedArray | Uint8Array,
  offset: number,
): number {
  return Math.max(
    Math.abs(a[offset] - b[offset]),
    Math.abs(a[offset + 1] - b[offset + 1]),
    Math.abs(a[offset + 2] - b[offset + 2]),
    Math.abs(a[offset + 3] - b[offset + 3]),
  );
}

export function evaluateFilledHoverTwinQa(
  input: EvaluateFilledHoverTwinQaInput,
): FilledHoverTwinQaResult {
  const failures: FilledHoverTwinQaFailure[] = [];
  const observed: FilledHoverTwinQaResult["observed"] = {
    width: input.child.width,
    height: input.child.height,
    editablePixels: 0,
    changedInsideMaskPixels: 0,
    outsideMaskChangedPixels: 0,
    fillPercent: null,
    meniscusDetected: false,
  };

  if (
    input.parent.width !== input.child.width ||
    input.parent.height !== input.child.height ||
    input.parent.width !== input.mask.width ||
    input.parent.height !== input.mask.height
  ) {
    failures.push("dimension_mismatch");
    return { status: "fail", failures, observed };
  }
  if (![input.parent, input.child, input.mask].every(hasValidPixels)) {
    failures.push("invalid_pixel_plane");
    return { status: "fail", failures, observed };
  }

  const width = input.parent.width;
  const height = input.parent.height;
  const outsideTolerance = input.outsideMaskCodecTolerance ?? 3;
  const insideThreshold = input.insideChangeThreshold ?? 12;
  let cavityTop = height;
  let cavityBottom = -1;
  let changedTop = height;
  const editableByRow = new Uint32Array(height);
  const changedByRow = new Uint32Array(height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      // OpenAI edit masks use transparent pixels as the editable region.
      const editable = input.mask.rgba[offset + 3] < 128;
      const delta = maxChannelDelta(input.parent.rgba, input.child.rgba, offset);
      if (!editable) {
        if (delta > outsideTolerance) observed.outsideMaskChangedPixels += 1;
        continue;
      }

      observed.editablePixels += 1;
      editableByRow[y] += 1;
      cavityTop = Math.min(cavityTop, y);
      cavityBottom = Math.max(cavityBottom, y);
      if (delta > insideThreshold) {
        observed.changedInsideMaskPixels += 1;
        changedByRow[y] += 1;
        changedTop = Math.min(changedTop, y);
      }
    }
  }

  if (observed.editablePixels === 0 || cavityBottom < cavityTop) {
    failures.push("empty_edit_mask");
  }
  if (observed.outsideMaskChangedPixels > 0) {
    failures.push("outside_mask_pixels_changed");
  }
  if (observed.changedInsideMaskPixels === 0 || changedTop === height) {
    failures.push("no_liquid_change_detected");
  } else {
    const cavityHeight = cavityBottom - cavityTop + 1;
    observed.fillPercent = Math.round(
      ((cavityBottom - changedTop + 1) / cavityHeight) * 1000,
    ) / 10;
    const fillTolerance = input.fillTolerancePercent ?? 3;
    if (Math.abs(observed.fillPercent - input.targetFillPercent) > fillTolerance) {
      failures.push("fill_level_out_of_range");
    }

    const topRowCoverage = editableByRow[changedTop] > 0
      ? changedByRow[changedTop] / editableByRow[changedTop]
      : 0;
    const rowAboveIsClear = changedTop === cavityTop || changedByRow[changedTop - 1] === 0;
    observed.meniscusDetected = topRowCoverage >= 0.5 && rowAboveIsClear;
    if (!observed.meniscusDetected) failures.push("meniscus_not_detected");
  }

  return {
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    observed,
  };
}
