export interface ExactAlphaComparison {
  minIoU: number;
  mismatchedPixels: number;
  geometryLocked: boolean;
}

export function copyAuthorityAlpha(
  materialRgba: Uint8Array,
  authorityAlpha: Uint8Array,
): Uint8Array {
  if (materialRgba.length !== authorityAlpha.length * 4) {
    throw new Error("Material RGBA pixel count must match authority alpha pixel count.");
  }

  const output = new Uint8Array(materialRgba.length);
  for (let index = 0; index < authorityAlpha.length; index++) {
    const alpha = authorityAlpha[index];
    if (alpha === 0) continue;
    const offset = index * 4;
    output[offset] = materialRgba[offset];
    output[offset + 1] = materialRgba[offset + 1];
    output[offset + 2] = materialRgba[offset + 2];
    output[offset + 3] = alpha;
  }
  return output;
}

export function compareExactAlphaBytes(
  candidateAlpha: Uint8Array,
  authorityAlpha: Uint8Array,
): ExactAlphaComparison {
  if (candidateAlpha.length !== authorityAlpha.length) {
    throw new Error("Candidate and authority alpha arrays must have the same length.");
  }

  let intersection = 0;
  let union = 0;
  let mismatchedPixels = 0;
  for (let index = 0; index < candidateAlpha.length; index++) {
    const candidateOccupied = candidateAlpha[index] > 0;
    const authorityOccupied = authorityAlpha[index] > 0;
    if (candidateOccupied || authorityOccupied) union++;
    if (candidateOccupied && authorityOccupied) intersection++;
    if (candidateAlpha[index] !== authorityAlpha[index]) mismatchedPixels++;
  }

  const minIoU = union === 0 ? 1 : intersection / union;
  return {
    minIoU,
    mismatchedPixels,
    geometryLocked: minIoU === 1 && mismatchedPixels === 0,
  };
}

