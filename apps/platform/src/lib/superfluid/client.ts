import { Contract, JsonRpcProvider, Wallet, isAddress, getAddress } from "ethers";
import {
  validateReceiver,
  validateFlowRate,
  InsufficientBalanceError,
} from "./validation";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

export const SUPERFLUID_CFA_FORWARDER =
  "0xcfA132E353cB4E398080B9700609bb008eceB125";
export const DEFAULT_FUSDCX_ADDRESS =
  "0x42bb40bF79730451B11f6De1CbA222F17b87Afd7";
export const DEFAULT_FDAIX_ADDRESS =
  "0x9ce2062b085a2268e8d769ffc040f6692315fd2c";

export const CFA_FORWARDER_ABI = [
  "function createFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)",
  "function updateFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)",
  "function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)",
  "function getAccountFlowrate(address token, address account) external view returns (int96 flowRate)",
];

export function getBaseSepoliaProvider(): JsonRpcProvider {
  return new JsonRpcProvider(BASE_SEPOLIA_RPC_URL, {
    name: "base-sepolia",
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
}

export function getBaseSepoliaOperator(): Wallet | null {
  const pk =
    process.env.SUPERFLUID_PRIVATE_KEY ||
    process.env.EVM_OPERATOR_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;
  if (!pk) return null;
  const cleaned = pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
  return new Wallet(cleaned, getBaseSepoliaProvider());
}

export function isBaseSepoliaConfigured(): boolean {
  return !!(
    process.env.SUPERFLUID_PRIVATE_KEY ||
    process.env.EVM_OPERATOR_PRIVATE_KEY ||
    process.env.PRIVATE_KEY
  );
}

export interface OnchainFlowResult {
  mode: "live";
  txHash: string;
  blockNumber: number;
  basescanUrl: string;
  explorerUrl: string;
}

/**
 * Submits a genuine on-chain CFA stream transaction to Base Sepolia and waits for block confirmation.
 */
export async function submitOnchainCfaFlow(
  action: "create" | "update" | "delete",
  params: {
    tokenAddress?: string;
    receiver: string;
    flowRate?: number | string | bigint;
  }
): Promise<OnchainFlowResult> {
  const operator = getBaseSepoliaOperator();
  if (!operator) {
    throw new Error(
      "Base Sepolia operator wallet not configured. Set SUPERFLUID_PRIVATE_KEY or EVM_OPERATOR_PRIVATE_KEY."
    );
  }

  const token = getAddress(params.tokenAddress || DEFAULT_FUSDCX_ADDRESS);
  const receiver = validateReceiver(params.receiver);
  const flowRate =
    action === "delete"
      ? BigInt(0)
      : validateFlowRate(params.flowRate ?? 0, false);

  const provider = getBaseSepoliaProvider();
  const balance = await provider.getBalance(operator.address);
  if (balance === BigInt(0)) {
    throw new InsufficientBalanceError(
      `Operator ${operator.address} has 0 Base Sepolia ETH for transaction gas.`
    );
  }

  const cfaContract = new Contract(
    SUPERFLUID_CFA_FORWARDER,
    CFA_FORWARDER_ABI,
    operator
  );

  let tx;
  if (action === "create") {
    tx = await cfaContract.createFlow(
      token,
      operator.address,
      receiver,
      flowRate,
      "0x"
    );
  } else if (action === "update") {
    tx = await cfaContract.updateFlow(
      token,
      operator.address,
      receiver,
      flowRate,
      "0x"
    );
  } else {
    tx = await cfaContract.deleteFlow(
      token,
      operator.address,
      receiver,
      "0x"
    );
  }

  // Wait for 1 confirmation block
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(
      `Superfluid ${action}Flow transaction failed or reverted on Base Sepolia: ${tx.hash}`
    );
  }

  const basescanUrl = `https://sepolia.basescan.org/tx/${tx.hash}`;
  return {
    mode: "live",
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    basescanUrl,
    explorerUrl: basescanUrl,
  };
}
