import type { WorkbenchLineupItem } from "@/lib/paperDoll/workbenchModel";

interface LineupCardProps {
  item: WorkbenchLineupItem;
  assetUrlsByPath: Readonly<Record<string, string>>;
  showAxis: boolean;
  showBaseline: boolean;
  showBounds: boolean;
  showMask: boolean;
}

export function LineupCard({ item, assetUrlsByPath, showAxis, showBaseline, showBounds, showMask }: LineupCardProps) {
  return (
    <article className="pdw-lineup-card">
      <div className="pdw-lineup-canvas">
        {item.layers.map((layer, index) => (
          <img src={assetUrlsByPath[layer.imagePath]} alt="" style={{ zIndex: index + 1 }} key={layer.componentVersionId} />
        ))}
        {showMask && item.layers.filter((layer) => layer.geometryMaskPath).map((layer) => (
          <img className="pdw-lineup-mask" src={assetUrlsByPath[layer.geometryMaskPath!]} alt="" key={`mask:${layer.componentVersionId}`} />
        ))}
        {showAxis && <span className="pdw-lineup-axis" style={{ left: `${item.overlay.centerlinePct}%` }} />}
        {showBaseline && <span className="pdw-lineup-baseline" style={{ top: `${item.overlay.baselinePct}%` }} />}
        {showBounds && item.layers.map((layer) => (
          <span className="pdw-lineup-bounds" key={`bounds:${layer.componentVersionId}`} style={{ left: `${layer.boundsPct.left}%`, top: `${layer.boundsPct.top}%`, width: `${layer.boundsPct.width}%`, height: `${layer.boundsPct.height}%` }} />
        ))}
      </div>
      <div className="pdw-lineup-caption">
        <span>{item.mappingKey.split(":")[1]}</span>
        <strong>{item.mappingKey.split(":").at(-1)}</strong>
        <code>{item.mappingKey}</code>
      </div>
    </article>
  );
}
