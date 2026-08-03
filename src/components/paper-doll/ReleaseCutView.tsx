import { useState } from "react";
import { FileKey2, GitCommitHorizontal, LockKeyhole } from "lucide-react";

import type { ComponentWorkbenchRow } from "@/lib/paperDoll/componentWorkbenchModel";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import type { PaperDollReleaseValidation } from "@/lib/paperDoll/releaseValidator";

interface ReleaseCutViewProps {
  rows: ComponentWorkbenchRow[];
  manifest: PaperDollReleaseManifest;
  validation: PaperDollReleaseValidation;
  manifestSha256: string;
}

export function ReleaseCutView({ rows, manifest, validation, manifestSha256 }: ReleaseCutViewProps) {
  const [approvedByName, setApprovedByName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const selectedRows = rows.filter((row) => row.placementLocked || row.inCurrentRelease);
  const named = approvedByName.trim() && approvalNote.trim();
  return (
    <div className="pdw-lifecycle-view">
      <header className="pdw-view-heading"><div><span className="pdw-kicker">Append-only release snapshot</span><h3>Release Cut</h3><p>A release cut selects immutable body, candidate, and placement versions; it never edits their evidence.</p></div><span className={validation.ready ? "pdw-sync-badge" : "pdw-sync-badge pdw-sync-badge--blocked"}>{validation.ready ? "Validated" : "Blocked"}</span></header>
      <div className="pdw-release-cut-grid">
        <section className="pdw-gates-panel"><div className="pdw-panel-label"><GitCommitHorizontal /> Selected immutable versions</div><div className="pdw-release-asset-list">{manifest.assets.map((asset) => <div key={`${asset.slot}:${asset.variantKey}`}><span>{asset.slot}</span><strong>{asset.variantKey}</strong><code>{asset.componentVersionId}</code><b>{asset.approvalStatus}</b></div>)}</div></section>
        <aside className="pdw-projection-panel"><div className="pdw-panel-label"><FileKey2 /> Cut identity</div><dl className="pdw-projection-facts"><div><dt>Family</dt><dd>{manifest.familyKey}</dd></div><div><dt>Version</dt><dd>{manifest.releaseVersion}</dd></div><div><dt>Assets</dt><dd>{manifest.assets.length} locked · {selectedRows.length} lifecycle-linked</dd></div><div><dt>Manifest SHA</dt><dd>{manifestSha256}</dd></div></dl>{manifest.blockers.length > 0 && <div className="pdw-blocker-stack"><div>{manifest.blockers.map((blocker) => <code key={blocker}>{blocker}</code>)}</div></div>}</aside>
      </div>
      <div className="pdw-named-action-panel"><label className="pdw-field"><span>Named approver</span><input value={approvedByName} onChange={(event) => setApprovedByName(event.target.value)} placeholder="Full name" /></label><label className="pdw-field"><span>Release-cut note</span><input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Scope and evidence reviewed" /></label><button className="pdw-primary-action" disabled={!named || !validation.ready}><LockKeyhole />Cut New Current Release</button></div>
    </div>
  );
}
