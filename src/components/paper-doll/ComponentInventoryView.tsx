import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot } from "lucide-react";

import type { ComponentWorkbenchRow } from "@/lib/paperDoll/componentWorkbenchModel";
import type { ReleaseWorkbenchState } from "./releaseWorkbenchState";

interface ComponentInventoryViewProps {
  rows: ComponentWorkbenchRow[];
  state: ReleaseWorkbenchState;
  onStateChange: (state: ReleaseWorkbenchState) => void;
}

export function ComponentInventoryView({ rows, state, onStateChange }: ComponentInventoryViewProps) {
  const visibleRows = rows.filter((row) =>
    (!state.filters.role || row.slot === state.filters.role) &&
    (!state.filters.status || row.status.tone === state.filters.status) &&
    (!state.filters.finish || row.materialVariant === state.filters.finish)
  );
  const counts = rows.reduce<Record<string, number>>((result, row) => {
    result[row.slot] = (result[row.slot] ?? 0) + 1;
    return result;
  }, {});

  return (
    <div className="pdw-lifecycle-view">
      <header className="pdw-view-heading">
        <div>
          <span className="pdw-kicker">23 component plates · 145 explicit assemblies</span>
          <h3>Component Inventory</h3>
          <p>One tracked row per physical component variant. Bodies remain a separate locked plate family.</p>
        </div>
        <div className="pdw-inventory-totals" aria-label="Component totals">
          {Object.entries(counts).map(([slot, count]) => <span key={slot}><b>{count}</b>{slot}</span>)}
        </div>
      </header>

      <div className="pdw-matrix-table-wrap">
        <table className="pdw-matrix-table pdw-component-table">
          <thead><tr><th>Component</th><th>Material</th><th>Authority</th><th>Lifecycle</th><th>Coverage</th><th>Next action</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.componentKey}:${row.variantKey}`}>
                <td><strong>{row.variantKey}</strong><span>{row.slot}</span><code>{row.componentKey}</code></td>
                <td><strong>{row.materialVariant.replace(/-/g, " ")}</strong><span>{row.materialClass}</span></td>
                <td>
                  <span className={`pdw-state pdw-state--${row.authorityStatus === "approved" ? "approved" : "blocked"}`}>
                    {row.authorityStatus === "approved" ? <CheckCircle2 /> : <AlertTriangle />}{row.authorityStatus}
                  </span>
                </td>
                <td>
                  <span className={`pdw-state pdw-state--${row.status.tone}`}><CircleDot />{row.status.label}</span>
                  {row.status.ancestorNotice && <small className="pdw-ancestor-notice">{row.status.ancestorNotice}</small>}
                </td>
                <td><strong>{row.compatibleBodyVariantKeys.length}/5 bodies</strong><span>{row.inCurrentRelease ? "Current Release" : "Not cut"}</span></td>
                <td>
                  <button
                    className="pdw-row-action"
                    type="button"
                    onClick={() => onStateChange({
                      ...state,
                      view: "plate",
                      componentKey: row.componentKey,
                      candidateId: row.candidate?.candidateId ?? null,
                    })}
                  >{row.nextAction}<ArrowRight /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleRows.length === 0 && <div className="pdw-no-results">No component plates match the active filters.</div>}
    </div>
  );
}
