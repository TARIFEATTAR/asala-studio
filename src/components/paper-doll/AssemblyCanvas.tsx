import { useMemo, useState } from "react";
import { Crosshair, Eye, EyeOff, Minus, Plus, ScanLine } from "lucide-react";

import type { AssemblyCanvasModel } from "./assemblyCanvasModel";

interface AssemblyCanvasProps {
  model: AssemblyCanvasModel;
  selectedLayerId: string | null;
  onSelectLayer: (componentVersionId: string) => void;
}

export function AssemblyCanvas({ model, selectedLayerId, onSelectLayer }: AssemblyCanvasProps) {
  const [zoom, setZoom] = useState(0.72);
  const [showBounds, setShowBounds] = useState(true);
  const [showCenterline, setShowCenterline] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showMask, setShowMask] = useState(false);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const selectedLayer = useMemo(
    () => model.layers.find((layer) => layer.componentVersionId === selectedLayerId) ?? null,
    [model.layers, selectedLayerId],
  );
  const toggleLayer = (componentVersionId: string) => {
    setHiddenLayers((current) => {
      const next = new Set(current);
      if (next.has(componentVersionId)) next.delete(componentVersionId);
      else next.add(componentVersionId);
      return next;
    });
  };

  return (
    <div className="pdw-canvas-panel">
      <div className="pdw-canvas-toolbar">
        <div className="pdw-tool-group" aria-label="Canvas zoom">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.42, value - 0.1))} aria-label="Zoom out"><Minus /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.32, value + 0.1))} aria-label="Zoom in"><Plus /></button>
        </div>
        <div className="pdw-tool-group pdw-tool-group--toggles">
          <button type="button" aria-pressed={showBounds} onClick={() => setShowBounds(!showBounds)}><ScanLine /> Bounds</button>
          <button type="button" aria-pressed={showCenterline} onClick={() => setShowCenterline(!showCenterline)}><Crosshair /> Axis</button>
          <button type="button" aria-pressed={showBaseline} onClick={() => setShowBaseline(!showBaseline)}>Seat</button>
          <button type="button" aria-pressed={showMask} onClick={() => setShowMask(!showMask)} disabled={!selectedLayer?.geometryMaskUrl}>Mask</button>
        </div>
      </div>

      <div className="pdw-canvas-scroll" aria-label="Release-locked assembly canvas">
        <div className="pdw-canvas-scale" style={{ width: `${zoom * 520}px` }}>
          <div className="pdw-canvas-field">
            {model.layers.map((layer, index) => {
              const hidden = hiddenLayers.has(layer.componentVersionId);
              return (
                <img
                  src={layer.imageUrl}
                  alt=""
                  className="pdw-canvas-layer"
                  style={{ zIndex: index + 1, visibility: hidden ? "hidden" : "visible" }}
                  key={layer.componentVersionId}
                />
              );
            })}
            {showMask && selectedLayer?.geometryMaskUrl && (
              <img src={selectedLayer.geometryMaskUrl} alt="" className="pdw-canvas-mask" />
            )}
            {showCenterline && <span className="pdw-canvas-centerline" style={{ left: `${model.centerlinePct}%` }} />}
            {showBaseline && <span className="pdw-canvas-baseline" style={{ top: `${model.baselinePct}%` }} />}
            {showBounds && model.layers.map((layer) => (
              <button
                type="button"
                key={`bounds:${layer.componentVersionId}`}
                className={selectedLayerId === layer.componentVersionId ? "pdw-canvas-bounds pdw-canvas-bounds--selected" : "pdw-canvas-bounds"}
                style={{
                  left: `${layer.boundsPct.left}%`,
                  top: `${layer.boundsPct.top}%`,
                  width: `${layer.boundsPct.width}%`,
                  height: `${layer.boundsPct.height}%`,
                  zIndex: model.layers.length - model.layers.indexOf(layer) + 20,
                }}
                onClick={() => onSelectLayer(layer.componentVersionId)}
                aria-label={`Select ${layer.slot} ${layer.variantKey}`}
              />
            ))}
            <span className="pdw-canvas-registration pdw-canvas-registration--tl" />
            <span className="pdw-canvas-registration pdw-canvas-registration--br" />
          </div>
        </div>
      </div>

      <div className="pdw-layer-strip" aria-label="Layer visibility">
        {[...model.layers].reverse().map((layer) => {
          const hidden = hiddenLayers.has(layer.componentVersionId);
          return (
            <div className={selectedLayerId === layer.componentVersionId ? "pdw-layer-strip-row pdw-layer-strip-row--selected" : "pdw-layer-strip-row"} key={layer.componentVersionId}>
              <button type="button" onClick={() => toggleLayer(layer.componentVersionId)} aria-label={`${hidden ? "Show" : "Hide"} ${layer.slot}`}>
                {hidden ? <EyeOff /> : <Eye />}
              </button>
              <button type="button" onClick={() => onSelectLayer(layer.componentVersionId)}>
                <span>{layer.slot}</span>
                <strong>{layer.variantKey}</strong>
              </button>
              <code>{layer.imageSha256.slice(0, 8)}</code>
            </div>
          );
        })}
      </div>
    </div>
  );
}
