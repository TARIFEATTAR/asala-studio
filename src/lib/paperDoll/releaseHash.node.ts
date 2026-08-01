import { createHash } from "node:crypto";

import {
  canonicalizeReleaseValue,
  type PaperDollReleaseManifest,
} from "./releaseContract";

export function hashPaperDollRelease(manifest: PaperDollReleaseManifest): string {
  return createHash("sha256")
    .update(canonicalizeReleaseValue(manifest))
    .digest("hex");
}
