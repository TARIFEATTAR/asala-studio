export type ProductSeoGrade = "A" | "B" | "C" | "D" | "F";

export interface ProductSeoAuditInput {
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  productType?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[] | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  heroImageUrl?: string | null;
  heroAltText?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProductSeoAuditResult {
  score: number;
  grade: ProductSeoGrade;
  missingFields: string[];
  warnings: string[];
  isPublicReady: boolean;
  publicCopyUnsafe: boolean;
  recommendations: string[];
}

const INTERNAL_COPY_PATTERNS = [
  /\bProduct Hub\b/i,
  /\bConvex\b/i,
  /\bimage-generation\b/i,
  /\bsync data\b/i,
  /\bpipeline\b/i,
  /\binternal\b/i,
];

const AWKWARD_COPY_PATTERNS = [
  /\bBottle\s+Bottle\b/i,
  /\bBottle\s+with\s+Cap\s+Bottle\b/i,
  /\bPackaging\s+Packaging\b/i,
  /\bProduct\s+Product\b/i,
];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function words(value: string): string[] {
  return value.split(/\s+/).map((word) => word.trim()).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

export function normalizeProductSeoName(value: string): string {
  return value
    .replace(/\bBottle\s+Bottle\b/gi, "Bottle")
    .replace(/\bBottle\s+with\s+Cap\s+Bottle\b/gi, "Bottle with Cap")
    .replace(/\bPackaging\s+Packaging\b/gi, "Packaging")
    .replace(/\bProduct\s+Product\b/gi, "Product")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasInternalSeoLanguage(value: string): boolean {
  return INTERNAL_COPY_PATTERNS.some((pattern) => pattern.test(value));
}

export function hasAwkwardSeoLanguage(value: string): boolean {
  return AWKWARD_COPY_PATTERNS.some((pattern) => pattern.test(value));
}

function gradeFromScore(score: number): ProductSeoGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function lengthWarning(label: string, value: string, min: number, max: number): string | null {
  if (!value) return null;
  if (value.length < min) return `${label} is short (${value.length}/${min}+ chars)`;
  if (value.length > max) return `${label} is long (${value.length}/${max} chars)`;
  return null;
}

export function auditProductSeo(input: ProductSeoAuditInput): ProductSeoAuditResult {
  const metadata = asRecord(input.metadata);
  const seoMetadata = asRecord(metadata.seo);
  const structuredData = asRecord(seoMetadata.structured_data ?? seoMetadata.structuredData);
  const faqs = stringArray(seoMetadata.faqs ?? seoMetadata.faq);
  const heroAltText = text(input.heroAltText) || text(seoMetadata.hero_alt ?? seoMetadata.heroAlt);
  const rawCopyCorpus = [input.seoTitle, input.seoDescription, input.shortDescription, input.longDescription]
    .map(text)
    .filter(Boolean)
    .join("\n");
  const seoTitle = normalizeProductSeoName(text(input.seoTitle));
  const seoDescription = normalizeProductSeoName(text(input.seoDescription));
  const shortDescription = normalizeProductSeoName(text(input.shortDescription));
  const longDescription = normalizeProductSeoName(text(input.longDescription));
  const keywordCount = input.seoKeywords?.filter(Boolean).length ?? stringArray(seoMetadata.keywords).length;
  const copyCorpus = [seoTitle, seoDescription, shortDescription, longDescription].filter(Boolean).join("\n");
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const checks: Array<{ ok: boolean; weight: number; missing?: string; recommendation?: string }> = [
    { ok: Boolean(text(input.name)), weight: 6, missing: "name", recommendation: "Add a clear customer-facing product name." },
    { ok: Boolean(text(input.slug)), weight: 6, missing: "slug", recommendation: "Add a readable URL slug." },
    { ok: Boolean(text(input.category)), weight: 5, missing: "category", recommendation: "Assign the product to a category." },
    { ok: Boolean(text(input.productType)), weight: 5, missing: "product type", recommendation: "Assign product type/family for keyword targeting." },
    { ok: Boolean(seoTitle), weight: 12, missing: "SEO title", recommendation: "Write a concise title tag with size/material/product family." },
    { ok: Boolean(seoDescription), weight: 12, missing: "SEO description", recommendation: "Write a search-result description with product use case and specs." },
    { ok: Boolean(shortDescription), weight: 8, missing: "short description", recommendation: "Add a customer-facing short description." },
    { ok: Boolean(longDescription), weight: 8, missing: "long description", recommendation: "Add a longer description with specs, use cases, and safe claims." },
    { ok: keywordCount >= 3, weight: 7, missing: "SEO keywords", recommendation: "Add at least three product-specific SEO keywords." },
    { ok: Boolean(text(input.heroImageUrl)), weight: 7, missing: "hero image", recommendation: "Assign a public-ready hero image." },
    { ok: Boolean(heroAltText), weight: 6, missing: "hero image alt text", recommendation: "Add descriptive alt text for the primary image." },
    { ok: Object.keys(seoMetadata).length > 0, weight: 6, missing: "SEO metadata", recommendation: "Store generated/review status, FAQ, alt text, and structured SEO metadata." },
    { ok: Object.keys(structuredData).length > 0, weight: 6, missing: "structured data", recommendation: "Add Product schema-ready structured data metadata." },
    { ok: faqs.length > 0, weight: 6, missing: "FAQ content", recommendation: "Add product-level FAQ content for rich-search surfaces." },
  ];

  let score = 0;
  for (const check of checks) {
    if (check.ok) {
      score += check.weight;
    } else {
      if (check.missing) missingFields.push(check.missing);
      if (check.recommendation) recommendations.push(check.recommendation);
    }
  }

  const titleLengthWarning = lengthWarning("SEO title", seoTitle, 45, 70);
  if (titleLengthWarning) warnings.push(titleLengthWarning);
  const descriptionLengthWarning = lengthWarning("SEO description", seoDescription, 120, 160);
  if (descriptionLengthWarning) warnings.push(descriptionLengthWarning);

  if (longDescription && words(longDescription).length < 45) {
    warnings.push(`Long description is thin (${words(longDescription).length}/45+ words)`);
  }

  if (copyCorpus && hasInternalSeoLanguage(copyCorpus)) {
    warnings.push("Public copy contains internal workflow language");
    recommendations.push("Move operational/PIM language into internal metadata and rewrite public copy for customers.");
  }

  if (rawCopyCorpus && hasAwkwardSeoLanguage(rawCopyCorpus)) {
    warnings.push("Public copy contains awkward repeated product nouns");
    recommendations.push("Normalize generated product names before publishing SEO copy.");
  }

  if (text(input.slug) && /[_A-Z]/.test(text(input.slug))) {
    warnings.push("Slug should be lowercase kebab-case");
  }

  score = Math.max(0, Math.min(100, score - Math.min(warnings.length * 3, 18)));
  const grade = gradeFromScore(score);
  const publicCopyUnsafe = warnings.some((warning) =>
    warning.includes("internal workflow language") || warning.includes("awkward repeated product nouns"),
  );

  return {
    score,
    grade,
    missingFields,
    warnings,
    isPublicReady: score >= 80 && missingFields.length === 0 && !publicCopyUnsafe,
    publicCopyUnsafe,
    recommendations: [...new Set(recommendations)],
  };
}
