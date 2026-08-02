import { AlertTriangle, ArrowRight, Check, CircleSlash2 } from "lucide-react";

import type { Product } from "@/integrations/convex/bestBottles";
import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import type { ReleaseWorkbenchState } from "./releaseWorkbenchState";
import { buildMatrixModel, filterMatrixRows } from "./matrixModel";

interface MatrixViewProps {
  manifest: PaperDollReleaseManifest;
  catalogProducts: Product[];
  state: ReleaseWorkbenchState;
  onStateChange: (state: ReleaseWorkbenchState) => void;
}

export function MatrixView({ manifest, catalogProducts, state, onStateChange }: MatrixViewProps) {
  const model = buildMatrixModel(manifest, catalogProducts);
  const rows = filterMatrixRows(model.rows, state.filters);
  const options = {
    system: [...new Set(model.rows.map((row) => row.system))],
    role: [...new Set(model.rows.map((row) => row.role))],
    finish: [...new Set(model.rows.map((row) => row.finish))],
    status: [...new Set(model.rows.map((row) => row.lifecycleStatus))],
  };
  const updateFilter = (key: keyof ReleaseWorkbenchState["filters"], value: string) => {
    onStateChange({ ...state, filters: { ...state.filters, [key]: value || null } });
  };

  return (
    <div className="pdw-matrix-view">
      <div className="pdw-view-heading">
        <div>
          <span className="pdw-kicker">Release asset denominator</span>
          <h3>{model.summary.approved} approved of {model.summary.required} required</h3>
          <p>Lifecycle columns remain separate; “approved” does not imply published.</p>
        </div>
        <div className="pdw-matrix-counts">
          <span><b>{model.summary.inRelease}</b> in release</span>
          <span><b>{model.summary.blocked}</b> blocked</span>
          <span><b>{model.summary.published}</b> published</span>
        </div>
      </div>

      <section className={model.catalogReconciliation.unmatchedProducts > 0 ? "pdw-catalog-reconcile pdw-catalog-reconcile--blocked" : "pdw-catalog-reconcile"}>
        <AlertTriangle />
        <div>
          <strong>Master catalog reconciliation</strong>
          <span>{model.catalogReconciliation.mappedProducts} of {model.catalogReconciliation.catalogProducts} live catalog products have exact SKU mappings. {model.catalogReconciliation.previewMappings} release mappings still use preview identities.</span>
        </div>
        <b>{model.catalogReconciliation.unmatchedProducts} unmatched</b>
      </section>

      <div className="pdw-matrix-filters" aria-label="Matrix filters">
        {(["system", "role", "finish", "status"] as const).map((key) => (
          <label key={key}><span>{key}</span><select value={state.filters[key] ?? ""} onChange={(event) => updateFilter(key, event.target.value)}><option value="">All</option>{options[key].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        ))}
        <span className="pdw-filter-result">Showing {rows.length} of {model.summary.required}</span>
      </div>

      <div className="pdw-matrix-table-wrap">
        <table className="pdw-matrix-table">
          <thead><tr><th>Requirement</th><th>Version / finish</th><th>QA</th><th>Approval</th><th>Release</th><th>Published</th><th>Next action</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.requirementKey}>
                <td><strong>{row.variantKey}</strong><span>{row.system} · {row.role}</span></td>
                <td><code>{row.componentVersionId}</code><span>{row.finish.replace(/-/g, " ")} · root version</span></td>
                <td><span className={`pdw-state pdw-state--${row.qaStatus}`}>{row.qaStatus === "passed" ? <Check /> : <CircleSlash2 />}{row.qaStatus}</span></td>
                <td><span className={`pdw-state pdw-state--${row.approvalStatus}`}>{row.approvalStatus}</span></td>
                <td><span className="pdw-state pdw-state--in-release"><Check />In release</span></td>
                <td><span className="pdw-state pdw-state--not-recorded"><CircleSlash2 />Not published</span></td>
                <td><span className="pdw-next-action">{row.nextAction}<ArrowRight /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="pdw-no-results">No release requirement matches these filters. The denominator remains {model.summary.required}.</div>}
      </div>
    </div>
  );
}
