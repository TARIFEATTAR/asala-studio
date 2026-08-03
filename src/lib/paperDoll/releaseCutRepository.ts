import { z } from "zod";

import { ReleaseCutRequestSchema, type ReleaseCutRequest } from "./releaseCutContract";

interface FunctionClient {
  functions: {
    invoke(name: string, options: { body: unknown }): Promise<{
      data: unknown;
      error: { message: string; context?: { json?: () => Promise<unknown> } } | null;
    }>;
  };
}

const ReleaseCutResultSchema = z.object({
  releaseId: z.string().uuid(),
  releaseCutId: z.string().uuid(),
  publishRunId: z.string().uuid(),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  releaseStatus: z.enum(["blocked", "ready"]),
  readiness: z.object({ ready: z.coerce.number().int().nonnegative(), incomplete: z.coerce.number().int().nonnegative() }),
  draftDocumentId: z.string().regex(/^drafts\.[A-Za-z0-9._-]+$/),
  publicDocumentId: z.string().regex(/^(?!drafts\.)[A-Za-z0-9._-]+$/),
  sanityPublished: z.literal(false),
});

export type ReleaseCutResult = z.infer<typeof ReleaseCutResultSchema>;

const SanityDraftSyncResultSchema = z.object({
  publishRunId: z.string().uuid(),
  documentId: z.string().regex(/^drafts\.[A-Za-z0-9._-]+$/),
  status: z.literal("draft_synced"),
  storefrontReady: z.boolean(),
  readiness: z.object({ ready: z.coerce.number().int().nonnegative(), incomplete: z.coerce.number().int().nonnegative(), total: z.coerce.number().int().nonnegative() }),
  publicPublished: z.literal(false),
});

const ReadinessSummarySchema = z.object({
  ready: z.coerce.number().int().nonnegative(),
  incomplete: z.coerce.number().int().nonnegative(),
  total: z.coerce.number().int().nonnegative(),
});

const SanityPublicDryRunResultSchema = z.object({
  dryRunId: z.string().uuid(),
  draftSha256: z.string().regex(/^[a-f0-9]{64}$/),
  currentPublicSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  changed: z.boolean(),
  readiness: ReadinessSummarySchema.nullable(),
  publicPublished: z.literal(false),
});

const SanityPublicPublishResultSchema = z.object({
  publishRunId: z.string().uuid(),
  documentId: z.string().regex(/^(?!drafts\.)[A-Za-z0-9._-]+$/),
  status: z.literal("published"),
  draftSha256: z.string().regex(/^[a-f0-9]{64}$/),
  publicPublished: z.literal(true),
});

export type SanityPublicDryRunResult = z.infer<typeof SanityPublicDryRunResultSchema>;

async function readFunctionError(error: { message: string; context?: { json?: () => Promise<unknown> } }): Promise<string> {
  try {
    const body = await error.context?.json?.();
    const parsed = z.object({ error: z.string().min(1) }).safeParse(body);
    if (parsed.success) return parsed.data.error;
  } catch { /* SDK message is the safe fallback. */ }
  return error.message;
}

export async function cutPaperDollRelease(client: FunctionClient, request: ReleaseCutRequest): Promise<ReleaseCutResult> {
  const exact = ReleaseCutRequestSchema.parse(request);
  const { data, error } = await client.functions.invoke("cut-paper-doll-release", { body: exact });
  if (error) throw new Error(`Unable to cut Current Release: ${await readFunctionError(error)}`);
  return ReleaseCutResultSchema.parse(data);
}

export async function syncPaperDollSanityDraft(client: FunctionClient, input: {
  organizationId: string;
  publishRunId: string;
}) {
  const exact = z.object({ organizationId: z.string().uuid(), publishRunId: z.string().uuid() }).parse(input);
  const { data, error } = await client.functions.invoke("sync-paper-doll-sanity-draft", { body: exact });
  if (error) throw new Error(`Unable to sync Sanity draft: ${await readFunctionError(error)}`);
  return SanityDraftSyncResultSchema.parse(data);
}

export async function dryRunPaperDollSanityPublic(client: FunctionClient, input: {
  organizationId: string;
  releaseCutId: string;
}): Promise<SanityPublicDryRunResult> {
  const exact = z.object({ organizationId: z.string().uuid(), releaseCutId: z.string().uuid() }).parse(input);
  const { data, error } = await client.functions.invoke("publish-paper-doll-sanity-release", {
    body: { ...exact, mode: "dry-run" },
  });
  if (error) throw new Error(`Unable to dry-run Sanity publication: ${await readFunctionError(error)}`);
  return SanityPublicDryRunResultSchema.parse(data);
}

export async function publishPaperDollSanityPublic(client: FunctionClient, input: {
  organizationId: string;
  releaseCutId: string;
  dryRunId: string;
  expectedDraftSha256: string;
  approverDisplayName: string;
  approvalNote: string;
}) {
  const exact = z.object({
    organizationId: z.string().uuid(),
    releaseCutId: z.string().uuid(),
    dryRunId: z.string().uuid(),
    expectedDraftSha256: z.string().regex(/^[a-f0-9]{64}$/),
    approverDisplayName: z.string().trim().min(1).max(200),
    approvalNote: z.string().trim().min(1).max(2_000),
  }).parse(input);
  const { data, error } = await client.functions.invoke("publish-paper-doll-sanity-release", {
    body: { ...exact, mode: "publish" },
  });
  if (error) throw new Error(`Unable to publish Sanity release: ${await readFunctionError(error)}`);
  return SanityPublicPublishResultSchema.parse(data);
}
