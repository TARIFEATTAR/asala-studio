export const EDGE_REFERENCE_IMAGE_MAX_BYTES = 4.5 * 1024 * 1024;
export const GENERATION_REFERENCE_MAX_EDGE = 2048;

export interface PreparedGenerationReference {
  url: string;
  wasPrepared: boolean;
  originalBytes?: number;
  preparedBytes?: number;
  width?: number;
  height?: number;
  mimeType?: string;
}

export function getDataUrlBase64ByteSize(dataUrl: string): number | null {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match?.[1]) return null;

  const base64 = match[1].replace(/\s/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function shouldPrepareReferenceForEdge(byteSize: number | null | undefined): boolean {
  return typeof byteSize === "number" && byteSize > EDGE_REFERENCE_IMAGE_MAX_BYTES;
}

export function getContainedImageDimensions(
  width: number,
  height: number,
  maxEdge = GENERATION_REFERENCE_MAX_EDGE,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const longest = Math.max(safeWidth, safeHeight);

  if (longest <= maxEdge) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch {
    return null;
  }
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function compressBlobForGeneration(
  sourceBlob: Blob,
  maxBytes: number,
  maxEdge: number,
): Promise<PreparedGenerationReference | null> {
  if (typeof document === "undefined") return null;

  const image = await loadBlobImage(sourceBlob);
  if (!image) return null;

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const dimensions = getContainedImageDimensions(sourceWidth, sourceHeight, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  ctx.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  const attempts: Array<{ type: string; quality: number }> = [
    { type: "image/webp", quality: 0.92 },
    { type: "image/webp", quality: 0.86 },
    { type: "image/webp", quality: 0.78 },
    { type: "image/jpeg", quality: 0.9 },
    { type: "image/jpeg", quality: 0.82 },
    { type: "image/jpeg", quality: 0.74 },
  ];

  let bestBlob: Blob | null = null;
  for (const attempt of attempts) {
    const candidate = await canvasToBlob(canvas, attempt.type, attempt.quality);
    if (!candidate) continue;
    bestBlob = candidate;
    if (candidate.size <= maxBytes) break;
  }

  if (!bestBlob) return null;

  return {
    url: await blobToDataUrl(bestBlob),
    wasPrepared: true,
    originalBytes: sourceBlob.size,
    preparedBytes: bestBlob.size,
    width: dimensions.width,
    height: dimensions.height,
    mimeType: bestBlob.type || "image/png",
  };
}

export async function prepareImageReferenceForGeneration(
  imageUrl: string,
  options: {
    maxBytes?: number;
    maxEdge?: number;
  } = {},
): Promise<PreparedGenerationReference> {
  const maxBytes = options.maxBytes ?? EDGE_REFERENCE_IMAGE_MAX_BYTES;
  const maxEdge = options.maxEdge ?? GENERATION_REFERENCE_MAX_EDGE;
  const dataUrlBytes = getDataUrlBase64ByteSize(imageUrl);

  if (dataUrlBytes !== null) {
    if (!shouldPrepareReferenceForEdge(dataUrlBytes)) {
      return { url: imageUrl, wasPrepared: false, originalBytes: dataUrlBytes };
    }

    const blob = await dataUrlToBlob(imageUrl);
    const prepared = blob
      ? await compressBlobForGeneration(blob, maxBytes, maxEdge)
      : null;
    return prepared ?? { url: imageUrl, wasPrepared: false, originalBytes: dataUrlBytes };
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { url: imageUrl, wasPrepared: false };
    }

    const blob = await response.blob();
    if (!shouldPrepareReferenceForEdge(blob.size)) {
      return {
        url: imageUrl,
        wasPrepared: false,
        originalBytes: blob.size,
        mimeType: blob.type || response.headers.get("content-type") || undefined,
      };
    }

    const prepared = await compressBlobForGeneration(blob, maxBytes, maxEdge);
    return prepared ?? {
      url: imageUrl,
      wasPrepared: false,
      originalBytes: blob.size,
      mimeType: blob.type || response.headers.get("content-type") || undefined,
    };
  } catch {
    return { url: imageUrl, wasPrepared: false };
  }
}
