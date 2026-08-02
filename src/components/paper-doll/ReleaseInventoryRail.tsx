import { AlertOctagon, Box, ChevronRight, PackageOpen } from "lucide-react";

import type { ApplicatorBucket } from "@/integrations/convex/bestBottles";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import { buildReleaseInventory } from "@/lib/paperDoll/workbenchModel";

interface ReleaseInventoryRailProps {
  manifest: PaperDollReleaseManifest;
  assetUrlsByPath: Readonly<Record<string, string>>;
  applicatorBuckets: ApplicatorBucket[];
}

function catalogSystemKey(applicator: string): string {
  const normalized = applicator.toLowerCase();
  if (/roll/.test(normalized)) return "rollon";
  if (/spray|mist|atom/.test(normalized)) return "spray";
  if (/lotion|pump/.test(normalized)) return "lotion";
  if (/reducer|plug|cap|closure/.test(normalized)) return "closure";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ReleaseInventoryRail({
  manifest,
  assetUrlsByPath,
  applicatorBuckets,
}: ReleaseInventoryRailProps) {
  const inventory = buildReleaseInventory(manifest);
  const releaseCountsBySystem = new Map<string, number>(
    inventory.systems.map((system) => [system.key, system.components.length]),
  );

  return (
    <aside className="pdw-inventory" aria-label="Family inventory">
      <section className="pdw-rail-section">
        <div className="pdw-rail-heading">
          <span>Bodies</span>
          <b>{inventory.bodies.length}</b>
        </div>
        <div className="pdw-body-list">
          {inventory.bodies.map((body) => (
            <button className="pdw-body-row" type="button" key={body.componentVersionId}>
              <span className="pdw-body-thumb">
                <img src={assetUrlsByPath[body.imagePath]} alt="" />
              </span>
              <span>
                <strong>{body.materialVariant.replace(/-/g, " ")}</strong>
                <small>{body.variantKey} · approved</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="pdw-rail-section">
        <div className="pdw-rail-heading">
          <span>Compatible systems</span>
          <b>{applicatorBuckets.length}</b>
        </div>
        <div className="pdw-system-list">
          {applicatorBuckets.map((bucket) => {
            const systemKey = catalogSystemKey(bucket.applicator);
            const released = releaseCountsBySystem.get(systemKey) ?? 0;
            return (
              <div className="pdw-system-row" key={bucket.applicator}>
                <Box aria-hidden="true" />
                <span>
                  <strong>{bucket.applicator}</strong>
                  <small>{bucket.count} catalog SKU{bucket.count === 1 ? "" : "s"}</small>
                </span>
                <span className={released > 0 ? "pdw-coverage pdw-coverage--partial" : "pdw-coverage pdw-coverage--missing"}>
                  {released > 0 ? `${released} assets` : "Missing"}
                </span>
              </div>
            );
          })}
          {applicatorBuckets.length === 0 && (
            <div className="pdw-empty-rail">
              <PackageOpen aria-hidden="true" />
              <span>Catalog systems unavailable. Release coverage cannot be inferred.</span>
            </div>
          )}
        </div>
      </section>

      <section className="pdw-rail-alert" aria-label="Metal roller blocker">
        <AlertOctagon aria-hidden="true" />
        <div>
          <strong>Metal roller blocked</strong>
          <span>Frozen source contains 72.8% opaque white junk. Repair and superseding version required.</span>
        </div>
      </section>
    </aside>
  );
}
