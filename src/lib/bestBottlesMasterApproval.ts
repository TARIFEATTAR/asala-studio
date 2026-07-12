import {
  approveBestBottlesReconciledImage,
  recordBestBottlesGeneratedImageForSkuJob,
} from "@/lib/bestBottlesImageReconciliation";

export interface BestBottlesGeneratedMasterApprovalInput {
  organizationId: string;
  pipelineSkuJobId: string;
  imageId: string;
}

export interface BestBottlesGeneratedMasterApprovalOperations {
  link: (input: BestBottlesGeneratedMasterApprovalInput) => Promise<void>;
  approve: (input: BestBottlesGeneratedMasterApprovalInput) => Promise<void>;
}

const rpcBackedApprovalOperations: BestBottlesGeneratedMasterApprovalOperations = {
  link: recordBestBottlesGeneratedImageForSkuJob,
  approve: approveBestBottlesReconciledImage,
};

/**
 * Explicit Studio approval is also the safe replacement path for jobs already
 * marked approved/pushed/synced. The generation callback intentionally avoids
 * mutating those terminal rows, so approval must establish the idempotent image
 * assignment before invoking the strict product-truth/framing approval gate.
 */
export async function approveBestBottlesGeneratedMaster(
  input: BestBottlesGeneratedMasterApprovalInput,
  operations: BestBottlesGeneratedMasterApprovalOperations = rpcBackedApprovalOperations,
): Promise<void> {
  await operations.link(input);
  await operations.approve(input);
}
