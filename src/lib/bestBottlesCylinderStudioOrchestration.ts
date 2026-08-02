import type { Product } from "@/integrations/convex/bestBottles";
import {
  applyRoleAwareCanonicalCylinderGeometry,
  buildCylinderCanonicalGeometryContract,
  invokeWithCylinderVerifiedReference,
  verifyCylinderImmutableReferenceBytesForPreset,
  type CylinderCanonicalGeometryContract,
  type CylinderRoleAwareReadinessRow,
  type CylinderVerifiedReferenceBytes,
} from "@/lib/bestBottlesCylinderRoleAuthority";

export type CylinderStudioCanonicalProduct = ReturnType<
  typeof applyRoleAwareCanonicalCylinderGeometry<Product>
>;

export interface CylinderStudioPreparedGeneration {
  product: CylinderStudioCanonicalProduct;
  canonicalGeometryContract: CylinderCanonicalGeometryContract;
  verifiedReference: CylinderVerifiedReferenceBytes;
  referenceCanvas: { width: number; height: number };
}

export async function prepareCylinderStudioGeneration(input: {
  product: Product;
  row: CylinderRoleAwareReadinessRow | null | undefined;
  presetId: string;
  referenceUrl: string | null | undefined;
  preverified?: CylinderVerifiedReferenceBytes | null;
  verifyReference?: typeof verifyCylinderImmutableReferenceBytesForPreset;
}): Promise<CylinderStudioPreparedGeneration> {
  const product = applyRoleAwareCanonicalCylinderGeometry(input.product, input.row);
  const canonicalGeometryContract = buildCylinderCanonicalGeometryContract(input.row);
  const verifiedReference = await invokeWithCylinderVerifiedReference({
    row: input.row,
    presetId: input.presetId,
    referenceUrl: input.referenceUrl,
    preverified: input.preverified,
    verifyReference: input.verifyReference,
    invoke: async (verified) => verified,
  });
  return {
    product,
    canonicalGeometryContract,
    verifiedReference,
    referenceCanvas: { width: verifiedReference.width, height: verifiedReference.height },
  };
}

/**
 * Executable Studio consumer boundary. Both single and batch generation use
 * this function, so tests can prove that canonical geometry and the exact
 * verified byte payload reach the invocation without a second URL retrieval.
 */
export async function orchestrateCylinderStudioGeneration<T>(input: {
  product: Product;
  row: CylinderRoleAwareReadinessRow | null | undefined;
  presetId: string;
  referenceUrl: string | null | undefined;
  prepared?: CylinderStudioPreparedGeneration | null;
  verifyReference?: typeof verifyCylinderImmutableReferenceBytesForPreset;
  invoke: (prepared: CylinderStudioPreparedGeneration) => Promise<T> | T;
}): Promise<T> {
  const prepared = input.prepared ?? await prepareCylinderStudioGeneration({
    product: input.product,
    row: input.row,
    presetId: input.presetId,
    referenceUrl: input.referenceUrl,
    verifyReference: input.verifyReference,
  });
  const canonical = applyRoleAwareCanonicalCylinderGeometry(input.product, input.row);
  const expectedContract = buildCylinderCanonicalGeometryContract(input.row);
  if (
    prepared.product.heightWithoutCap !== canonical.heightWithoutCap
    || prepared.product.heightWithCap !== canonical.heightWithCap
    || prepared.product.diameter !== canonical.diameter
    || prepared.canonicalGeometryContract.sha256 !== expectedContract.sha256
  ) {
    throw new Error("Cylinder Studio preparation drifted from canonical role-aware geometry.");
  }
  await invokeWithCylinderVerifiedReference({
    row: input.row,
    presetId: input.presetId,
    referenceUrl: input.referenceUrl,
    preverified: prepared.verifiedReference,
    verifyReference: input.verifyReference,
    invoke: async (verified) => {
      if (verified !== prepared.verifiedReference) {
        throw new Error("Cylinder Studio invocation replaced the exact verified payload object.");
      }
    },
  });
  return input.invoke(prepared);
}
