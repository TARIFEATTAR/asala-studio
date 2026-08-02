/**
 * Paper-Doll Rig — canon-driven plate-birth prompt builder.
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 *
 * Every north-star body plate is described by MEASUREMENTS, never by prose
 * written per bottle: body height/width from the canon CSV, neck diameter
 * derived from the GPI thread designation (the leading number IS the neck
 * outer diameter in mm — 17-415 → 17mm, 13-415 → 13mm), and the ratios the
 * model actually needs to get proportion right.
 *
 * Built because a hand-written prompt produced a body 17% too slender
 * (aspect 4.21 vs canon 3.50, 2026-08-01): "70mm tall, 20mm wide" is weak
 * guidance; "the width is 29% of the height — a sturdy cylinder, not a slim
 * vial" is strong. Ratios beat absolute millimetres for a model that has no
 * ruler.
 *
 * Pure module — no I/O.
 */

/** GPI neck finish: leading number = neck outer diameter (mm). */
export function neckDiameterMmFromThread(neckThreadSize: string | null | undefined): number | null {
  const raw = (neckThreadSize ?? "").trim();
  if (!raw) return null;
  // "17-415" | "20-400" | "8-425"
  const gpi = raw.match(/^(\d{1,2})\s*-\s*\d{3}$/);
  if (gpi) return Number(gpi[1]);
  // "17mm" | "16 mm"
  const mm = raw.match(/^(\d{1,2})\s*mm$/i);
  if (mm) return Number(mm[1]);
  return null; // "Ground" and other non-threaded finishes
}

export interface PlateBirthMeasurements {
  family: string;
  capacityMl: number;
  color: string;
  bodyHeightMm: number;
  bodyWidthMm: number;
  neckThreadSize: string;
  /** Overrides the thread-derived value when a measured neck exists. */
  neckDiameterMmOverride?: number | null;
}

export interface PlateBirthGeometry {
  bodyHeightMm: number;
  bodyWidthMm: number;
  neckDiameterMm: number | null;
  /** width ÷ height, as a percentage — the anti-slender anchor. */
  widthToHeightPct: number;
  /** height ÷ width — what the intake aspect gate measures. */
  aspectRatio: number;
  /** neck ÷ body width, as a percentage — the neck-alignment anchor. */
  neckToBodyPct: number | null;
  /** Plain-language read of the silhouette, for the prompt. */
  silhouetteDescriptor: string;
}

export function resolvePlateBirthGeometry(m: PlateBirthMeasurements): PlateBirthGeometry {
  if (!(m.bodyHeightMm > 0) || !(m.bodyWidthMm > 0)) {
    throw new Error("bodyHeightMm and bodyWidthMm must be positive.");
  }
  const neckDiameterMm = m.neckDiameterMmOverride ?? neckDiameterMmFromThread(m.neckThreadSize);
  const aspectRatio = m.bodyHeightMm / m.bodyWidthMm;
  const widthToHeightPct = (m.bodyWidthMm / m.bodyHeightMm) * 100;
  const neckToBodyPct = neckDiameterMm ? (neckDiameterMm / m.bodyWidthMm) * 100 : null;
  const silhouetteDescriptor = aspectRatio >= 5
    ? "a very slender tube"
    : aspectRatio >= 4
      ? "a slender vial"
      : aspectRatio >= 3
        ? "a sturdy, substantial cylinder — noticeably thicker than a slim test-tube vial"
        : aspectRatio >= 2
          ? "a stout, wide-bodied bottle"
          : "a squat, wide bottle";
  return {
    bodyHeightMm: m.bodyHeightMm,
    bodyWidthMm: m.bodyWidthMm,
    neckDiameterMm,
    widthToHeightPct,
    aspectRatio,
    neckToBodyPct,
    silhouetteDescriptor,
  };
}

/**
 * The GEOMETRY LOCK block — the part that must be measurement-exact. Kept
 * separable so the same numbers can be reused by color-transfer prompts.
 */
export function buildGeometryLockBlock(g: PlateBirthGeometry): string {
  const lines = [
    "GEOMETRY LOCK — these proportions are canonical truth and override any impression from the reference:",
    `- Body: ${g.bodyHeightMm.toFixed(0)}mm tall and ${g.bodyWidthMm.toFixed(0)}mm wide. The body width is ${g.widthToHeightPct.toFixed(0)}% of the body height (height:width = ${g.aspectRatio.toFixed(2)}:1).`,
    `- This is ${g.silhouetteDescriptor}. Do NOT slim, narrow, taper, or stretch the body — if in doubt, render it wider rather than narrower.`,
    "- Straight vertical walls of constant width from base to shoulder; flat shoulder; flat base.",
  ];
  if (g.neckDiameterMm && g.neckToBodyPct) {
    lines.push(
      `- Neck finish: ${g.neckDiameterMm.toFixed(0)}mm outer diameter — exactly ${g.neckToBodyPct.toFixed(0)}% of the body width, so the threaded neck is only slightly narrower than the body, joined by a short flat shoulder. Do not render a long tapered or bottleneck-style neck.`,
      "- The threads are shallow, evenly spaced horizontal rings on the neck; the rim is flat and slightly thickened.",
    );
  }
  return lines.join("\n");
}

export interface PlateBirthPromptOptions {
  /** Pass 1 = optics resurrection on a white sweep; Pass 2 = birth on Bone. */
  pass: 1 | 2;
  boneHex?: string;
}

