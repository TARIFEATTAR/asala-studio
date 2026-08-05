import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

import {
  workbenchReleaseAssetUrlsByPath,
  workbenchReleaseManifest,
  workbenchReleaseManifestSha256,
} from "@/generated/paperDoll/cyl9Release.generated";
import { CYL9_RELEASE_WORKBENCH_SLUGS } from "@/lib/paperDoll/workbenchModel";

const bodyLabel = (variantKey: string) => {
  const map: Record<string, string> = {
    AMB: "Amber",
    BLU: "Cobalt",
    CLR: "Clear",
    FRS: "Frosted",
    SWL: "Swirl",
  };
  return map[variantKey] ?? variantKey;
};

const capLabel = (variantKey: string) => {
  const map: Record<string, string> = {
    "SHN-SL": "Silver",
    "SHN-BLK": "Black",
    WHT: "White",
    "TRNS-FRS": "Translucent Frosted",
  };
  return map[variantKey] ?? variantKey;
};

export default function BestBottlesPaperDollPublicStudio() {
  const { groupSlug } = useParams<{ groupSlug: string }>();

  const { bodyAssets, capAssets, blockerAssets } = useMemo(() => {
    const bodyAssets = workbenchReleaseManifest.assets.filter((asset) => asset.slot === "body");
    const capAssets = workbenchReleaseManifest.assets.filter((asset) => asset.slot === "cap");
    const blockerAssets = capAssets.filter((asset) => asset.approvalStatus !== "approved");
    return { bodyAssets, capAssets, blockerAssets };
  }, []);

  const approvedCaps = useMemo(
    () => capAssets.filter((asset) => asset.approvalStatus === "approved"),
    [capAssets],
  );
  const approvedBodies = useMemo(
    () => bodyAssets.filter((asset) => asset.approvalStatus === "approved"),
    [bodyAssets],
  );
  const [selectedBody, setSelectedBody] = useState(approvedBodies[0]?.variantKey ?? approvedBodies[0]?.componentVersionId);
  const [selectedCap, setSelectedCap] = useState(approvedCaps[0]?.variantKey ?? approvedCaps[0]?.componentVersionId);

  const selectedBodyAsset = useMemo(
    () => approvedBodies.find((asset) => asset.variantKey === selectedBody) ?? approvedBodies[0],
    [approvedBodies, selectedBody],
  );
  const selectedCapAsset = useMemo(
    () => approvedCaps.find((asset) => asset.variantKey === selectedCap) ?? approvedCaps[0],
    [approvedCaps, selectedCap],
  );

  const bodyImage = selectedBodyAsset
    ? workbenchReleaseAssetUrlsByPath[selectedBodyAsset.imagePath]
    : null;
  const capImage = selectedCapAsset
    ? workbenchReleaseAssetUrlsByPath[selectedCapAsset.imagePath]
    : null;

  if (!groupSlug || !CYL9_RELEASE_WORKBENCH_SLUGS.has(groupSlug)) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] px-6 py-10 text-slate-800">
        <div className="mx-auto max-w-3xl rounded border border-amber-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">Product details</span>
            <span className="text-slate-500">CYL-9ML preview</span>
          </div>
          <h1 className="text-2xl font-semibold">Family not available on shopper view</h1>
          <p className="mt-3 text-sm text-slate-600">
            The shopper preview route is active for CYL-9ML group slugs.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Try
            <Link to="/best-bottles/studio/cylinder-9ml-clear-17-415-rollon/public" className="ml-1 text-amber-700 underline">
              this 9ml preview
            </Link>
            {" "}to view paper-doll composition.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef] px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Homepage
        </Link>

        <header className="rounded border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Best Bottles · Shopper Preview</p>
          <h1 className="mt-2 text-2xl font-semibold">CYL-9ML Paper-Doll Family</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Family: <strong>cylinder-9ml</strong>. Release version <strong>{workbenchReleaseManifest.releaseVersion}</strong>.
            Hash <span className="font-mono">{workbenchReleaseManifestSha256.slice(0, 12)}…</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-700">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approvedBodies.length} approved body layers
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approvedCaps.length} approved cap layers
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
              {workbenchReleaseManifest.blockers.length} publication blockers
            </span>
          </div>
          {blockerAssets.length > 0 ? (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Blockers in current release snapshot
              </div>
              <ul className="list-inside list-disc space-y-1 pl-1">
                {workbenchReleaseManifest.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          ) : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Product image preview</h2>
            <p className="mt-2 text-xs text-slate-500">
              {selectedBodyAsset && selectedCapAsset
                ? `${bodyLabel(selectedBodyAsset.variantKey)} body + ${capLabel(selectedCapAsset.variantKey)} cap`
                : "Select a body and cap variant"
              }
            </p>
            <div className="relative mt-4 overflow-hidden rounded bg-[#f5f3ef]" style={{ aspectRatio: "2080 / 2288" }}>
              {bodyImage ? <img src={bodyImage} alt="Body layer" className="absolute inset-0 h-full w-full object-contain" /> : null}
              {capImage ? <img src={capImage} alt="Cap layer" className="absolute inset-0 h-full w-full object-contain" /> : null}
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <p className="text-slate-500">Selected cap approval: {selectedCapAsset?.approvalStatus ?? "unknown"}</p>
              <p className="text-slate-500">Release status: {workbenchReleaseManifest.status}</p>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Choose body</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {approvedBodies.map((asset) => {
                const selected = asset.variantKey === selectedBody;
                const imageUrl = workbenchReleaseAssetUrlsByPath[asset.imagePath];
                return (
                  <button
                    key={asset.variantKey}
                    type="button"
                    onClick={() => setSelectedBody(asset.variantKey)}
                    className={`rounded border p-2 text-left ${selected ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                  >
                    <div className="mb-2 h-24 w-full overflow-hidden rounded bg-[#f5f3ef]">
                      <img src={imageUrl} alt={asset.variantKey} className="h-full w-full object-contain" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{bodyLabel(asset.variantKey)}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{asset.variantKey}</div>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Choose cap</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {approvedCaps.map((asset) => {
                const selected = asset.variantKey === selectedCap;
                const imageUrl = workbenchReleaseAssetUrlsByPath[asset.imagePath];
                return (
                  <button
                    key={asset.variantKey}
                    type="button"
                    onClick={() => setSelectedCap(asset.variantKey)}
                    className={`rounded border p-2 text-left ${selected ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                  >
                    <div className="mb-2 h-20 w-full overflow-hidden rounded bg-[#f5f3ef]">
                      <img src={imageUrl} alt={asset.variantKey} className="h-full w-full object-contain" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{capLabel(asset.variantKey)}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{asset.variantKey}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
