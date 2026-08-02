import { useEffect, useMemo, useRef, useState } from "react";
import { fabric } from "fabric";
import { Crosshair, Eye, EyeOff, Maximize2, Minus, Plus } from "lucide-react";

import type { PaperDollReleaseWorkbenchData } from "@/lib/paperDoll/releaseRepository";
import {
  RELEASE_CANVAS,
  canvasStageSize,
  displayRectToRelease,
  displayToRelease,
  releaseToDisplay,
  shouldZoomCanvasFromWheel,
  type AssemblyEditMode,
  type CandidateSelectionKind,
  type ReleaseRect,
} from "./assemblyEditModel";
import type { CandidateBrushStroke } from "./useCandidateMask";
import {
  placementObjectOrigin,
  placementTransformFromObject,
  type FamilyPlacementTransform,
  type ReleaseBounds,
} from "./familyPlacementModel";

type ReleaseAsset = PaperDollReleaseWorkbenchData["assets"][number];

interface AssemblyEditCanvasProps {
  layers: ReleaseAsset[];
  selectedLayerId: string | null;
  mode: AssemblyEditMode;
  selectionKind: CandidateSelectionKind;
  showGuides: boolean;
  showMaskOverlay: boolean;
  candidateEditingEnabled: boolean;
  placementEditingEnabled: boolean;
  layerTransform: FamilyPlacementTransform;
  contactGuideYPx?: number;
  onSelectLayer: (id: string) => void;
  onTransformChange: (transform: { translateXPx: number; translateYPx: number; scaleX: number; scaleY: number }) => void;
  onRectangleChange: (rectangle: ReleaseRect) => void;
  onBrushStroke: (stroke: CandidateBrushStroke) => void;
}

const GUIDE_COLOR = "#d7a85f";
const MASK_COLOR = "#61d6c8";

