/**
 * Client-side color-correction pass that snaps a generated image's cream
 * background to an exact target hex. gpt-image-2 only approximates a
 * requested cream — the output drifts a few percent off, leaving a visible
 * seam between the model's cream and the website's #F5F3EF Bone canvas.
 *
 * Approach: sample a "pure background" corner pixel, compute the RGB delta
 * to the target, apply that delta uniformly to every pixel. Background hits
 * the exact target; inside-glass refraction shifts proportionally and
 * harmonizes with the surrounding canvas.
 *
 * Returns a base64 data URL — caller is expected to upload to Supabase
 * Storage (or pipe directly to fal.ai BiRefNet, which accepts data URLs).
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb | null {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const raw = m[1].length === 3
    ? m[1].split("").map((c) => c + c).join("")
    : m[1];
  const n = parseInt(raw, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export interface ColorCorrectOptions {
  /**
   * Where to sample the "pure background" reference pixel. The corner the
   * bottle is least likely to occupy. Default: top-left (most renders place
   * the bottle near vertical center, leaving corners pure background).
   */
  samplePosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** How many pixels in from the chosen corner to sample. Default: 8. */
  sampleInset?: number;
}

/**
 * Sample a background pixel and shift the whole image so that pixel becomes
 * the target hex. Returns a base64 PNG data URL.
 */
export async function colorCorrectToTarget(
  imageUrl: string,
  targetHex: string,
  options: ColorCorrectOptions = {},
): Promise<string> {
  const target = hexToRgb(targetHex);
  if (!target) throw new Error(`Invalid target hex: ${targetHex}`);

  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire 2d canvas context");
  ctx.drawImage(img, 0, 0);

  const inset = options.sampleInset ?? 8;
  const pos = options.samplePosition ?? "top-left";
  const sampleX = pos.includes("right") ? canvas.width - inset : inset;
  const sampleY = pos.includes("bottom") ? canvas.height - inset : inset;

  const sample = ctx.getImageData(sampleX, sampleY, 1, 1).data;
  const sampleRgb: Rgb = { r: sample[0], g: sample[1], b: sample[2] };

  const dr = target.r - sampleRgb.r;
  const dg = target.g - sampleRgb.g;
  const db = target.b - sampleRgb.b;

  // No-op shortcut: if delta is negligible, return original to avoid the
  // re-encode / data-URL roundtrip.
  if (Math.abs(dr) < 2 && Math.abs(dg) < 2 && Math.abs(db) < 2) {
    return canvas.toDataURL("image/png");
  }

  const all = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = all.data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + dr));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + dg));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + db));
    // pixels[i + 3] = alpha — leave untouched
  }
  ctx.putImageData(all, 0, 0);

  return canvas.toDataURL("image/png");
}

/**
 * Convenience: convert a data URL produced by `colorCorrectToTarget` into a
 * Blob suitable for `supabase.storage.from(...).upload()`.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Not a base64 data URL");
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
