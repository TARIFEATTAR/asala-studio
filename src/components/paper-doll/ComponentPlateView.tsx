import { useMemo, useRef, useState } from "react";
import { BoxSelect, FolderOpen, ImageUp, ScanLine } from "lucide-react";

import type { ComponentWorkbenchRow } from "@/lib/paperDoll/componentWorkbenchModel";
import { componentSourceUrl } from "./componentWorkbenchAssets";

interface ComponentPlateViewProps { row: ComponentWorkbenchRow | null }

export function ComponentPlateView({ row }: ComponentPlateViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [provider, setProvider] = useState("openai");
  const sourceUrl = useMemo(() => row ? componentSourceUrl(row.source.path) : null, [row]);
  if (!row) return <div className="pdw-no-results">Select a component from Inventory to open its plate.</div>;
  const fullSourceBounds = { left: 0, top: 0, width: row.source.widthPx, height: row.source.heightPx };
  const boxes = [
    ["Source", fullSourceBounds],
    ["Edit", row.candidate?.editBoundsPx ?? fullSourceBounds],
    ["Authority", row.authority?.authorityBoundsPx ?? null],
    ["Placement", row.candidate?.placementBoundsPx ?? null],
  ] as const;

  return (
    <div className="pdw-lifecycle-view">
      <header className="pdw-view-heading"><div><span className="pdw-kicker">Geometry authority + generation intake</span><h3>Component Plate · {row.variantKey}</h3><p>{row.componentKey}</p></div></header>
      <div className="pdw-plate-layout">
        <section className="pdw-plate-canvas">
          <div className="pdw-plate-stage">
            {(localPreview || sourceUrl) ? <img src={localPreview || sourceUrl!} alt={`${row.materialVariant} source`} /> : <span>Source preview unavailable</span>}
            <span className="pdw-box-overlay pdw-box-overlay--source" />
          </div>
          <div className="pdw-box-readouts">
            {boxes.map(([label, bounds]) => <div key={label}><span>{label} bounds</span><code>{bounds ? `${bounds.left}, ${bounds.top} · ${bounds.width}×${bounds.height}` : "Not registered"}</code></div>)}
          </div>
        </section>
        <aside className="pdw-plate-controls">
          <div className="pdw-panel-label"><ScanLine /> Plate identity</div>
          <dl className="pdw-fact-list">
            <div><dt>Slot</dt><dd>{row.slot}</dd></div><div><dt>Geometry</dt><dd>{row.geometryFamilyId}</dd></div>
            <div><dt>Authority</dt><dd className={row.authorityStatus === "approved" ? "pdw-status-approved" : "pdw-status-blocked"}>{row.authorityStatus}</dd></div>
            <div><dt>Bodies</dt><dd>{row.compatibleBodyVariantKeys.join(" · ")}</dd></div>
            <div><dt>Filename</dt><dd>{row.source.originalFilename}</dd></div><div><dt>Source SHA</dt><dd className="pdw-mono">{row.source.sha256.slice(0, 16)}…</dd></div>
          </dl>
          <label className="pdw-field"><span>Generation provider</span><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">GPT Image 2</option><option value="google">Google Nano Banana</option><option value="manual">Versioned upload</option><option value="blender">Blender render</option></select></label>
          <label className="pdw-field"><span>Material-only instruction</span><textarea defaultValue={`Preserve the exact ${row.geometryFamilyId} geometry. Change only the ${row.materialVariant} surface treatment.`} /></label>
          <div className="pdw-intake-actions">
            <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setLocalPreview(URL.createObjectURL(file));
            }} />
            <button type="button" onClick={() => inputRef.current?.click()}><ImageUp />Upload from computer</button>
            <button type="button" title="The Image Library bridge supplies a versioned source record"><FolderOpen />Choose from Image Library</button>
          </div>
          <div className="pdw-local-only"><BoxSelect /> Drag/resize remains a local candidate edit until a named placement action writes a new version.</div>
        </aside>
      </div>
    </div>
  );
}
