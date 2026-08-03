import { z } from "zod";

import {
  SharedPlacementLockRequestSchema,
  type SharedPlacementLockRequest,
} from "./placementContract";

interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

interface FunctionClient {
  functions: {
    invoke(name: string, options: { body: unknown }): Promise<{
      data: unknown;
      error: { message: string; context?: { json?: () => Promise<unknown> } } | null;
    }>;
  };
}

const SharedPlacementRecordSchema = z.object({
  id: z.string().uuid(),
  familyKey: z.literal("CYL-9ML"),
  fitmentGeometryKey: z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,179}$/),
  authorityMaskSha256: z.string().regex(/^[a-f0-9]{64}$/),
  canvas: z.object({ widthPx: z.literal(2080), heightPx: z.literal(2288) }),
  transform: z.object({
    translateXPx: z.coerce.number().finite(),
    translateYPx: z.coerce.number().finite(),
    uniformScale: z.coerce.number().finite().positive(),
  }),
  compatibleBodyComponentVersionIds: z.array(z.string().uuid()).length(5),
  approverDisplayName: z.string().min(1),
  approvalNote: z.string().min(1),
  approvedAt: z.string().datetime(),
}).superRefine((value, context) => {
  if (new Set(value.compatibleBodyComponentVersionIds).size !== 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Placement bodies must be unique." });
  }
});

export type SharedPlacementRecord = z.infer<typeof SharedPlacementRecordSchema>;

function parseRecord(value: unknown): SharedPlacementRecord {
  const normalized = value && typeof value === "object" && !Array.isArray(value)
    ? {
        ...value,
        approvedAt: typeof (value as Record<string, unknown>).approvedAt === "string"
          ? ((value as Record<string, unknown>).approvedAt as string).replace(/\+00(?::00)?$/, "Z")
          : (value as Record<string, unknown>).approvedAt,
      }
    : value;
  const parsed = SharedPlacementRecordSchema.safeParse(normalized);
  if (!parsed.success) throw new Error(`Malformed shared placement: ${parsed.error.message}`);
  return parsed.data;
}

async function readFunctionError(error: NonNullable<Awaited<ReturnType<FunctionClient["functions"]["invoke"]>>["error"]>) {
  try {
    const body = await error.context?.json?.();
    const parsed = z.object({ error: z.string().min(1) }).safeParse(body);
    if (parsed.success) return parsed.data.error;
  } catch {
    // Fall back to the SDK message when the response body is unavailable.
  }
  return error.message;
}

export async function loadSharedPlacement(client: RpcClient, input: {
  organizationId: string;
  familyKey: string;
  fitmentGeometryKey: string;
  authorityMaskSha256: string;
}): Promise<SharedPlacementRecord | null> {
  const { data, error } = await client.rpc("get_paper_doll_family_placement", {
    p_organization_id: input.organizationId,
    p_family_key: input.familyKey,
    p_fitment_geometry_key: input.fitmentGeometryKey,
    p_authority_mask_sha256: input.authorityMaskSha256,
  });
  if (error) throw new Error(`Unable to load shared placement: ${error.message}`);
  return data == null ? null : parseRecord(data);
}

export async function lockSharedPlacement(
  client: FunctionClient,
  request: SharedPlacementLockRequest,
): Promise<SharedPlacementRecord> {
  const exactRequest = SharedPlacementLockRequestSchema.parse(request);
  const { data, error } = await client.functions.invoke("lock-paper-doll-placement", { body: exactRequest });
  if (error) throw new Error(`Unable to lock shared placement: ${await readFunctionError(error)}`);
  return parseRecord(data);
}
