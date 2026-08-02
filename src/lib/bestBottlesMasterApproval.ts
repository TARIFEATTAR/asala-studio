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
 * Approval must establish the idempotent image assignment before invoking the
 * strict product-truth/framing approval gate. The link RPC fails closed for jobs
 * already approved, pushed, or synced so this helper never replaces an approved
 * image or advances to approval after a terminal-link rejection.
 */
export async function approveBestBottlesGeneratedMaster(
  input: BestBottlesGeneratedMasterApprovalInput,
  operations: BestBottlesGeneratedMasterApprovalOperations = rpcBackedApprovalOperations,
): Promise<void> {
  await operations.link(input);
  await operations.approve(input);
}
