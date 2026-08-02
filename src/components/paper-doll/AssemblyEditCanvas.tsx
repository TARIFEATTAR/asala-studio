import { useEffect, useMemo, useRef, useState } from "react";
import { fabric } from "fabric";
import { Crosshair, Eye, EyeOff, Maximize2, Minus, Plus } from "lucide-react";

import type { PaperDollReleaseWorkbenchData } from "@/lib/paperDoll/releaseRepository";
import {
  RELEASE_CANVAS,
  displayRectToRelease,
  displayToRelease,
  releaseToDisplay,
  type AssemblyEditMode,
  type CandidateSelectionKind,
  type ReleaseRect,
} from "./assemblyEditModel";
import type { CandidateBrushStroke } from "./useCandidateMask";

type ReleaseAsset = PaperDollReleaseWorkbenchData["assets"][number];

interface AssemblyEditCanvasProps {
  layers: ReleaseAsset[];
  selectedLayerId: string | null;
  mode: AssemblyEditMode;
  selectionKind: CandidateSelectionKind;
  showGuides: boolean;
  showMaskOverlay: boolean;
  candidateEditingEnabled: boolean;
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
  onSelectLayer,
  onTransformChange,
  onRectangleChange,
  onBrushStroke,
}: AssemblyEditCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const interactionRef = useRef({ mode, selectionKind, selectedLayerId, candidateEditingEnabled });
  const callbacksRef = useRef({ onSelectLayer, onTransformChange, onRectangleChange, onBrushStroke });
  const [display, setDisplay] = useState({ width: 520, height: 572 });
  const [zoom, setZoom] = useState(1);
  const [guidesVisible, setGuidesVisible] = useState(showGuides);
  const [maskVisible, setMaskVisible] = useState(showMaskOverlay);

  interactionRef.current = { mode, selectionKind, selectedLayerId, candidateEditingEnabled };
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
      const next = Math.min(4, Math.max(0.5, canvas.getZoom() * 0.999 ** native.deltaY));
      canvas.zoomToPoint(new fabric.Point(native.offsetX, native.offsetY), next);
      setZoom(next);
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
        const transform = canvas.viewportTransform;
        if (transform) {
          transform[4] += native.clientX - lastX;
          transform[5] += native.clientY - lastY;
          canvas.requestRenderAll();
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
      const object = event.target as fabric.Object & { data?: { assetId?: string; baseScale?: number } };
      if (!object?.data?.assetId || interactionRef.current.mode !== "edit-lab" || !interactionRef.current.candidateEditingEnabled) return;
      const baseScale = object.data.baseScale ?? 1;
      callbacksRef.current.onTransformChange({
        translateXPx: Math.round((object.left ?? 0) * RELEASE_CANVAS.width / display.width),
        translateYPx: Math.round((object.top ?? 0) * RELEASE_CANVAS.height / display.height),
        scaleX: (object.scaleX ?? baseScale) / baseScale,
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
      const seat = releaseToDisplay({ x: 0, y: 1002 }, display).y;
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
        const start = releaseToDisplay({ x: selected.alphaBounds.left, y: selected.alphaBounds.top }, display);
        const end = releaseToDisplay({ x: selected.alphaBounds.right, y: selected.alphaBounds.bottom }, display);
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
        const editable = mode === "edit-lab" && candidateEditingEnabled && asset.slot !== "body" && asset.componentVersionId === selectedLayerId;
        image.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          scaleX: baseScale,
          scaleY: baseScale,
          selectable: editable,
          evented: editable,
          lockUniScaling: true,
          hasRotatingPoint: false,
          transparentCorners: false,
          cornerColor: GUIDE_COLOR,
          borderColor: GUIDE_COLOR,
          name: `asset-${asset.componentVersionId}`,
          data: { assetId: asset.componentVersionId, baseScale },
        });
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
            image.set({
              left: 0,
              top: 0,
              originX: "left",
              originY: "top",
              scaleX: baseScale,
              scaleY: baseScale,
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
  }, [candidateEditingEnabled, display, guidesVisible, layers, maskVisible, mode, selectedLayerId]);

  const selected = useMemo(
    () => layers.find((asset) => asset.componentVersionId === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );

  const setCanvasZoom = (next: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clamped = Math.max(0.5, Math.min(4, next));
    canvas.zoomToPoint(new fabric.Point(display.width / 2, display.height / 2), clamped);
    setZoom(clamped);
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
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
      <div ref={wrapperRef} className="relative mx-auto w-full overflow-hidden rounded border shadow-[0_24px_80px_rgba(0,0,0,0.28)]" style={{ borderColor: "rgba(215,168,95,0.32)", maxWidth: 760, aspectRatio: "10 / 11" }}>
        <canvas ref={canvasElementRef} aria-label="Paper-Doll assembly edit canvas" />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/65 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/60">
          Alt-drag to pan · wheel to zoom · {RELEASE_CANVAS.width}×{RELEASE_CANVAS.height}
        </div>
      </div>
    </div>
  );
}
