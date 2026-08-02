import { useEffect, useState } from "react";
import { Braces, Database, FileCheck2, LockKeyhole, ShieldAlert, UploadCloud } from "lucide-react";

import type { Product } from "@/integrations/convex/bestBottles";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import { buildPaperDollSanityProjection, type PaperDollSanityProjection } from "@/lib/paperDoll/sanityProjection";
import { buildMatrixModel } from "./matrixModel";
import { buildPublishPreviewModel } from "./publishPreviewModel";
import { ReleaseGateSummary } from "./ReleaseGateSummary";

interface PublishPreviewViewProps {
  manifest: PaperDollReleaseManifest;
  catalogProducts: Product[];
}

export function PublishPreviewView({ manifest, catalogProducts }: PublishPreviewViewProps) {
  const [projection, setProjection] = useState<PaperDollSanityProjection | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    buildPaperDollSanityProjection(manifest)
      .then((result) => { if (active) setProjection(result); })
      .catch((error) => { if (active) setProjectionError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; };
  }, [manifest]);

  if (projectionError) {
    return <div className="pdw-view-error"><ShieldAlert /><div><strong>Sanity projection failed</strong><span>{projectionError}</span></div></div>;
  }
  if (!projection) {
    return <div className="pdw-projection-loading"><Braces /><span>Computing canonical projection hashes…</span></div>;
  }

  const matrix = buildMatrixModel(manifest, catalogProducts);
  const model = buildPublishPreviewModel({
    manifest,
    projection,
    catalogReconciliation: matrix.catalogReconciliation,
    lineupReady: false,
  });

  return (
    <div className="pdw-publish-view">
      <div className="pdw-view-heading">
        <div>
          <span className="pdw-kicker">Release decision</span>
          <h3>QA & Sanity projection</h3>
          <p>Projection is inspectable while blocked. It uploads nothing and patches nothing.</p>
        </div>
        <div className="pdw-zero-write"><LockKeyhole /><span><b>{model.writeCount}</b> writes performed</span></div>
      </div>

      <div className="pdw-publish-layout">
        <section className="pdw-gates-panel">
          <div className="pdw-panel-label"><FileCheck2 /> Final QA sequence</div>
          <ReleaseGateSummary phases={model.phases} />
        </section>

        <aside className="pdw-projection-panel">
          <div className="pdw-panel-label"><Database /> Sanity destination</div>
          <dl className="pdw-projection-facts">
            <div><dt>Project</dt><dd>{model.target.projectId}</dd></div>
            <div><dt>Dataset</dt><dd>{model.target.dataset}</dd></div>
            <div><dt>Document</dt><dd>{model.target.documentId}</dd></div>
            <div><dt>Type</dt><dd>{model.target.documentType}</dd></div>
          </dl>
          <div className="pdw-hash-block"><span>Manifest SHA-256</span><code>{model.manifestSha256}</code></div>
          <div className="pdw-hash-block"><span>Payload SHA-256</span><code>{model.payloadSha256}</code></div>

          <div className="pdw-projection-metrics">
            <div><span>Round trip</span><b className={model.roundTripPassed ? "pdw-text-pass" : "pdw-text-blocked"}>{model.roundTripPassed ? "PASS" : "BLOCKED"}</b></div>
            <div><span>Field additions</span><b>{model.diff.additions}</b></div>
            <div><span>Changes / removals</span><b>{model.diff.changes} / {model.diff.removals}</b></div>
            <div><span>Unresolved assets</span><b>{model.assetPlan.unresolved}</b></div>
          </div>

          <div className="pdw-key-summary">
            <span>Stable array keys</span>
            <div><b>{model.stableKeys.assets}</b> assets</div><div><b>{model.stableKeys.recipes}</b> recipes</div><div><b>{model.stableKeys.mappings}</b> mappings</div><div><b>{model.stableKeys.evidence}</b> evidence</div>
          </div>

          <details className="pdw-payload-preview">
            <summary><Braces /> Inspect projected document</summary>
            <pre>{JSON.stringify(projection.document, null, 2)}</pre>
          </details>
        </aside>
      </div>

      <section className="pdw-publish-actions">
        <div>
          <span>Named approval</span>
          <strong>Unavailable</strong>
          <p>Requires a ready release, exact catalog mappings, complete lineup evidence, and a configured target.</p>
          <button type="button" disabled><FileCheck2 /> Record named approval</button>
        </div>
        <div>
          <span>Live publication</span>
          <strong>Unavailable</strong>
          <p>Requires matching named approval plus a server-issued, single-use authorization.</p>
          <button type="button" disabled><UploadCloud /> Publish to Sanity</button>
        </div>
        <div className="pdw-blocker-stack">
          <span>Current blockers</span>
          <div>{model.blockers.map((blocker) => <code key={blocker}>{blocker}</code>)}</div>
        </div>
      </section>
    </div>
  );
}
