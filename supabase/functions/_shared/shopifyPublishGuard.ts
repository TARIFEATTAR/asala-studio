export type TrustedCylinderShopifyPublishAuthorization = {
  id: string;
  purpose: "shopify-product-image-publish";
  organizationId: string;
  pipelineSkuJobId: string;
  generatedImageId: string;
  websiteSku: string;
  graceSku: string;
  authorizedByUserId: string;
  authorizedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  singleUse: true;
};

export type CylinderShopifyPublishGuardInput = {
  organizationId: string;
  dryRun: boolean;
  isCylinderProduct?: boolean;
  isServiceRoleRequest: boolean;
  authenticatedUserId: string | null;
  organizationMembershipVerified: boolean;
  now: string;
  item: {
    pipelineSkuJobId?: string;
    publishAuthorizationId?: string;
    imageId?: string;
    imageUrl?: string;
    sku?: string;
    websiteSku?: string;
    graceSku?: string;
  };
  trustedAuthorization: TrustedCylinderShopifyPublishAuthorization | null;
  job: null | {
    id?: string | null;
    organization_id?: string | null;
    family?: string | null;
    website_sku?: string | null;
    grace_sku?: string | null;
    shopify_sku?: string | null;
    status?: string | null;
    generated_image_id?: string | null;
    generated_image_url?: string | null;
    approved_image_id?: string | null;
    approved_image_url?: string | null;
  };
  image: null | {
    id: string;
    organization_id: string | null;
    image_url: string;
    library_tags?: string[] | null;
  };
};

export type CylinderShopifyPublishGuardResult =
  | { guarded: false }
  | {
    guarded: true;
    imageUrl: string;
    pipelineSkuJobId: string;
    generatedImageId: string;
    trustedAuthorizationId: string | null;
  };

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function isCylinderFamily(value: string | null | undefined): boolean {
  return /^(?:tall\s+)?cylinder$/i.test(clean(value));
}

export function isCylinderProductSku(
  value: string | null | undefined,
): boolean {
  const sku = clean(value);
  return /^GB-(?:CYL|TCYL)-/i.test(sku) || /^GB(?:Tall)?Cyl/i.test(sku);
}

const MAX_SERVICE_ROLE_TOKEN_BYTES = 8192;

/**
 * Exact, bounded constant-work comparison for the configured service-role
 * credential. JWT payload claims are never treated as server authority.
 */
export function isExactConfiguredServiceRoleToken(
  candidateToken: string,
  configuredToken: string,
): boolean {
  const encoder = new TextEncoder();
  const candidate = encoder.encode(candidateToken);
  const configured = encoder.encode(configuredToken);
  let mismatch = candidate.length ^ configured.length;
  mismatch |= candidate.length === 0 || configured.length === 0 ? 1 : 0;
  mismatch |= candidate.length > MAX_SERVICE_ROLE_TOKEN_BYTES ? 1 : 0;
  mismatch |= configured.length > MAX_SERVICE_ROLE_TOKEN_BYTES ? 1 : 0;
  for (let index = 0; index < MAX_SERVICE_ROLE_TOKEN_BYTES; index += 1) {
    mismatch |= (candidate[index] ?? 0) ^ (configured[index] ?? 0);
  }
  return mismatch === 0;
}

export function isCylinderShopifyGuardRequired(
  input: Pick<
    CylinderShopifyPublishGuardInput,
    "isCylinderProduct" | "item" | "job"
  >,
): boolean {
  return input.isCylinderProduct === true ||
    isCylinderFamily(input.job?.family) ||
    isCylinderProductSku(input.item.sku) ||
    isCylinderProductSku(input.item.websiteSku) ||
    isCylinderProductSku(input.item.graceSku) ||
    isCylinderProductSku(input.job?.website_sku) ||
    isCylinderProductSku(input.job?.grace_sku);
}