export function AssemblyEditCanvas({
  layers,
  selectedLayerId,
  mode,
  selectionKind,
  showGuides,
  showMaskOverlay,
  candidateEditingEnabled,
  placementEditingEnabled,
  layerTransform,
  contactGuideYPx = 1002,
  onSelectLayer,
  onTransformChange,
  onRectangleChange,
  onBrushStroke,
}: AssemblyEditCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const interactionRef = useRef({ mode, selectionKind, selectedLayerId, candidateEditingEnabled, placementEditingEnabled });
  const layerTransformRef = useRef(layerTransform);
  const callbacksRef = useRef({ onSelectLayer, onTransformChange, onRectangleChange, onBrushStroke });
  const [display, setDisplay] = useState({ width: 520, height: 572 });
  const [zoom, setZoom] = useState(1);
  const [guidesVisible, setGuidesVisible] = useState(showGuides);
  const [maskVisible, setMaskVisible] = useState(showMaskOverlay);

  interactionRef.current = { mode, selectionKind, selectedLayerId, candidateEditingEnabled, placementEditingEnabled };
  layerTransformRef.current = layerTransform;
  callbacksRef.current = { onSelectLayer, onTransformChange, onRectangleChange, onBrushStroke };

  useEffect(() => setGuidesVisible(showGuides), [showGuides]);
  useEffect(() => setMaskVisible(showMaskOverlay), [showMaskOverlay]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const update = () => {
      const width = Math.max(320, Math.min(760, wrapperRef.current?.clientWidth ?? 520));
      const height = Math.round(width * RELEASE_CANVAS.height / RELEASE_CANVAS.width);
      setDisplay((current) => current.width === width && current.height === height ? current : { width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasElementRef.current) return;
    const canvas = new fabric.Canvas(canvasElementRef.current, {
      width: display.width,
      height: display.height,
      backgroundColor: "#F5F3EF",
      preserveObjectStacking: true,
      selection: false,
      stopContextMenu: true,
    });
    canvasRef.current = canvas;

    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let drawing = false;
    let start: fabric.Point | null = null;
    let rectangle: fabric.Rect | null = null;
    let brush: fabric.Polyline | null = null;
    let brushPoints: Array<{ x: number; y: number }> = [];

    canvas.on("mouse:wheel", (event) => {
      const native = event.e as WheelEvent;
      if (!shouldZoomCanvasFromWheel(native)) return;
      setZoom((current) => Math.min(4, Math.max(0.5, current * 0.999 ** native.deltaY)));
      native.preventDefault();
      native.stopPropagation();
    });
    canvas.on("mouse:down", (event) => {
      const native = event.e as MouseEvent;
      if (native.altKey) {
        panning = true;
        lastX = native.clientX;
        lastY = native.clientY;
        canvas.setCursor("grabbing");
        return;
      }
      const interaction = interactionRef.current;
      if (interaction.mode !== "edit-lab" || !interaction.candidateEditingEnabled || interaction.selectionKind === "whole-layer") return;
      const pointer = canvas.getPointer(native);
      drawing = true;
      start = new fabric.Point(pointer.x, pointer.y);
      if (interaction.selectionKind === "rectangle") {
        rectangle = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 1,
          height: 1,
          fill: "rgba(97,214,200,0.17)",
          stroke: MASK_COLOR,
          strokeWidth: 1,
          selectable: false,
          evented: false,
          name: "mask-draft",
        });
        canvas.getObjects().filter((object) => object.name === "mask-draft").forEach((object) => canvas.remove(object));
        canvas.add(rectangle);
      } else {
        brushPoints = [{ x: pointer.x, y: pointer.y }];
        brush = new fabric.Polyline(brushPoints, {
          fill: "",
          stroke: MASK_COLOR,
          strokeWidth: Math.max(5, display.width * 0.018),
          strokeLineCap: "round",
          strokeLineJoin: "round",
          opacity: 0.72,
          selectable: false,
          evented: false,
          name: "mask-draft",
        });
        canvas.add(brush);
      }
    });
    canvas.on("mouse:move", (event) => {
      const native = event.e as MouseEvent;
      if (panning) {
        const viewport = wrapperRef.current;
        if (viewport) {
          viewport.scrollLeft -= native.clientX - lastX;
          viewport.scrollTop -= native.clientY - lastY;
        }
        lastX = native.clientX;
        lastY = native.clientY;
        return;
      }
      if (!drawing || !start) return;
      const pointer = canvas.getPointer(native);
      if (rectangle) {
        rectangle.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          width: Math.abs(pointer.x - start.x),
          height: Math.abs(pointer.y - start.y),
        });
        rectangle.setCoords();
      } else if (brush) {
        brushPoints = [...brushPoints, { x: pointer.x, y: pointer.y }];
        brush.set({ points: brushPoints });
      }
      canvas.requestRenderAll();
    });
    canvas.on("mouse:up", (event) => {
      if (panning) {
        panning = false;
        canvas.setCursor("default");
        return;
      }
      if (!drawing || !start) return;
      const native = event.e as MouseEvent;
      const pointer = canvas.getPointer(native);
      if (interactionRef.current.selectionKind === "rectangle") {
        callbacksRef.current.onRectangleChange(displayRectToRelease({
          left: start.x,
          top: start.y,
          right: pointer.x,
          bottom: pointer.y,
        }, display));
      } else {
        callbacksRef.current.onBrushStroke({
          points: brushPoints.map((point) => displayToRelease(point, display)),
          widthPx: Math.round(RELEASE_CANVAS.width * 0.018),
        });
      }
      drawing = false;
      start = null;
      rectangle = null;
      brush = null;
      brushPoints = [];
    });
    canvas.on("selection:created", (event) => {
      const id = (event.selected?.[0] as fabric.Object & { data?: { assetId?: string } })?.data?.assetId;
      if (id) callbacksRef.current.onSelectLayer(id);
    });
    const emitTransform = (event: fabric.IEvent) => {
      const object = event.target as fabric.Object & { data?: { assetId?: string; baseScale?: number; placementBounds?: ReleaseBounds } };
      const interaction = interactionRef.current;
      const transformEnabled = (interaction.mode === "edit-lab" && interaction.candidateEditingEnabled)
        || (interaction.mode === "family-fit" && interaction.placementEditingEnabled);
      if (!object?.data?.assetId || !transformEnabled) return;
      const baseScale = object.data.baseScale ?? 1;
      const releaseLeft = (object.left ?? 0) * RELEASE_CANVAS.width / display.width;
      const releaseTop = (object.top ?? 0) * RELEASE_CANVAS.height / display.height;
      const relativeScale = (object.scaleX ?? baseScale) / baseScale;
      if (interaction.mode === "family-fit" && object.data.placementBounds) {
        callbacksRef.current.onTransformChange(placementTransformFromObject({
          left: releaseLeft,
          top: releaseTop,
          scale: relativeScale,
          bounds: object.data.placementBounds,
        }));
        return;
      }
      callbacksRef.current.onTransformChange({
        translateXPx: Math.round(releaseLeft),
        translateYPx: Math.round(releaseTop),
        scaleX: relativeScale,
        scaleY: (object.scaleY ?? baseScale) / baseScale,
      });
    };
    canvas.on("object:moving", emitTransform);
    canvas.on("object:scaling", emitTransform);
    canvas.on("object:modified", emitTransform);

    return () => {
      (canvas as fabric.Canvas & { cancelRequestedRender?: () => void }).cancelRequestedRender?.();
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [display]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    canvas.clear();
    canvas.backgroundColor = "#F5F3EF";
    const baseScale = display.width / RELEASE_CANVAS.width;

    const addGuides = () => {
      if (!guidesVisible) return;
      const vertical = releaseToDisplay({ x: 1041, y: 0 }, display).x;
      const seat = releaseToDisplay({ x: 0, y: contactGuideYPx }, display).y;
      const baseline = releaseToDisplay({ x: 0, y: 2068 }, display).y;
      [
        new fabric.Line([vertical, 0, vertical, display.height], { stroke: GUIDE_COLOR, strokeWidth: 1, opacity: 0.62, strokeDashArray: [4, 5] }),
        new fabric.Line([0, seat, display.width, seat], { stroke: "#61d6c8", strokeWidth: 1, opacity: 0.64, strokeDashArray: [6, 4] }),
        new fabric.Line([0, baseline, display.width, baseline], { stroke: "#c98068", strokeWidth: 1, opacity: 0.55, strokeDashArray: [3, 5] }),
      ].forEach((guide, index) => {
        guide.set({ selectable: false, evented: false, name: `guide-${index}` });
        canvas.add(guide);
      });
      const selected = layers.find((asset) => asset.componentVersionId === selectedLayerId);
      if (selected) {
        const selectedTransform = selected.slot === "body" ? { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 } : layerTransformRef.current;
        const start = releaseToDisplay({
          x: selected.alphaBounds.left * selectedTransform.scaleX + selectedTransform.translateXPx,
          y: selected.alphaBounds.top * selectedTransform.scaleY + selectedTransform.translateYPx,
        }, display);
        const end = releaseToDisplay({
          x: selected.alphaBounds.right * selectedTransform.scaleX + selectedTransform.translateXPx,
          y: selected.alphaBounds.bottom * selectedTransform.scaleY + selectedTransform.translateYPx,
        }, display);
        canvas.add(new fabric.Rect({
          left: start.x,
          top: start.y,
          width: end.x - start.x,
          height: end.y - start.y,
          fill: "rgba(0,0,0,0)",
          stroke: GUIDE_COLOR,
          strokeWidth: 1,
          strokeDashArray: [2, 3],
          selectable: false,
          evented: false,
          name: "guide-alpha-bounds",
        }));
      }
    };

    const addLayer = (asset: ReleaseAsset) => new Promise<void>((resolve) => {
      fabric.Image.fromURL(asset.imageUrl, (image) => {
        if (cancelled) return resolve();
        const editable = asset.slot !== "body"
          && asset.componentVersionId === selectedLayerId
          && ((mode === "edit-lab" && candidateEditingEnabled) || (mode === "family-fit" && placementEditingEnabled));
        const transform = asset.slot === "body" ? { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 } : layerTransformRef.current;
        const cropForPlacement = mode === "family-fit" && editable;
        const releasePosition = cropForPlacement
          ? placementObjectOrigin(asset.alphaBounds, transform)
          : { x: transform.translateXPx, y: transform.translateYPx };
        const position = releaseToDisplay(releasePosition, display);
        image.set({
          left: position.x,
          top: position.y,
          originX: "left",
          originY: "top",
          scaleX: baseScale * transform.scaleX,
          scaleY: baseScale * transform.scaleY,
          selectable: editable,
          evented: editable,
          lockUniScaling: true,
          hasRotatingPoint: false,
          transparentCorners: false,
          cornerColor: GUIDE_COLOR,
          borderColor: GUIDE_COLOR,
          name: `asset-${asset.componentVersionId}`,
          data: { assetId: asset.componentVersionId, baseScale, placementBounds: cropForPlacement ? asset.alphaBounds : undefined },
        });
        if (cropForPlacement) {
          image.set({
            cropX: asset.alphaBounds.left,
            cropY: asset.alphaBounds.top,
            width: asset.alphaBounds.right - asset.alphaBounds.left + 1,
            height: asset.alphaBounds.bottom - asset.alphaBounds.top + 1,
          });
        }
        image.setControlsVisibility({ mtr: false, mt: false, mb: false, ml: false, mr: false });
        canvas.add(image);
        resolve();
      }, { crossOrigin: "anonymous" });
    });

    const render = async () => {
      for (const layer of layers) await addLayer(layer);
      if (cancelled) return;
      const selected = layers.find((asset) => asset.componentVersionId === selectedLayerId);
      if (maskVisible && selected?.geometryMaskUrl) {
        await new Promise<void>((resolve) => fabric.Image.fromURL(selected.geometryMaskUrl!, (image) => {
          if (!cancelled) {
            const transform = selected.slot === "body" ? { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 } : layerTransformRef.current;
            const position = releaseToDisplay({ x: transform.translateXPx, y: transform.translateYPx }, display);
            image.set({
              left: position.x,
              top: position.y,
              originX: "left",
              originY: "top",
              scaleX: baseScale * transform.scaleX,
              scaleY: baseScale * transform.scaleY,
              opacity: 0.2,
              selectable: false,
              evented: false,
              name: "authority-mask-overlay",
            });
            canvas.add(image);
          }
          resolve();
        }, { crossOrigin: "anonymous" }));
      }
      if (cancelled) return;
      addGuides();
      canvas.renderAll();
    };
    void render();
    return () => { cancelled = true; };
  }, [candidateEditingEnabled, contactGuideYPx, display, guidesVisible, layers, maskVisible, mode, placementEditingEnabled, selectedLayerId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedLayerId) return;
    const object = canvas.getObjects().find((item) => item.name === `asset-${selectedLayerId}`);
    const objectData = (object as fabric.Object & { data?: { baseScale?: number; placementBounds?: ReleaseBounds } } | undefined)?.data;
    const releasePosition = objectData?.placementBounds
      ? placementObjectOrigin(objectData.placementBounds, layerTransform)
      : { x: layerTransform.translateXPx, y: layerTransform.translateYPx };
    const position = releaseToDisplay(releasePosition, display);
    const baseScale = objectData?.baseScale ?? display.width / RELEASE_CANVAS.width;
    if (object) {
      object.set({
        left: position.x,
        top: position.y,
        scaleX: baseScale * layerTransform.scaleX,
        scaleY: baseScale * layerTransform.scaleY,
      });
      object.setCoords();
    }
    const maskOverlay = canvas.getObjects().find((item) => item.name === "authority-mask-overlay");
    if (maskOverlay) {
      const maskPosition = releaseToDisplay({ x: layerTransform.translateXPx, y: layerTransform.translateYPx }, display);
      maskOverlay.set({
        left: maskPosition.x,
        top: maskPosition.y,
        scaleX: baseScale * layerTransform.scaleX,
        scaleY: baseScale * layerTransform.scaleY,
      });
      maskOverlay.setCoords();
    }
    const selected = layers.find((asset) => asset.componentVersionId === selectedLayerId);
    const boundsGuide = canvas.getObjects().find((item) => item.name === "guide-alpha-bounds");
    if (selected && selected.slot !== "body" && boundsGuide) {
      const start = releaseToDisplay({
        x: selected.alphaBounds.left * layerTransform.scaleX + layerTransform.translateXPx,
        y: selected.alphaBounds.top * layerTransform.scaleY + layerTransform.translateYPx,
      }, display);
      const end = releaseToDisplay({
        x: selected.alphaBounds.right * layerTransform.scaleX + layerTransform.translateXPx,
        y: selected.alphaBounds.bottom * layerTransform.scaleY + layerTransform.translateYPx,
      }, display);
      boundsGuide.set({ left: start.x, top: start.y, width: end.x - start.x, height: end.y - start.y });
      boundsGuide.setCoords();
    }
    canvas.requestRenderAll();
  }, [display, layerTransform, layers, selectedLayerId]);

  const selected = useMemo(
    () => layers.find((asset) => asset.componentVersionId === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const stageSize = useMemo(() => canvasStageSize(display, zoom), [display, zoom]);

  const setCanvasZoom = (next: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clamped = Math.max(0.5, Math.min(4, next));
    setZoom(clamped);
  };

  const resetView = () => {
    setZoom(1);
    wrapperRef.current?.scrollTo({ left: 0, top: 0 });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(0,0,0,0.18)" }}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCanvasZoom(zoom - 0.2)} className="rounded p-1.5 hover:bg-white/5" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
          <span className="min-w-12 text-center font-mono text-[10px]" style={{ color: "var(--darkroom-text-muted)" }}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setCanvasZoom(zoom + 0.2)} className="rounded p-1.5 hover:bg-white/5" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={resetView} className="rounded p-1.5 hover:bg-white/5" aria-label="Fit canvas"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setGuidesVisible((visible) => !visible)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] uppercase tracking-wider hover:bg-white/5" style={{ color: guidesVisible ? GUIDE_COLOR : "var(--darkroom-text-dim)" }}>
            <Crosshair className="h-3.5 w-3.5" />Guides
          </button>
          <button type="button" onClick={() => setMaskVisible((visible) => !visible)} disabled={!selected?.geometryMaskUrl} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] uppercase tracking-wider hover:bg-white/5 disabled:opacity-35" style={{ color: maskVisible ? MASK_COLOR : "var(--darkroom-text-dim)" }}>
            {maskVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}Mask
          </button>
        </div>
      </div>
      <div
        ref={wrapperRef}
        role="region"
        aria-label="Scrollable Paper-Doll canvas viewport"
        tabIndex={0}
        className="relative mx-auto w-full overflow-auto overscroll-contain rounded border shadow-[0_24px_80px_rgba(0,0,0,0.28)] focus:outline-none focus:ring-1 focus:ring-[#d7a85f]/50"
        style={{ borderColor: "rgba(215,168,95,0.32)", maxWidth: 760, maxHeight: "min(70vh, 760px)", scrollbarGutter: "stable" }}
      >
        <div className="relative mx-auto" style={{ width: stageSize.width, height: stageSize.height }}>
          <div className="relative origin-top-left" style={{ width: display.width, height: display.height, transform: `scale(${zoom})` }}>
            <canvas ref={canvasElementRef} aria-label="Paper-Doll assembly edit canvas" />
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/65 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/60">
              Scroll to move · ⌘/Ctrl-wheel to zoom · Alt-drag to pan · {RELEASE_CANVAS.width}×{RELEASE_CANVAS.height}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
