import type { PsdIdentityStatus } from "./bestBottlesPsdCapStateAudit";

export interface CanonicalTruthRow {
  website_sku: string;
  grace_sku: string;
  family: string;
  [key: string]: string;
}

export interface ReviewedPsdAlias {
  sourceToken: string;
  websiteSku: string;
  graceSku: string;
  reviewedBy: string;
  reviewedAt: string;
}

export interface CanonicalIdentityIndex {
  byWebsiteSku: Map<string, CanonicalTruthRow[]>;
  byGraceSku: Map<string, CanonicalTruthRow[]>;
}

export interface PsdIdentityJoinResult {
  status: PsdIdentityStatus;
  row: CanonicalTruthRow | null;
  reasons: string[];
}

function normalizeIdentityKey(value: unknown): string {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function appendIndexRow(
  index: Map<string, CanonicalTruthRow[]>,
  key: string,
  row: CanonicalTruthRow,
): void {
  if (key === "") {
    return;
  }
  index.set(key, [...(index.get(key) ?? []), row]);
}

export function buildCanonicalIdentityIndex(
  rows: readonly CanonicalTruthRow[],
): CanonicalIdentityIndex {
  const byWebsiteSku = new Map<string, CanonicalTruthRow[]>();
  const byGraceSku = new Map<string, CanonicalTruthRow[]>();

  for (const row of rows) {
    appendIndexRow(byWebsiteSku, normalizeIdentityKey(row.website_sku), row);
    appendIndexRow(byGraceSku, normalizeIdentityKey(row.grace_sku), row);
  }

  return { byWebsiteSku, byGraceSku };
}

function rowFingerprint(row: CanonicalTruthRow): string {
  return JSON.stringify(
    Object.entries(row)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function distinctRows(rows: readonly CanonicalTruthRow[]): CanonicalTruthRow[] {
  const byFingerprint = new Map<string, CanonicalTruthRow>();
  for (const row of rows) {
    byFingerprint.set(rowFingerprint(row), row);
  }
  return [...byFingerprint.values()];
}

function resolveExact(
  index: Map<string, CanonicalTruthRow[]>,
  token: string,
): { kind: "unmatched" } | { kind: "unique"; row: CanonicalTruthRow } | { kind: "ambiguous" } {
  const matches = distinctRows(index.get(normalizeIdentityKey(token)) ?? []);
  if (matches.length === 0) {
    return { kind: "unmatched" };
  }
  if (matches.length > 1) {
    return { kind: "ambiguous" };
  }
  return { kind: "unique", row: matches[0] };
}

function hasToken(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function rowsAreEquivalent(left: CanonicalTruthRow, right: CanonicalTruthRow): boolean {
  return rowFingerprint(left) === rowFingerprint(right);
}

function aliasHasCompleteProvenance(alias: ReviewedPsdAlias): boolean {
  return [
    alias.sourceToken,
    alias.websiteSku,
    alias.graceSku,
    alias.reviewedBy,
    alias.reviewedAt,
  ].every((value) => typeof value === "string" && value.trim() !== "");
}

function joinReviewedAlias(input: {
  sourceToken: string;
  index: CanonicalIdentityIndex;
  aliases: readonly ReviewedPsdAlias[];
  reasons: string[];
}): PsdIdentityJoinResult {
  const normalizedSourceToken = normalizeIdentityKey(input.sourceToken);
  const tokenAliases = input.aliases.filter(
    (alias) => normalizeIdentityKey(alias.sourceToken) === normalizedSourceToken,
  );
  const completeAliases = tokenAliases.filter(aliasHasCompleteProvenance);

  if (completeAliases.length === 0) {
    if (tokenAliases.length > 0) {
      input.reasons.push("A matching alias was ignored because it has incomplete provenance.");
    } else {
      input.reasons.push(`Source token ${normalizedSourceToken} did not match a reviewed alias.`);
    }
    return { status: "unmatched", row: null, reasons: input.reasons };
  }

  const aliasRows: CanonicalTruthRow[] = [];
  for (const alias of completeAliases) {
    const websiteMatch = resolveExact(input.index.byWebsiteSku, alias.websiteSku);
    const graceMatch = resolveExact(input.index.byGraceSku, alias.graceSku);

    if (websiteMatch.kind === "ambiguous" || graceMatch.kind === "ambiguous") {
      input.reasons.push("A reviewed alias target maps to duplicate canonical SKU rows.");
      return { status: "ambiguous", row: null, reasons: input.reasons };
    }
    if (websiteMatch.kind === "unmatched" || graceMatch.kind === "unmatched") {
      input.reasons.push("A reviewed alias target did not resolve both canonical SKUs.");
      return { status: "unmatched", row: null, reasons: input.reasons };
    }
    if (!rowsAreEquivalent(websiteMatch.row, graceMatch.row)) {
      input.reasons.push("The reviewed alias website and Grace SKUs identify different canonical rows.");
      return { status: "conflict", row: null, reasons: input.reasons };
    }
    aliasRows.push(websiteMatch.row);
  }

  const distinctAliasRows = distinctRows(aliasRows);
  if (distinctAliasRows.length > 1) {
    input.reasons.push("Multiple reviewed aliases for the source token identify different canonical rows.");
    return { status: "conflict", row: null, reasons: input.reasons };
  }

  input.reasons.push(`Matched exact reviewed alias token ${normalizedSourceToken}.`);
  return { status: "reviewed-alias", row: distinctAliasRows[0], reasons: input.reasons };
}

export function joinPsdSourceIdentity(input: {
  websiteSku: string | null;
  graceSku: string | null;
  sourceToken?: string | null;
  index: CanonicalIdentityIndex;
  aliases: readonly ReviewedPsdAlias[];
}): PsdIdentityJoinResult {
  const reasons: string[] = [];

  if (hasToken(input.websiteSku)) {
    const normalizedWebsiteSku = normalizeIdentityKey(input.websiteSku);
    const websiteMatch = resolveExact(input.index.byWebsiteSku, input.websiteSku);
    if (websiteMatch.kind === "ambiguous") {
      reasons.push(`Duplicate website SKU ${normalizedWebsiteSku} maps to non-equivalent canonical rows.`);
      return { status: "ambiguous", row: null, reasons };
    }
    if (websiteMatch.kind === "unmatched") {
      reasons.push(`Supplied website SKU ${normalizedWebsiteSku} did not match a canonical row.`);
      if (hasToken(input.graceSku)) {
        const graceMatch = resolveExact(input.index.byGraceSku, input.graceSku);
        if (graceMatch.kind === "unique") {
          reasons.push("An exact Grace SKU match was retained as lower-priority evidence but not used.");
        } else if (graceMatch.kind === "ambiguous") {
          reasons.push("The supplied lower-priority Grace SKU maps to duplicate canonical rows.");
        } else {
          reasons.push("The supplied lower-priority Grace SKU did not match a canonical row.");
        }
      }
      return { status: "unmatched", row: null, reasons };
    }

    reasons.push(`Matched exact normalized website SKU ${normalizedWebsiteSku}.`);
    if (hasToken(input.graceSku)) {
      const normalizedGraceSku = normalizeIdentityKey(input.graceSku);
      const graceMatch = resolveExact(input.index.byGraceSku, input.graceSku);
      if (graceMatch.kind === "unique" && !rowsAreEquivalent(websiteMatch.row, graceMatch.row)) {
        reasons.push(`Supplied Grace SKU ${normalizedGraceSku} identifies a different canonical row; website SKU precedence was applied.`);
      } else if (graceMatch.kind === "ambiguous") {
        reasons.push(`Supplied Grace SKU ${normalizedGraceSku} is ambiguous; website SKU precedence was applied.`);
      } else if (graceMatch.kind === "unmatched") {
        reasons.push(`Supplied Grace SKU ${normalizedGraceSku} did not match; website SKU precedence was applied.`);
      }
    }
    return { status: "exact-website-sku", row: websiteMatch.row, reasons };
  }

  if (hasToken(input.graceSku)) {
    const normalizedGraceSku = normalizeIdentityKey(input.graceSku);
    const graceMatch = resolveExact(input.index.byGraceSku, input.graceSku);
    if (graceMatch.kind === "ambiguous") {
      reasons.push(`Duplicate Grace SKU ${normalizedGraceSku} maps to non-equivalent canonical rows.`);
      return { status: "ambiguous", row: null, reasons };
    }
    if (graceMatch.kind === "unique") {
      reasons.push(`Matched exact normalized Grace SKU ${normalizedGraceSku}.`);
      return { status: "exact-grace-sku", row: graceMatch.row, reasons };
    }
    reasons.push(`Supplied Grace SKU ${normalizedGraceSku} did not match a canonical row.`);
  }

  if (hasToken(input.sourceToken)) {
    return joinReviewedAlias({
      sourceToken: input.sourceToken,
      index: input.index,
      aliases: input.aliases,
      reasons,
    });
  }

  if (reasons.length === 0) {
    reasons.push("No website SKU, Grace SKU, or reviewed alias token was supplied.");
  }
  return { status: "unmatched", row: null, reasons };
}
