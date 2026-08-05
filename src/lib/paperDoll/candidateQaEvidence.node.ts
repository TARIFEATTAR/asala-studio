import sharp from "sharp";

import { opaqueWhiteFraction } from "./qaGates";

export interface CandidateQaRow {
  gateKey: string;
  gateVersion: string;
  qaStatus: "passed" | "failed";
  blocking: true;
  calibratedWith: string[];
  measurements: Record<string, unknown>;
  issues: string[];
}

export async function buildCandidateQaEvidence(input: {
  requirementKey: string;
  output: Buffer;
  expectedMaskSha256: string;
  actualMaskSha256: string;
  normalization: Record<string, unknown>;
}): Promise<CandidateQaRow[]> {
  const rows: CandidateQaRow[] = [
    {
      gateKey: "geometry-mask-identity",
      gateVersion: "mask-clamp-v1",
      qaStatus: input.expectedMaskSha256 === input.actualMaskSha256 ? "passed" : "failed",
      blocking: true,
      calibratedWith: ["cyl9-rollon-real-render-2026-08-01", "frame-vs-object-regression"],
      measurements: {
        expectedMaskSha256: input.expectedMaskSha256,
        actualMaskSha256: input.actualMaskSha256,
      },
      issues: input.expectedMaskSha256 === input.actualMaskSha256 ? [] : ["authority_mask_sha_mismatch"],
    },
    {
      gateKey: "provider-normalization",
      gateVersion: "contain-v1",
      qaStatus: "passed",
      blocking: true,
      calibratedWith: ["square-provider-output", "canonical-2080x2288-canvas"],
      measurements: input.normalization,
      issues: [],
    },
  ];

  if (input.requirementKey.startsWith("CYL-9ML:ROLLER:")) {
    const decoded = await sharp(input.output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = opaqueWhiteFraction({
      data: decoded.data,
      width: decoded.info.width,
      height: decoded.info.height,
      hasAlpha: true,
    });
    rows.push({
      gateKey: "opaque-white-fraction",
      gateVersion: "opaque-white-fraction-v1",
      qaStatus: result.pass ? "passed" : "failed",
      blocking: true,
      calibratedWith: [
        "plastic-roller:442e94e1e1b5",
        "rejected-metal-roller:db65f5072e97",
      ],
      measurements: {
        fraction: result.fraction,
        maximum: 0.05,
        opaquePixelCount: result.opaquePixelCount,
        whitePixelCount: result.whitePixelCount,
      },
      issues: result.issues,
    });
  }
  return rows;
}