export function buildPlateBirthPrompt(
  m: PlateBirthMeasurements,
  options: PlateBirthPromptOptions,
): string {
  const g = resolvePlateBirthGeometry(m);
  const bone = options.boneHex ?? "#F5F3EF";
  const colorLower = m.color.toLowerCase();
  const isClear = colorLower === "clear";
  const glassName = isClear ? "clear, colorless" : colorLower;

  const header = options.pass === 1
    ? `PHOTOREALISTIC GLASS RESURRECTION — ${m.color.toUpperCase()} ${m.family.toUpperCase()} ${m.capacityMl}ML.`
    : `REFERENCE-LOCKED TRUE-NORTH BODY PLATE — BEST BOTTLES ${m.color.toUpperCase()} ${m.family.toUpperCase()} ${m.capacityMl}ML.`;

  const sourceOfTruth = options.pass === 1
    ? [
        "SOURCE OF TRUTH:",
        `- Image 1 is the exact product: a ${glassName} glass ${m.family.toLowerCase()} bottle, cap off, exposed ${m.neckThreadSize} neck threads. Its identity, thread count and spacing, shoulder line, and base shape are immutable.`,
        "- Image 2 is the optical authority ONLY: reproduce its glass wall definition, edge density, refraction behavior, specular rhythm, and premium finish. Never copy Image 2's shape.",
        "- Where Image 1's proportions disagree with the GEOMETRY LOCK below, the GEOMETRY LOCK wins.",
      ].join("\n")
    : [
        "SOURCE OF TRUTH:",
        `- Image 1 is the product and optical truth: a real ${glassName} glass ${m.family.toLowerCase()} bottle, cap off, exposed ${m.neckThreadSize} neck threads. Preserve its glass behavior, reflections, refraction, and thread detail exactly.`,
        "- Image 2 is optical reference only — maintain the same premium glass standard. Never copy its shape.",
        "- Where Image 1's proportions disagree with the GEOMETRY LOCK below, the GEOMETRY LOCK wins: correct the proportions while keeping the glass character.",
      ].join("\n");

  const task = options.pass === 1
    ? [
        "TASK:",
        "Re-photograph this bottle as a real studio product photo. Image 1 was cut out of an old photo and lost its optics — restore them: this must read as a real glass object on a real studio sweep, not a flat sticker.",
      ].join("\n")
    : [
        "TASK:",
        `Place this exact bottle on the Best Bottles catalog canvas: seamless Bone (${bone}) environment, single bottle, perfectly upright and centered, full bottle visible with generous margin above the rim and below the base.`,
      ].join("\n");

  const optics = isClear
    ? [
        "GLASS OPTICS:",
        "- Empty, colorless, optically clean clear glass. No liquid, tint, haze, cloudy fill, bubbles, residue, or frosted interior.",
        `- The ${options.pass === 1 ? "background" : "Bone environment"} must be visible THROUGH the bottle with natural refraction and slight optical displacement at the walls${options.pass === 2 ? " — the interior reads as displaced warm cream, never white, never gray, never empty paper" : ""}.`,
        "- Soft vertical studio-card reflections; a brighter wall highlight on the right side; crisp definition at the rim, threads, shoulder, and base; the mid-body stays quiet and transparent.",
        "- Visible glass wall thickness at the rim and the base; a subtle darker base ring seen through the glass floor.",
      ].join("\n")
    : [
        "GLASS OPTICS:",
        `- Saturated ${colorLower} transmitted color is the dominant visual identity: deep wall density, strong edge saturation, luminous glow at thin sections (shoulder, neck, rim).`,
        "- The bottle is empty — the color is the glass itself, never liquid. Do not desaturate, wash, or shift the hue.",
        `- The ${options.pass === 1 ? "background" : "Bone environment"} transmits through the walls; the interior reads as deep luminous ${colorLower}, never black, never opaque.`,
        "- Crisp definition at the rim, threads, shoulder, and base; wall highlight on the right side.",
      ].join("\n");

  const environment = options.pass === 1
    ? [
        "BACKGROUND:",
        "Seamless neutral warm-white studio sweep. No props, no horizon line, no text.",
        "No cast shadow — the faintest natural contact darkening at the base only.",
      ].join("\n")
    : [
        "BACKGROUND AND ENVIRONMENT:",
        `- Seamless Bone ${bone} — it must visibly read as warm cream, not white — with no horizon line, tabletop edge, vignette, props, labels, or frame.`,
        "- The glass picks up the warm environment in its reflections; keep the wall highlight on the right side, consistent with one large soft key from the right.",
        "",
        "SHADOW:",
        "NONE. No cast shadow, no contact shadow, no reflection pool beneath the base. The bottle sits clean on Bone; grounding is added later by our system.",
      ].join("\n");

  const forbidden = [
    "FORBIDDEN:",
    "- Any narrowing, slimming, tapering, or stretching of the body away from the GEOMETRY LOCK proportions.",
    "- Barcode-like vertical stripes, painted parallel rails, etched contour lines, hard full-height highlight bands.",
    "- Liquid, cap, roller ball, sprayer, dip tube, label, props, second object, frame, border, or text.",
    isClear
      ? "- Opaque white or gray blocks inside the body; milky or fogged interior."
      : `- Washed-out, grayed, or blackened ${colorLower}; opaque interior.`,
  ].join("\n");

  return [
    header,
    "",
    "COMPOSITION LOCK (staged input):",
    "Image 1 arrives pre-framed on the 2080x2288 canvas at catalog scale. Keep the bottle at that position and size — do not zoom, crop, re-center, or re-scale.",
    "",
    sourceOfTruth,
    "",
    task,
    "",
    buildGeometryLockBlock(g),
    "",
    optics,
    "",
    "LIGHTING:",
    "One large soft key light from the RIGHT, gentle fill, quiet speculars. No hard hotspots, no rim light, no colored reflections.",
    "",
    environment,
    "",
    forbidden,
  ].join("\n");
}
