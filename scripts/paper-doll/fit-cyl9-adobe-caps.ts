/**
 * Operator lane: fit the ten Adobe-cleaned cap cutouts into the CYL-9ML
 * roll-on overcap authority footprint and clamp alpha byte-exact to the mask.
 *
 * Per cap:
 *   1. alpha-bbox of the Adobe cutout -> uniform cover-fit into the mask bbox
 *      (2% width overfill, 5% top overfill, seat-anchored: bottom sits 2px
 *      below the mask bottom so seat fringe falls outside the silhouette)
 *   2. any mask-interior pixel with weak source coverage is filled from the
 *      nearest well-covered pixel (BFS), partial alpha blended
 *   3. alpha := authority mask alpha byte-exact; 4px outward RGB bleed with
 *      alpha 0 for resample safety
 *
 * Outputs 2080x2288 layer PNGs + index.json (sha256 per layer) + a
 * before/after review sheet against the current release layers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";

const REPO = "/Users/jordanrichter/Projects/Madison Studio/madison-app";
const MASK = resolve(REPO, "assets/paper-doll/authority-masks/cyl9/closure__17-415__rollon-overcap__v2__mask.png");
const ADOBE_DIR = resolve(REPO, "outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/Cap_Adobe");
const RELEASED_DIR = resolve(REPO, "outputs/paper-doll-cap-tier1-clamp/source");
const OUT_ROOT = resolve(REPO, "outputs/paper-doll-cap-adobe-v2");
const LAYER_DIR = resolve(OUT_ROOT, "layers");

const CAPS: Array<{ key: string; file: string; bboxMode?: "alpha" | "non-white" }> = [
    { key: "BKDT", file: "cap_BKDT.png" },
    { key: "MCPR", file: "cap_MCPR.png" },
    { key: "MGLD", file: "cap_MGLD.png" },
    { key: "MSLV", file: "cap__MSLV.png" },
    { key: "PKDT", file: "cap__PKDT.png" },
    { key: "SBLK", file: "cap__SBLK.png" },
    // fully opaque studio shot: background is baked-in white, so the cap is
    // located by color; the authority mask supplies the silhouette anyway
    { key: "SGLD", file: "cap__SGLD.png", bboxMode: "non-white" },
    { key: "SLDT", file: "cap__SLDT.png" },
    { key: "SSLV", file: "cap__SSLV.png" },
    { key: "WHT", file: "cap__WHT.png" },
];

const OVERFILL_X = 1.02;
const OVERFILL_TOP = 1.05;
const SEAT_DROP_PX = 2;
const SOLID = 200;      // source alpha >= this counts as full coverage
const OUT_BLEED = 4;
const BONE = { r: 245, g: 243, b: 239 };

type Raw = { data: Buffer; width: number; height: number };

async function loadRaw(path: string): Promise<Raw> {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}

function alphaBBox(img: Raw, threshold = 8) {
    let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (img.data[(y * img.width + x) * 4 + 3] >= threshold) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) throw new Error("image has no alpha content");
    return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Content bbox for opaque studio shots: any pixel with a channel darker than the white sweep. */
