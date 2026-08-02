import { useMemo, useState } from "react";
import { AlertTriangle, GitCompareArrows, LockKeyhole } from "lucide-react";

import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import { getGeometryVerification } from "@/lib/paperDoll/workbenchModel";
import { AssemblyCanvas } from "./AssemblyCanvas";
import { buildAssemblyCanvasModel } from "./assemblyCanvasModel";

interface AssemblyViewProps {
  manifest: PaperDollReleaseManifest;
  assetUrlsByPath: Readonly<Record<string, string>>;
}

const INITIAL_MAPPING_KEY = "CYL-9ML:CLR:ROLLON:SHN-SL";

export function AssemblyView({ manifest, assetUrlsByPath }: AssemblyViewProps) {
  const initialMapping = manifest.assemblyMappings.some((item) => item.mappingKey === INITIAL_MAPPING_KEY)
    ? INITIAL_MAPPING_KEY
    : null;
  const [mappingKey, setMappingKey] = useState<string | null>(initialMapping);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const model = useMemo(
    () => mappingKey ? buildAssemblyCanvasModel(manifest, mappingKey, assetUrlsByPath) : null,
    [assetUrlsByPath, manifest, mappingKey],
  );
  const selectedLayer = model?.layers.find((layer) => layer.componentVersionId === selectedLayerId)
    ?? model?.layers.at(-1)
    ?? null;

  if (!model) {
    return (
      <div className="pdw-view-error">
        <AlertTriangle />
        <div><strong>Canonical assembly is missing</strong><span>Expected mapping {INITIAL_MAPPING_KEY}. No fallback asset was selected.</span></div>
      </div>
    );
  }

  return (
    <div className="pdw-assembly-view">
      <div className="pdw-view-heading">
        <div>
          <span className="pdw-kicker">Release assembly</span>
          <h3>Inspect one explicit mapping</h3>
          <p>Coordinates are locked to the manifest. Pan and zoom are visual only.</p>
        </div>
        <label className="pdw-mapping-select">
          <span>Assembly mapping</span>
          <select value={mappingKey ?? ""} onChange={(event) => { setMappingKey(event.target.value); setSelectedLayerId(null); }}>
            {manifest.assemblyMappings.map((mapping) => (
              <option value={mapping.mappingKey} key={mapping.mappingKey}>{mapping.mappingKey}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="pdw-assembly-grid">
        <AssemblyCanvas model={model} selectedLayerId={selectedLayer?.componentVersionId ?? null} onSelectLayer={setSelectedLayerId} />
        <aside className="pdw-inspector">
          <div className="pdw-inspector-header">
            <span>Selected layer</span>
            <strong>{selectedLayer?.slot ?? "None"}</strong>
          </div>
          {selectedLayer && (
            <>
              <dl className="pdw-fact-list">
                <div><dt>Variant</dt><dd>{selectedLayer.variantKey}</dd></div>
                <div><dt>Material</dt><dd>{selectedLayer.materialVariant}</dd></div>
                <div><dt>Approval</dt><dd className={`pdw-status-${selectedLayer.approvalStatus}`}>{selectedLayer.approvalStatus}</dd></div>
                <div><dt>Geometry</dt><dd>{getGeometryVerification(manifest, selectedLayer).replace(/-/g, " ")}</dd></div>
                <div><dt>Bounds</dt><dd>{selectedLayer.alphaBounds.left},{selectedLayer.alphaBounds.top} → {selectedLayer.alphaBounds.right},{selectedLayer.alphaBounds.bottom}</dd></div>
                <div><dt>Axis / seat</dt><dd>{selectedLayer.mountAxisXPx} / {selectedLayer.seatYPx} px</dd></div>
                <div><dt>SHA-256</dt><dd><code>{selectedLayer.imageSha256.slice(0, 16)}</code></dd></div>
              </dl>
              <div className="pdw-version-id"><span>Component version</span><code>{selectedLayer.componentVersionId}</code></div>
            </>
          )}
          <div className="pdw-inspector-notice">
            <LockKeyhole />
            <span>Release lock prevents coordinate and pixel changes. Edit Lab will create a new candidate version.</span>
          </div>
          <button type="button" className="pdw-disabled-action" disabled>Edit Lab unavailable in release lock</button>
          <div className="pdw-difference-state">
            <GitCompareArrows />
            <div><strong>Difference view unavailable</strong><span>No parent comparison evidence exists for this frozen release asset.</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
