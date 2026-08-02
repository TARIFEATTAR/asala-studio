import { AlertTriangle, Database, LockKeyhole } from "lucide-react";

import { LEDIndicator } from "@/components/darkroom/LEDIndicator";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import type { PaperDollReleaseValidation } from "@/lib/paperDoll/releaseValidator";
import { deriveReleaseLifecycleCounts } from "@/lib/paperDoll/workbenchModel";

interface ReleaseWorkbenchHeaderProps {
  manifest: PaperDollReleaseManifest;
  validation: PaperDollReleaseValidation;
  manifestSha256: string;
}

export function ReleaseWorkbenchHeader({
  manifest,
  validation,
  manifestSha256,
}: ReleaseWorkbenchHeaderProps) {
  const counts = deriveReleaseLifecycleCounts(manifest);
  return (
    <header className="pdw-release-header">
      <div className="pdw-release-identity">
        <div className="pdw-eyebrow">
          <LEDIndicator state={validation.ready ? "ready" : "error"} size="sm" />
          <span>{manifest.familyKey}</span>
          <span className="pdw-separator">/</span>
          <span>17-415 · 70 × 20 mm</span>
        </div>
        <div className="pdw-release-title-row">
          <h2>Paper-Doll Release Bench</h2>
          <span className="pdw-mode-badge"><LockKeyhole aria-hidden="true" /> Release lock</span>
        </div>
        <div className="pdw-release-meta">
          <span>Release {manifest.releaseVersion}</span>
          <span>Schema v{manifest.schemaVersion}</span>
          <span className="pdw-mono" title={manifestSha256}>Manifest {manifestSha256.slice(0, 12)}</span>
        </div>
      </div>

      <div className="pdw-release-readouts" aria-label="Release lifecycle counts">
        <div className="pdw-readout">
          <span>Approved assets</span>
          <strong>{counts.assets.approved}<em>/ {counts.assets.required}</em></strong>
        </div>
        <div className="pdw-readout">
          <span>Assemblies</span>
          <strong>{counts.assemblies.resolvable}<em>/ {counts.assemblies.required}</em></strong>
        </div>
        <div className="pdw-readout pdw-readout--blocked">
          <span>Blocking gates</span>
          <strong>{validation.blockers.length}</strong>
        </div>
        <div className="pdw-readout">
          <span>Published</span>
          <strong>{counts.assets.published}<em>/ {counts.assets.required}</em></strong>
        </div>
      </div>

      <div className="pdw-target-state">
        <div className="pdw-target-icon"><Database aria-hidden="true" /></div>
        <div>
          <span>Sanity target</span>
          <strong>Unconfigured</strong>
        </div>
        {!validation.ready && <AlertTriangle aria-label="Release blocked" />}
      </div>
    </header>
  );
}
