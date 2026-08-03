import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Boxes,
  CloudUpload,
  FileStack,
  GitCompare,
  ScanLine,
  Workflow,
} from "lucide-react";

import type { ApplicatorBucket } from "@/integrations/convex/bestBottles";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import type { PaperDollReleaseValidation } from "@/lib/paperDoll/releaseValidator";
import { loadCyl9ComponentFactory } from "@/lib/paperDoll/cyl9ComponentFactory";
import { buildComponentWorkbenchRows } from "@/lib/paperDoll/componentWorkbenchModel";
import { ComponentCandidateView } from "./ComponentCandidateView";
import { ComponentInventoryView } from "./ComponentInventoryView";
import { ComponentPlateView } from "./ComponentPlateView";
import { FamilyFitView } from "./FamilyFitView";
import { ReleaseCutView } from "./ReleaseCutView";
import { ReleaseInventoryRail } from "./ReleaseInventoryRail";
import { ReleaseWorkbenchHeader } from "./ReleaseWorkbenchHeader";
import { SanityProjectionView } from "./SanityProjectionView";
import {
  parseReleaseWorkbenchState,
  serializeReleaseWorkbenchState,
  type ReleaseWorkbenchState,
  type ReleaseWorkbenchView,
} from "./releaseWorkbenchState";
import "@/styles/paper-doll-workbench.css";

interface ReleaseWorkbenchProps {
  manifest: PaperDollReleaseManifest;
  validation: PaperDollReleaseValidation;
  manifestSha256: string;
  assetUrlsByPath: Readonly<Record<string, string>>;
  applicatorBuckets: ApplicatorBucket[];
}

const VIEW_ITEMS: Array<{
  id: ReleaseWorkbenchView;
  label: string;
  description: string;
  icon: typeof Boxes;
}> = [
  { id: "inventory", label: "Inventory", description: "23 component plates", icon: Boxes },
  { id: "plate", label: "Component Plate", description: "Source + four boxes", icon: ScanLine },
  { id: "candidate", label: "Candidate Review", description: "Pixels + exact QA", icon: GitCompare },
  { id: "family-fit", label: "Family Fit", description: "Five-body placement", icon: Workflow },
  { id: "release", label: "Release Cut", description: "Immutable snapshot", icon: FileStack },
  { id: "sanity", label: "Sanity Projection", description: "Draft then public", icon: CloudUpload },
];

const RELEASE_VARIANT_ALIASES: Record<string, string> = {
  SSLV: "SHN-SL",
  SBLK: "SHN-BLK",
  WHT: "WHT",
};

export function ReleaseWorkbench({
  manifest,
  validation,
  manifestSha256,
  assetUrlsByPath,
  applicatorBuckets,
}: ReleaseWorkbenchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseReleaseWorkbenchState(searchParams), [searchParams]);
  const selectView = (view: ReleaseWorkbenchView) => {
    setSearchParams(serializeReleaseWorkbenchState({ ...state, view }, searchParams), { replace: true });
  };
  const setState = (nextState: ReleaseWorkbenchState) => {
    setSearchParams(serializeReleaseWorkbenchState(nextState, searchParams), { replace: true });
  };
  const factory = useMemo(() => loadCyl9ComponentFactory(), []);
  const rows = useMemo(() => buildComponentWorkbenchRows({
    manifest: factory,
    candidates: [],
    releaseAssets: manifest.assets,
    sanitySyncs: [],
  }), [factory, manifest.assets]);
  const selectedRow = rows.find((row) => row.componentKey === state.componentKey) ?? rows[0] ?? null;
  const selectedReleaseAsset = selectedRow
    ? manifest.assets.find((asset) => asset.slot === selectedRow.slot && (
      asset.variantKey === selectedRow.variantKey ||
      asset.variantKey === RELEASE_VARIANT_ALIASES[selectedRow.variantKey]
    )) ?? null
    : null;
  const bodies = manifest.assets.filter((asset) => asset.slot === "body");

  const view = (() => {
    if (state.view === "inventory") return <ComponentInventoryView rows={rows} state={state} onStateChange={setState} />;
    if (state.view === "plate") return <ComponentPlateView row={selectedRow} />;
    if (state.view === "candidate") return <ComponentCandidateView row={selectedRow} releaseAsset={selectedReleaseAsset} assetUrlsByPath={assetUrlsByPath} />;
    if (state.view === "family-fit") return <FamilyFitView row={selectedRow} bodies={bodies} componentAsset={selectedReleaseAsset} assetUrlsByPath={assetUrlsByPath} state={state} onStateChange={setState} />;
    if (state.view === "release") return <ReleaseCutView rows={rows} manifest={manifest} validation={validation} manifestSha256={manifestSha256} />;
    return <SanityProjectionView factory={factory} release={manifest} manifestSha256={manifestSha256} />;
  })();

  return (
    <div className="pdw-workbench">
      <ReleaseWorkbenchHeader
        manifest={manifest}
        validation={validation}
        manifestSha256={manifestSha256}
      />

      <nav className="pdw-view-tabs" aria-label="Release workbench views" role="tablist">
        {VIEW_ITEMS.map(({ id, label, description, icon: Icon }) => (
          <button
            type="button"
            role="tab"
            aria-selected={state.view === id}
            className={state.view === id ? "pdw-view-tab pdw-view-tab--active" : "pdw-view-tab"}
            key={id}
            onClick={() => selectView(id)}
          >
            <Icon aria-hidden="true" />
            <span><strong>{label}</strong><small>{description}</small></span>
          </button>
        ))}
      </nav>

      <div className="pdw-workspace">
        <ReleaseInventoryRail
          manifest={manifest}
          assetUrlsByPath={assetUrlsByPath}
          applicatorBuckets={applicatorBuckets}
        />
        <section className="pdw-view-surface" role="tabpanel" aria-label={state.view}>
          {view}
        </section>
      </div>
    </div>
  );
}
