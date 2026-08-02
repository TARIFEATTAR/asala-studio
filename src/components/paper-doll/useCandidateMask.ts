import { useCallback, useState } from "react";

import {
  RELEASE_CANVAS,
  type CandidateSelectionKind,
  type Point,
  type ReleaseRect,
} from "./assemblyEditModel";

export interface CandidateBrushStroke {
  points: Point[];
  widthPx: number;
}

export function useCandidateMask() {
  const [rectangle, setRectangle] = useState<ReleaseRect | null>(null);
  const [brushStrokes, setBrushStrokes] = useState<CandidateBrushStroke[]>([]);

  const reset = useCallback(() => {
    setRectangle(null);
    setBrushStrokes([]);
  }, []);

  const addBrushStroke = useCallback((stroke: CandidateBrushStroke) => {
    if (stroke.points.length < 1) return;
    setBrushStrokes((current) => [...current, stroke]);
  }, []);

  const serializeMask = useCallback(async (kind: CandidateSelectionKind): Promise<string> => {
    const canvas = document.createElement("canvas");
    canvas.width = RELEASE_CANVAS.width;
    canvas.height = RELEASE_CANVAS.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Browser could not create the edit mask canvas.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fff";
    context.strokeStyle = "#fff";

    if (kind === "whole-layer") {
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else if (kind === "rectangle" && rectangle) {
      context.fillRect(
        rectangle.left,
        rectangle.top,
        rectangle.right - rectangle.left,
        rectangle.bottom - rectangle.top,
      );
    } else if (kind === "brush") {
      for (const stroke of brushStrokes) {
        context.lineWidth = stroke.widthPx;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        stroke.points.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        if (stroke.points.length === 1) {
          context.arc(stroke.points[0].x, stroke.points[0].y, stroke.widthPx / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.stroke();
        }
      }
    }

    return canvas.toDataURL("image/png");
  }, [brushStrokes, rectangle]);

  return {
    rectangle,
    brushStrokes,
    setRectangle,
    addBrushStroke,
    reset,
    serializeMask,
  };
}
