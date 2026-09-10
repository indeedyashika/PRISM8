/**
 * Shared blockchain transaction result contract.
 *
 * Distinguishes genuine on-chain SDK execution from simulated/dry-run execution.
 * Synthetic IDs may only exist when mode === "simulated", and explorerUrl must NEVER
 * be produced for simulated transactions.
 */

export type BlockchainMode = "live" | "simulated";
export type TransactionStatus = "pending" | "confirmed" | "failed";

export interface BlockchainTransactionResult {
  mode: BlockchainMode;
  network: string;
  txHash?: string;
  explorerUrl?: string;
  status: TransactionStatus;
  errorMessage?: string;
}