function nonWhiteBBox(img: Raw, whiteFloor = 240) {
    let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            if (Math.min(img.data[i], img.data[i + 1], img.data[i + 2]) < whiteFloor && img.data[i + 3] > 0) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) throw new Error("image has no non-white content");
    return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
    mkdirSync(LAYER_DIR, { recursive: true });

    const mask = await loadRaw(MASK);
    const mb = alphaBBox(mask, 1);
    const maskCenterX = (mb.minX + mb.maxX) / 2;
    console.log(`mask ${mask.width}x${mask.height} bbox x[${mb.minX}..${mb.maxX}] y[${mb.minY}..${mb.maxY}] (${mb.width}x${mb.height}) centerX=${maskCenterX}`);

    const n = mask.width * mask.height;
    const maskAlpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) maskAlpha[i] = Math.min(mask.data[i * 4], mask.data[i * 4 + 3]);
    // some masks are white-on-transparent, some black/white luminance; min(red, alpha) is the clamp doctrine
    let maskArea = 0;
    for (let i = 0; i < n; i++) if (maskAlpha[i] > 0) maskArea++;

    const index: Array<Record<string, unknown>> = [];
    const rows: Buffer[] = [];
    const CELL_W = 300;

    for (const cap of CAPS) {
        const srcPath = resolve(ADOBE_DIR, cap.file);
        const srcMeta = await sharp(srcPath).metadata();
        const src = await loadRaw(srcPath);
        const sb = cap.bboxMode === "non-white" ? nonWhiteBBox(src) : alphaBBox(src);
        if (cap.bboxMode === "non-white") {
            // opaque source: treat every pixel as full coverage so the mask
            // stamp alone defines the silhouette
            for (let i = 0; i < src.width * src.height; i++) src.data[i * 4 + 3] = 255;
        }

        // semi-transparent content share (detects leftover soft shadow / haze)
        let semiPx = 0, contentPx = 0;
        for (let i = 0; i < src.width * src.height; i++) {
            const a = src.data[i * 4 + 3];
            if (a >= 8) contentPx++;
            if (a >= 8 && a < SOLID) semiPx++;
        }

        const srcAspect = sb.width / sb.height;
        const maskAspect = mb.width / mb.height;
        const scale = Math.max(
            (mb.width * OVERFILL_X) / sb.width,
            (mb.height * OVERFILL_TOP) / sb.height,
        );

        // placement of the scaled source bbox on the canvas
        const dstW = Math.round(sb.width * scale);
        const dstH = Math.round(sb.height * scale);
        const dstLeft = Math.round(maskCenterX - dstW / 2);
        const dstTop = Math.round((mb.maxY + SEAT_DROP_PX) - dstH + 1);

        // scale the cropped cutout and splat onto a full canvas
        const scaledBuf = await sharp(srcPath)
            .extract({ left: sb.minX, top: sb.minY, width: sb.width, height: sb.height })
            .resize({ width: dstW, height: dstH, fit: "fill", kernel: "lanczos3" })
            .ensureAlpha()
            .raw()
            .toBuffer();

        const placed = Buffer.alloc(n * 4);
        for (let y = 0; y < dstH; y++) {
            const cy = dstTop + y;
            if (cy < 0 || cy >= mask.height) continue;
            for (let x = 0; x < dstW; x++) {
                const cx = dstLeft + x;
                if (cx < 0 || cx >= mask.width) continue;
                const si = (y * dstW + x) * 4;
                const di = (cy * mask.width + cx) * 4;
                placed[di] = scaledBuf[si];
                placed[di + 1] = scaledBuf[si + 1];
                placed[di + 2] = scaledBuf[si + 2];
                placed[di + 3] = scaledBuf[si + 3];
            }
        }

        // coverage before fill
        let covered = 0;
        for (let i = 0; i < n; i++) {
            if (maskAlpha[i] > 0 && placed[i * 4 + 3] >= SOLID) covered++;
        }

        // BFS fill: seed = well-covered mask pixels; fill weakly covered mask
        // pixels + OUT_BLEED ring outside from nearest seeded neighbor
        const out = Buffer.from(placed);
        const state = new Uint8Array(n);
        let frontier: number[] = [];
        for (let y = 0; y < mask.height; y++) {
            for (let x = 0; x < mask.width; x++) {
                const i = y * mask.width + x;
                if (maskAlpha[i] > 0 && placed[i * 4 + 3] >= SOLID) {
                    state[i] = 1;
                    const edge =
                        (x > 0 && !(maskAlpha[i - 1] > 0 && placed[(i - 1) * 4 + 3] >= SOLID)) ||
                        (x < mask.width - 1 && !(maskAlpha[i + 1] > 0 && placed[(i + 1) * 4 + 3] >= SOLID)) ||
                        (y > 0 && !(maskAlpha[i - mask.width] > 0 && placed[(i - mask.width) * 4 + 3] >= SOLID)) ||
                        (y < mask.height - 1 && !(maskAlpha[i + mask.width] > 0 && placed[(i + mask.width) * 4 + 3] >= SOLID));
                    if (edge) frontier.push(i);
                }
            }
        }
        let filledPx = 0;
        // depth bound: fill everything inside the mask plus the outer bleed ring
        for (let depth = 0; depth < 600 && frontier.length > 0; depth++) {
            const next: number[] = [];
            for (const i of frontier) {
                const x = i % mask.width, y = (i / mask.width) | 0;
                const neighbors = [
                    x > 0 ? i - 1 : -1, x < mask.width - 1 ? i + 1 : -1,
                    y > 0 ? i - mask.width : -1, y < mask.height - 1 ? i + mask.width : -1,
                ];
                for (const j of neighbors) {
                    if (j < 0 || state[j]) continue;
                    const insideMask = maskAlpha[j] > 0;
                    if (!insideMask && depth >= OUT_BLEED) continue; // limit outward bleed
                    const a = out[j * 4 + 3];
                    if (insideMask && a > 0 && a < SOLID) {
                        // blend partial source over bled color
                        const w = a / 255;
                        out[j * 4] = Math.round(out[j * 4] * w + out[i * 4] * (1 - w));
                        out[j * 4 + 1] = Math.round(out[j * 4 + 1] * w + out[i * 4 + 1] * (1 - w));
                        out[j * 4 + 2] = Math.round(out[j * 4 + 2] * w + out[i * 4 + 2] * (1 - w));
                        filledPx++;
                    } else if (insideMask || !insideMask) {
                        out[j * 4] = out[i * 4];
                        out[j * 4 + 1] = out[i * 4 + 1];
                        out[j * 4 + 2] = out[i * 4 + 2];
                        if (insideMask) filledPx++;
                    }
                    state[j] = 1;
                    next.push(j);
                }
            }
            frontier = next;
        }

        // stamp authority alpha byte-exact
        for (let i = 0; i < n; i++) out[i * 4 + 3] = maskAlpha[i];

        const outPath = resolve(LAYER_DIR, `cap__17-415__${cap.key}__adobe-v2.png`);
        await sharp(out, { raw: { width: mask.width, height: mask.height, channels: 4 } }).png().toFile(outPath);
        const png = await sharp(outPath).png().toBuffer();
        const layerSha = createHash("sha256").update(await (await import("node:fs/promises")).readFile(outPath)).digest("hex");

        // verify byte-exact alpha identity vs mask
        const check = await loadRaw(outPath);
        let mismatch = 0;
        for (let i = 0; i < n; i++) if (check.data[i * 4 + 3] !== maskAlpha[i]) mismatch++;

        const coverage = (covered / maskArea) * 100;
        index.push({
            variantKey: cap.key,
            sourceFile: cap.file,
            sourcePx: `${srcMeta.width}x${srcMeta.height}`,
            sourceBBox: `${sb.width}x${sb.height}`,
            semiTransparentShare: +(semiPx / contentPx * 100).toFixed(2),
            aspectDeltaPct: +(((srcAspect - maskAspect) / maskAspect) * 100).toFixed(2),
            scale: +scale.toFixed(4),
            coveragePct: +coverage.toFixed(2),
            filledPx,
            alphaMismatchPx: mismatch,
            layerPath: outPath,
            layerSha256: layerSha,
        });
        console.log(`${cap.key}: src ${srcMeta.width}x${srcMeta.height} bbox ${sb.width}x${sb.height} aspectΔ ${(((srcAspect - maskAspect) / maskAspect) * 100).toFixed(2)}% scale ${scale.toFixed(3)} coverage ${coverage.toFixed(2)}% filled ${filledPx}px alphaMismatch ${mismatch}`);

        // review row: released vs new, full + top zoom
        const pad = 24;
        const fullBox = {
            left: Math.max(0, mb.minX - pad), top: Math.max(0, mb.minY - pad),
            width: mb.width + pad * 2, height: mb.height + pad * 2,
        };
        const zoomBox = {
            left: Math.max(0, mb.minX - 12), top: Math.max(0, mb.minY - 16),
            width: mb.width + 24, height: Math.max(60, Math.round(mb.height * 0.30)),
        };
        const flatten = (buf: Buffer, box: typeof fullBox) => sharp(buf, { raw: { width: mask.width, height: mask.height, channels: 4 } })
            .extract(box).flatten({ background: BONE }).resize({ width: CELL_W }).png().toBuffer();
        const released = await loadRaw(resolve(RELEASED_DIR, `${cap.key}.png`));
        const cells = await Promise.all([
            flatten(released.data, fullBox), flatten(out, fullBox),
            flatten(released.data, zoomBox), flatten(out, zoomBox),
        ]);
        const metas = await Promise.all(cells.map((b) => sharp(b).metadata()));
        const rowH = Math.max(...metas.map((m) => m.height ?? 0)) + 34;
        const row = await sharp({ create: { width: CELL_W * 4 + 30, height: rowH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
            .composite([
                { input: Buffer.from(`<svg width="${CELL_W * 4 + 30}" height="30"><text x="8" y="21" font-family="Helvetica" font-size="17" font-weight="bold" fill="#000">${cap.key}</text><text x="80" y="21" font-family="Helvetica" font-size="14" fill="#666">released | ADOBE-v2 | released-topzoom | ADOBE-v2-topzoom</text></svg>`), left: 0, top: 0 },
                { input: cells[0], left: 10, top: 32 },
                { input: cells[1], left: CELL_W + 15, top: 32 },
                { input: cells[2], left: CELL_W * 2 + 20, top: 32 },
                { input: cells[3], left: CELL_W * 3 + 25, top: 32 },
            ]).png().toBuffer();
        rows.push(row);
        void png;
    }

    const heights = await Promise.all(rows.map(async (r) => (await sharp(r).metadata()).height ?? 0));
    const totalH = heights.reduce((a, b) => a + b + 8, 8);
    let top = 8;
    const composites: sharp.OverlayOptions[] = [];
    rows.forEach((r, i) => { composites.push({ input: r, left: 0, top }); top += heights[i] + 8; });
    const sheetPath = resolve(OUT_ROOT, "adobe-v2-review-sheet.png");
    await sharp({ create: { width: CELL_W * 4 + 30, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite(composites).png().toFile(sheetPath);

    writeFileSync(resolve(OUT_ROOT, "index.json"), JSON.stringify({
        schemaVersion: 1,
        familyKey: "CYL-9ML",
        authorityMaskPath: MASK,
        fit: { overfillX: OVERFILL_X, overfillTop: OVERFILL_TOP, seatDropPx: SEAT_DROP_PX },
        layers: index,
    }, null, 2));
    console.log(`\nsheet: ${sheetPath}`);
    console.log(`index: ${resolve(OUT_ROOT, "index.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