export function assertCylinderShopifyPublishAuthorized(
  input: CylinderShopifyPublishGuardInput,
): CylinderShopifyPublishGuardResult {
  if (!isCylinderShopifyGuardRequired(input)) return { guarded: false };
  if (!input.job) {
    throw new Error(
      "Cylinder Shopify publish requires the exact pipeline job identity.",
    );
  }
  const { item, job, image } = input;
  if (
    !clean(item.pipelineSkuJobId) ||
    clean(item.pipelineSkuJobId) !== clean(job.id)
  ) {
    throw new Error(
      "Cylinder Shopify publish requires the exact pipeline job identity.",
    );
  }
  if (clean(job.organization_id) !== clean(input.organizationId)) {
    throw new Error(
      "Cylinder Shopify publish job does not belong to the exact organization.",
    );
  }
  if (
    clean(item.websiteSku) !== clean(job.website_sku) ||
    clean(item.graceSku) !== clean(job.grace_sku) ||
    clean(item.sku) !== clean(job.shopify_sku)
  ) {
    throw new Error(
      "Cylinder Shopify publish product identity does not exactly match the approved job.",
    );
  }
  const imageId = clean(item.imageId);
  if (
    !imageId || !image || image.id !== imageId ||
    image.organization_id !== input.organizationId
  ) {
    throw new Error(
      "Cylinder Shopify publish requires the exact organization-owned generated image.",
    );
  }
  if (
    job.status !== "approved" || job.generated_image_id !== imageId ||
    job.approved_image_id !== imageId
  ) {
    throw new Error(
      "Cylinder Shopify publish requires the exact approved generated image on the job.",
    );
  }
  const statusTags = (image.library_tags ?? []).filter((tag) =>
    tag.startsWith("status:")
  );
  if (statusTags.length !== 1 || statusTags[0] !== "status:approved-keep") {
    throw new Error(
      "Cylinder Shopify publish generated image must have the exact approved-keep review status.",
    );
  }
  const imageUrl = clean(image.image_url);
  if (
    !/^https:\/\//i.test(imageUrl) ||
    clean(job.generated_image_url) !== imageUrl ||
    clean(job.approved_image_url) !== imageUrl ||
    (clean(item.imageUrl) && clean(item.imageUrl) !== imageUrl)
  ) {
    throw new Error(
      "Cylinder Shopify publish rejects arbitrary public URLs; all approved image URLs must match exactly.",
    );
  }
  if (input.dryRun) {
    return {
      guarded: true,
      imageUrl,
      pipelineSkuJobId: clean(job.id),
      generatedImageId: imageId,
      trustedAuthorizationId: null,
    };
  }

  const authorization = input.trustedAuthorization;
  if (
    !authorization || clean(item.publishAuthorizationId) !== authorization.id
  ) {
    throw new Error(
      "Cylinder Shopify write requires explicit trusted server publish authorization.",
    );
  }
  if (
    authorization.purpose !== "shopify-product-image-publish" ||
    authorization.singleUse !== true
  ) {
    throw new Error(
      "Cylinder Shopify trusted server authorization purpose or single-use policy is invalid.",
    );
  }
  if (authorization.organizationId !== input.organizationId) {
    throw new Error(
      "Cylinder Shopify authorization organization does not match.",
    );
  }
  if (authorization.pipelineSkuJobId !== job.id) {
    throw new Error("Cylinder Shopify authorization job does not match.");
  }
  if (authorization.generatedImageId !== imageId) {
    throw new Error(
      "Cylinder Shopify authorization generated image does not match.",
    );
  }
  if (
    authorization.websiteSku !== job.website_sku ||
    authorization.graceSku !== job.grace_sku
  ) {
    throw new Error(
      "Cylinder Shopify authorization product identity does not match.",
    );
  }
  if (
    !clean(authorization.authorizedByUserId) ||
    Number.isNaN(Date.parse(authorization.authorizedAt)) ||
    Number.isNaN(Date.parse(authorization.expiresAt))
  ) {
    throw new Error(
      "Cylinder Shopify trusted server authorization provenance is invalid.",
    );
  }
  if (authorization.consumedAt !== null) {
    throw new Error(
      "Cylinder Shopify trusted server authorization was already consumed and cannot be replayed.",
    );
  }
  if (Date.parse(authorization.expiresAt) <= Date.parse(input.now)) {
    throw new Error(
      "Cylinder Shopify trusted server authorization is expired.",
    );
  }
  if (!input.isServiceRoleRequest) {
    if (!input.organizationMembershipVerified) {
      throw new Error(
        "Cylinder Shopify publish requires verified organization membership.",
      );
    }
    if (
      !input.authenticatedUserId ||
      authorization.authorizedByUserId !== input.authenticatedUserId
    ) {
      throw new Error(
        "Cylinder Shopify authorization does not belong to the authenticated user.",
      );
    }
  }
  return {
    guarded: true,
    imageUrl,
    pipelineSkuJobId: clean(job.id),
    generatedImageId: imageId,
    trustedAuthorizationId: authorization.id,
  };
}

export async function executeCylinderShopifyGuardedMutation<T>(
  input: CylinderShopifyPublishGuardInput,
  mutation: () => Promise<T>,
  claimTrustedAuthorization?: (authorizationId: string) => Promise<boolean>,
): Promise<T> {
  const authorization = assertCylinderShopifyPublishAuthorized(input);
  if (authorization.guarded && !input.dryRun) {
    if (!authorization.trustedAuthorizationId || !claimTrustedAuthorization) {
      throw new Error(
        "Cylinder Shopify write requires an atomic trusted authorization claim.",
      );
    }
    if (
      !await claimTrustedAuthorization(authorization.trustedAuthorizationId)
    ) {
      throw new Error(
        "Cylinder Shopify trusted server authorization was already consumed and cannot be replayed.",
      );
    }
  }
  return mutation();
}
