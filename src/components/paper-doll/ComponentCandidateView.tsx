import { CheckCircle2, GitCompare, ShieldAlert } from "lucide-react";

import type { ComponentWorkbenchRow } from "@/lib/paperDoll/componentWorkbenchModel";
import { componentSourceUrl, releaseAssetUrl } from "./componentWorkbenchAssets";
import type { PaperDollReleaseAsset } from "@/lib/paperDoll/releaseContract";

interface ComponentCandidateViewProps {
  row: ComponentWorkbenchRow | null;
  releaseAsset: PaperDollReleaseAsset | null;
  assetUrlsByPath: Readonly<Record<string, string>>;
}

export function ComponentCandidateView({ row, releaseAsset, assetUrlsByPath }: ComponentCandidateViewProps) {
  if (!row) return <div className="pdw-no-results">Select a component to review a candidate.</div>;
  const sourceUrl = componentSourceUrl(row.source.path);
  const candidateUrl = releaseAssetUrl(releaseAsset?.imagePath, assetUrlsByPath) ?? sourceUrl;
  const qa = row.candidate?.qa;
  return (
    <div className="pdw-lifecycle-view">
      <header className="pdw-view-heading"><div><span className="pdw-kicker">Pixel evidence before family placement</span><h3>Candidate Review · {row.variantKey}</h3><p>Generated framing is advisory. Exact authority-mask alpha is the only geometry lock.</p></div></header>
      <div className="pdw-review-triptych">
        {[['Release source', sourceUrl], ['Candidate', candidateUrl], ['Difference', null]].map(([label, url]) => (
          <section key={label}><span>{label}</span><div>{url ? <img src={url} alt="" /> : <GitCompare aria-label="Difference preview pending" />}</div></section>
        ))}
      </div>
      <div className="pdw-review-evidence">
        <section><div className="pdw-panel-label">Provenance</div><dl className="pdw-fact-list"><div><dt>Provider</dt><dd>{row.candidate?.provider ?? "No persisted candidate"}</dd></div><div><dt>Model</dt><dd>{row.candidate?.model ?? "—"}</dd></div><div><dt>Original file</dt><dd>{row.candidate?.source.originalFilename ?? row.source.originalFilename}</dd></div><div><dt>Candidate SHA</dt><dd className="pdw-mono">{row.candidate?.normalizedCandidateSha256 ?? "—"}</dd></div></dl></section>
        <section className={qa?.geometryLocked ? "pdw-qa-card pdw-qa-card--pass" : "pdw-qa-card"}>{qa?.geometryLocked ? <CheckCircle2 /> : <ShieldAlert />}<div><strong>{qa?.geometryLocked ? "Exact geometry verified" : "Geometry lock not earned"}</strong><span>IoU {qa ? qa.minIoU.toFixed(4) : "—"} · mismatched alpha pixels {qa?.mismatchedPixels ?? "—"}</span></div></section>
      </div>
    </div>
  );
}
