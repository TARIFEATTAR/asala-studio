import { useMemo, useState } from "react";
import { CloudUpload, Code2, Globe2, ShieldCheck } from "lucide-react";

import type { PaperDollFamilyProductionManifest } from "@/lib/paperDoll/componentPlateContract";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";

interface SanityProjectionViewProps {
  factory: PaperDollFamilyProductionManifest;
  release: PaperDollReleaseManifest;
  manifestSha256: string;
}

export function SanityProjectionView({ factory, release, manifestSha256 }: SanityProjectionViewProps) {
  const [approvedByName, setApprovedByName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const documentId = factory.releaseTarget.sanityDocumentId.replace(/^drafts\./, "");
  const payload = useMemo(() => ({
    _id: `drafts.${documentId}`,
    _type: "paperDollFamily",
    familyKey: release.familyKey,
    releaseVersion: release.releaseVersion,
    manifestSha256,
    canvas: release.canvas,
    assets: release.assets.map((asset) => ({ slot: asset.slot, variantKey: asset.variantKey, componentVersionId: asset.componentVersionId, imageSha256: asset.imageSha256 })),
    blockers: release.blockers,
  }), [documentId, manifestSha256, release]);
  const named = approvedByName.trim() && approvalNote.trim();

  return (
    <div className="pdw-lifecycle-view">
      <header className="pdw-view-heading"><div><span className="pdw-kicker">Best Bottles CMS · production dataset</span><h3>Sanity Projection</h3><p>Draft and public publication are separate named actions against the same immutable release cut.</p></div><div className="pdw-zero-write"><ShieldCheck /><span>Preview only</span><b>0 writes</b></div></header>
      <div className="pdw-publish-layout">
        <section className="pdw-projection-panel"><div className="pdw-panel-label"><Code2 /> Deterministic draft payload</div><dl className="pdw-projection-facts"><div><dt>Target</dt><dd>drafts.{documentId}</dd></div><div><dt>Public ID</dt><dd>{documentId}</dd></div><div><dt>Assets</dt><dd>{release.assets.length}</dd></div><div><dt>Revision</dt><dd>Returned after successful sync</dd></div></dl><details className="pdw-payload-preview" open><summary>Dry-run JSON</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details></section>
        <aside className="pdw-gates-panel"><div className="pdw-panel-label"><CloudUpload /> Asset plan</div><ul className="pdw-sanity-assets">{release.assets.map((asset) => <li key={`${asset.slot}:${asset.variantKey}`}><span>{asset.slot}:{asset.variantKey}</span><code>{asset.imageSha256.slice(0, 12)}…</code></li>)}</ul></aside>
      </div>
      <div className="pdw-named-action-panel"><label className="pdw-field"><span>Named approver</span><input value={approvedByName} onChange={(event) => setApprovedByName(event.target.value)} placeholder="Full name" /></label><label className="pdw-field"><span>Approval note</span><input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Release scope reviewed" /></label><label className="pdw-scope-confirm"><input type="checkbox" checked={scopeConfirmed} onChange={(event) => setScopeConfirmed(event.target.checked)} /><span>Downstream catalog safely handles this exact release scope</span></label><div className="pdw-lifecycle-actions"><button disabled={!named}><CloudUpload />Sync Draft</button><button disabled={!named || !scopeConfirmed}><Globe2 />Publish Publicly</button></div></div>
    </div>
  );
}
