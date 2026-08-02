import { useState } from "react";
import { CheckCircle2, CircleSlash2 } from "lucide-react";

import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import { buildWorkbenchLineup } from "@/lib/paperDoll/workbenchModel";
import { LineupCard } from "./LineupCard";

interface LineupViewProps {
  manifest: PaperDollReleaseManifest;
  assetUrlsByPath: Readonly<Record<string, string>>;
}

const LINEUP_MAPPING_KEYS = ["CLR", "AMB", "BLU", "FRS", "SWL"]
  .map((body) => `CYL-9ML:${body}:ROLLON:SHN-SL`);

export function LineupView({ manifest, assetUrlsByPath }: LineupViewProps) {
  const [showAxis, setShowAxis] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showBounds, setShowBounds] = useState(false);
  const [showMask, setShowMask] = useState(false);
  let lineup;
  try {
    lineup = buildWorkbenchLineup(manifest, LINEUP_MAPPING_KEYS);
  } catch (error) {
    return <div className="pdw-view-error"><CircleSlash2 /><div><strong>Five-product lineup cannot resolve</strong><span>{error instanceof Error ? error.message : String(error)}</span></div></div>;
  }

  return (
    <div className="pdw-lineup-view">
      <div className="pdw-view-heading">
        <div>
          <span className="pdw-kicker">Catalog registration</span>
          <h3>Five bodies · one closure geometry</h3>
          <p>Each card resolves an explicit mapping at one canvas scale. Nothing is nudged for presentation.</p>
        </div>
        <div className="pdw-lineup-toggles">
          <button type="button" aria-pressed={showBaseline} onClick={() => setShowBaseline(!showBaseline)}>Baseline</button>
          <button type="button" aria-pressed={showAxis} onClick={() => setShowAxis(!showAxis)}>Centerline</button>
          <button type="button" aria-pressed={showBounds} onClick={() => setShowBounds(!showBounds)}>Bounds</button>
          <button type="button" aria-pressed={showMask} onClick={() => setShowMask(!showMask)}>Mask</button>
        </div>
      </div>

      <div className="pdw-lineup-ruler"><span>2080 × 2288 canonical canvas</span><span>Shared body seat overlay</span><span>Fixed display scale</span></div>
      <div className="pdw-lineup-grid">
        {lineup.map((item) => <LineupCard item={item} assetUrlsByPath={assetUrlsByPath} showAxis={showAxis} showBaseline={showBaseline} showBounds={showBounds} showMask={showMask} key={item.mappingKey} />)}
      </div>

      <section className="pdw-lineup-verdict">
        <CheckCircle2 />
        <div><strong>Selected lineup registration passes</strong><span>Five explicit mappings share canvas, layer order, axis, and closure mask identity. This does not clear the blocked translucent material or catalog-SKU reconciliation gates.</span></div>
        <b>Visual QA only</b>
      </section>
    </div>
  );
}
