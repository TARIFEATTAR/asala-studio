import type { CandidateProvider, PrivateAssetRef } from "@/lib/paperDoll/candidateJobContract";

export const RELEASE_CANVAS = { width: 2080, height: 2288 } as const;
export type AssemblyEditMode = "release-lock" | "edit-lab";
export type CandidateSelectionKind = "whole-layer" | "rectangle" | "brush";

export interface Point {
  x: number;
  y: number;
}

export interface DisplaySize {
  width: number;
  height: number;
}

export interface ReleaseRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CandidateSelectionDraft {
  componentVersionId: string;
  parentSha256: string;
  provider: CandidateProvider;
  model: string;
  instruction: string;
  source: PrivateAssetRef;
  authoritativeMask: PrivateAssetRef;
  selectionKind: CandidateSelectionKind;
  editMaskDataUrl: string;
  transform: { translateXPx: number; translateYPx: number; scaleX: number; scaleY: number };
}

function assertDisplay(display: DisplaySize): void {
  if (!Number.isFinite(display.width) || !Number.isFinite(display.height) || display.width <= 0 || display.height <= 0) {
    throw new Error("Display dimensions must be positive.");
  }
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function displayToRelease(point: Point, display: DisplaySize): Point {
  assertDisplay(display);
  return {
    x: round(point.x * RELEASE_CANVAS.width / display.width),
    y: round(point.y * RELEASE_CANVAS.height / display.height),
  };
}

export function releaseToDisplay(point: Point, display: DisplaySize): Point {
  assertDisplay(display);
  return {
    x: round(point.x * display.width / RELEASE_CANVAS.width),
    y: round(point.y * display.height / RELEASE_CANVAS.height),
  };
}

export function displayRectToRelease(
  rect: { left: number; top: number; right: number; bottom: number },
  display: DisplaySize,
): ReleaseRect {
  const start = displayToRelease({ x: Math.min(rect.left, rect.right), y: Math.min(rect.top, rect.bottom) }, display);
  const end = displayToRelease({ x: Math.max(rect.left, rect.right), y: Math.max(rect.top, rect.bottom) }, display);
  return {
    left: Math.max(0, Math.min(RELEASE_CANVAS.width, Math.round(start.x))),
    top: Math.max(0, Math.min(RELEASE_CANVAS.height, Math.round(start.y))),
    right: Math.max(0, Math.min(RELEASE_CANVAS.width, Math.round(end.x))),
    bottom: Math.max(0, Math.min(RELEASE_CANVAS.height, Math.round(end.y))),
  };
}

export function canPaintSelection(mode: AssemblyEditMode): boolean {
  return mode === "edit-lab";
}

export function canPersistTransform(input: {
  mode: AssemblyEditMode;
  createsCandidate: boolean;
}): boolean {
  return input.mode === "edit-lab" && input.createsCandidate;
}

export function shouldShowGeometryLocked(input: {
  geometryLocked: boolean;
  geometryGate: string | null;
}): boolean {
  return input.geometryLocked && input.geometryGate === "exact-authoritative-mask-alpha";
}

export function canvasStageSize(display: DisplaySize, zoom: number): DisplaySize {
  assertDisplay(display);
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error("Canvas zoom must be positive.");
  return { width: Math.round(display.width * zoom), height: Math.round(display.height * zoom) };
}

export function shouldZoomCanvasFromWheel(input: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return input.ctrlKey || input.metaKey;
}
