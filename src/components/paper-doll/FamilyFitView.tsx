import { useState } from "react";
import { CheckCircle2, LockKeyhole, Move, ScanLine } from "lucide-react";

import type { ComponentWorkbenchRow } from "@/lib/paperDoll/componentWorkbenchModel";
import type { PaperDollReleaseAsset } from "@/lib/paperDoll/releaseContract";
import type { ReleaseWorkbenchState } from "./releaseWorkbenchState";

interface FamilyFitViewProps {
  row: ComponentWorkbenchRow | null;
  bodies: PaperDollReleaseAsset[];
  componentAsset: PaperDollReleaseAsset | null;
  assetUrlsByPath: Readonly<Record<string, string>>;
  state: ReleaseWorkbenchState;
  onStateChange: (state: ReleaseWorkbenchState) => void;
}

export function FamilyFitView({ row, bodies, componentAsset, assetUrlsByPath, state, onStateChange }: FamilyFitViewProps) {
  const [approvedByName, setApprovedByName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  if (!row) return <div className="pdw-no-results">Select a component before entering Family Fit.</div>;
  const selectedKey = state.bodyVariantKey ?? bodies[0]?.variantKey ?? null;
  const selectedBody = bodies.find((body) => body.variantKey === selectedKey) ?? bodies[0];
  const canNameAction = approvedByName.trim().length > 0 && approvalNote.trim().length > 0;
  const componentUrl = componentAsset ? assetUrlsByPath[componentAsset.imagePath] : null;

  const assembly = (body: PaperDollReleaseAsset, inspection = false) => (
    <div className={inspection ? "pdw-fit-canvas pdw-fit-canvas--inspection" : "pdw-fit-canvas"}>
      <img src={assetUrlsByPath[body.imagePath]} alt={`${body.materialVariant} body`} />
      {componentUrl && <img src={componentUrl} alt={`${row.materialVariant} component`} />}
      <span className="pdw-fit-axis" />
      <span className="pdw-fit-seat" />
      {!componentUrl && <b className="pdw-fit-missing">Component plate not in Current Release</b>}
    </div>
  );

  return (
    <div className="pdw-lifecycle-view">
      <header className="pdw-view-heading"><div><span className="pdw-kicker">Shared placement + five explicit plates</span><h3>Family Fit · {row.variantKey}</h3><p>Calibrate the shared transform, inspect each body, then lock one immutable placement version.</p></div><span className="pdw-sync-badge">{bodies.length}/5 plates loaded</span></header>
      <div className="pdw-family-fit-layout">
        <section>{selectedBody ? assembly(selectedBody, true) : <div className="pdw-no-results">No locked body plate is available.</div>}<div className="pdw-transform-readout"><Move /><span>Shared transform</span><code>{row.candidate?.placementBoundsPx ? `${row.candidate.placementBoundsPx.left}, ${row.candidate.placementBoundsPx.top} · ${row.candidate.placementBoundsPx.width}×${row.candidate.placementBoundsPx.height}` : "Candidate transform not written"}</code></div></section>
        <aside className="pdw-fit-inspector"><div className="pdw-panel-label"><ScanLine /> Inspection plate</div><strong>{selectedBody?.materialVariant ?? "—"}</strong><span>{selectedKey ?? "No body selected"}</span><label className="pdw-field"><span>Override reason (required only for per-body override)</span><textarea placeholder="Shared placement is preferred. Explain any explicit per-body exception." /></label></aside>
      </div>
      <div className="pdw-five-body-lineup">
        {bodies.map((body) => <button type="button" className={selectedKey === body.variantKey ? "pdw-fit-card pdw-fit-card--active" : "pdw-fit-card"} key={body.componentVersionId} onClick={() => onStateChange({ ...state, bodyVariantKey: body.variantKey })}>{assembly(body)}<span>{body.variantKey}</span></button>)}
      </div>
      <div className="pdw-named-action-panel">
        <label className="pdw-field"><span>Named approver</span><input value={approvedByName} onChange={(event) => setApprovedByName(event.target.value)} placeholder="Full name" /></label>
        <label className="pdw-field"><span>Assembly-context approval note</span><input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="What was inspected across all five plates?" /></label>
        <div className="pdw-lifecycle-actions"><button disabled={!canNameAction || row.pixelApproved}><CheckCircle2 />Approve Pixels</button><button disabled={!canNameAction || !row.pixelApproved || row.familyFitApproved}><ScanLine />Family Fit</button><button disabled={!canNameAction || !row.familyFitApproved || row.placementLocked}><LockKeyhole />Lock Shared Placement</button></div>
      </div>
    </div>
  );
}
