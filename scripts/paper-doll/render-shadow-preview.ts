import sharp from 'sharp';
import { detectPlateForegroundBounds } from '../../src/lib/paperDoll/compositeEngine';

/**
 * Contact shadow: an elliptical footprint hugging the base, DARKEST along the
 * contact rim (directly under the base edge where the roundness meets the
 * surface), fading outward. Slight directional sweep toward 2 o'clock.
 */
function paintContactShadow(
  img: { data: Buffer; width: number; height: number },
  cx: number, baseY: number, halfW: number,
  o: { peak: number; spread: number; ry: number; dirX: number; dirY: number; rimTight: number },
) {
  const rx = halfW * (1 + o.spread);
  const ry = rx * o.ry;
  // 2 o'clock = up and to the right in image space
  const ox = cx + halfW * o.dirX;
  const oy = baseY + ry * o.dirY;
  const x0 = Math.max(0, Math.floor(ox - rx * 1.4)), x1 = Math.min(img.width - 1, Math.ceil(ox + rx * 1.4));
  const y0 = Math.max(0, Math.floor(oy - ry * 1.6)), y1 = Math.min(img.height - 1, Math.ceil(oy + ry * 1.6));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - ox) / rx, dy = (y - oy) / ry;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= 1) continue;
      // Darkest at the contact rim (r ≈ rimTight), easing both inward and out.
      const d = Math.abs(r - o.rimTight) / Math.max(o.rimTight, 1 - o.rimTight);
      const w = o.peak * Math.pow(Math.max(0, 1 - d), 1.8);
      const i = (y * img.width + x) * 4;
      img.data[i] = Math.round(img.data[i] * (1 - w) + 0x6e * w);
      img.data[i + 1] = Math.round(img.data[i + 1] * (1 - w) + 0x67 * w);
      img.data[i + 2] = Math.round(img.data[i + 2] * (1 - w) + 0x5e * w);
    }
  }
}

const STYLE = { peak: 0.16, spread: 0.16, ry: 0.10, dirX: 0.10, dirY: -0.35, rimTight: 0.62 };

const PLATES: [string, string][] = [
  ['clear', 'clear-9ml-17415-v3-normalized.png'],
  ['amber', 'amber-final-normalized.png'],
  ['cobalt', 'cobalt-final-normalized.png'],
  ['frosted', 'frosted-v2-normalized.png'],
  ['swirl', 'swirl-v3-normalized.png'],
];

(async () => {
  for (const [name, file] of PLATES) {
    const raw = await sharp('outputs/paper-doll-plates/' + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = detectPlateForegroundBounds({ data: raw.data, width: raw.info.width, height: raw.info.height, hasAlpha: false } as any)!;
    const img = { data: Buffer.from(raw.data), width: raw.info.width, height: raw.info.height };
    const halfW = (b.right - b.left + 1) / 2;
    const cx = Math.round((b.left + b.right) / 2);
    // Preserve everything above the base: shadow lives on the surface only.
    const keep = Buffer.from(img.data.subarray(0, (b.bottom - 2) * img.width * 4));
    paintContactShadow(img, cx, b.bottom, halfW, STYLE);
    img.data.set(keep, 0);
    await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
      .png().toFile('outputs/paper-doll-plates/shadow-preview/FINAL-' + name + '.png');
    console.log('  shadowed:', name, '| base y=' + b.bottom, 'halfW=' + halfW.toFixed(0));
  }
})();
