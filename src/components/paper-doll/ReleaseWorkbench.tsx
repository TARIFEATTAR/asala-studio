import type { ReactNode } from "react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileSearch,
  GalleryHorizontalEnd,
  Layers3,
  ShieldCheck,
  TableProperties,
} from "lucide-react";

import type { ApplicatorBucket } from "@/integrations/convex/bestBottles";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import type { PaperDollReleaseValidation } from "@/lib/paperDoll/releaseValidator";
import { ReleaseInventoryRail } from "./ReleaseInventoryRail";
import { ReleaseWorkbenchHeader } from "./ReleaseWorkbenchHeader";
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
  renderView: (view: ReleaseWorkbenchView, state: ReleaseWorkbenchState) => ReactNode;
}

const VIEW_ITEMS: Array<{
  id: ReleaseWorkbenchView;
  label: string;
  description: string;
  icon: typeof Layers3;
}> = [
  { id: "assembly", label: "Assembly", description: "Layer inspection", icon: Layers3 },
  { id: "matrix", label: "Matrix", description: "Lifecycle coverage", icon: TableProperties },
  { id: "lineup", label: "Lineup", description: "Catalog registration", icon: GalleryHorizontalEnd },
  { id: "evidence", label: "Evidence", description: "Measured gates", icon: FileSearch },
  { id: "publish", label: "QA & Publish", description: "No-write projection", icon: ShieldCheck },
];

export function ReleaseWorkbench({
  manifest,
  validation,
  manifestSha256,
  assetUrlsByPath,
  applicatorBuckets,
  renderView,
}: ReleaseWorkbenchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseReleaseWorkbenchState(searchParams), [searchParams]);
  const selectView = (view: ReleaseWorkbenchView) => {
    setSearchParams(serializeReleaseWorkbenchState({ ...state, view }, searchParams), { replace: true });
  };

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
          {renderView(state.view, state)}
        </section>
      </div>
    </div>
  );
}
