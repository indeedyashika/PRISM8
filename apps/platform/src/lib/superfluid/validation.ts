import { isAddress, getAddress } from "ethers";

export class SuperfluidValidationError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "SuperfluidValidationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class InvalidReceiverError extends SuperfluidValidationError {
  constructor(receiver: string, reason?: string) {
    super(
      `Invalid stream receiver address "${receiver}"${reason ? `: ${reason}` : ". Must be a valid non-zero EVM address."}`,
      "INVALID_RECEIVER",
      400
    );
  }
}

export class InvalidFlowRateError extends SuperfluidValidationError {
  constructor(flowRate: unknown, reason?: string) {
    super(
      `Invalid flow rate "${String(flowRate)}"${reason ? `: ${reason}` : ". Flow rate must be a strictly positive integer."}`,
      "INVALID_FLOW_RATE",
      400
    );
  }
}

export class WrongNetworkError extends SuperfluidValidationError {
  constructor(actualChainId: number | string, expectedChainId = 84532) {
    super(
      `Wrong network: detected chain ${actualChainId}, expected Base Sepolia (chain ${expectedChainId}).`,
      "WRONG_NETWORK",
      400
    );
  }
}

export class DuplicateStreamError extends SuperfluidValidationError {
  constructor(propertyId: string, receiver: string) {
    super(
      `An active yield stream already exists for property "${propertyId}" and receiver "${receiver}". Use update or pause instead.`,
      "DUPLICATE_STREAM",
      409
    );
  }
}

export class StreamNotFoundError extends SuperfluidValidationError {
  constructor(propertyId: string, receiver: string) {
    super(
      `No active yield stream found for property "${propertyId}" and receiver "${receiver}".`,
      "STREAM_NOT_FOUND",
      404
    );
  }
}

export class InsufficientBalanceError extends SuperfluidValidationError {
  constructor(reason: string) {
    super(`Insufficient balance for Superfluid operation: ${reason}`, "INSUFFICIENT_BALANCE", 400);
  }
}

/**
 * Validates and normalizes an EVM receiver address.
 */
export function validateReceiver(receiver: string): string {
  if (!receiver || typeof receiver !== "string") {
    throw new InvalidReceiverError(String(receiver), "Address string required");
  }
  const trimmed = receiver.trim();
  if (!isAddress(trimmed)) {
    throw new InvalidReceiverError(trimmed, "Malformed Ethereum address");
  }
  const checksummed = getAddress(trimmed);
  if (checksummed === "0x0000000000000000000000000000000000000000") {
    throw new InvalidReceiverError(trimmed, "Cannot stream to the zero address");
  }
  return checksummed;
}

/**
 * Validates that a flow rate is positive and integer-convertible.
 */
export function validateFlowRate(flowRate: number | string | bigint, allowZero = false): bigint {
  try {
    const parsed = BigInt(flowRate);
    if (!allowZero && parsed <= BigInt(0)) {
      throw new InvalidFlowRateError(flowRate, "Flow rate must be greater than zero");
    }
    if (allowZero && parsed < BigInt(0)) {
      throw new InvalidFlowRateError(flowRate, "Flow rate cannot be negative");
    }
    return parsed;
  } catch (err) {
    if (err instanceof SuperfluidValidationError) throw err;
    throw new InvalidFlowRateError(flowRate, "Must be a valid integer representation");
  }
}

/**
 * Deterministically calculates flow rate per second given monthly rent (USD) and investor equity share (percentage).
 * Follows YieldVault.sol specification:
 * 1 month = 30 days = 2,592,000 seconds.
 */
export function calculateFlowRate(
  monthlyRentUsd: number,
  sharePercentage: number
): {
  monthlyInvestorRent: number;
  flowRateWeiPerSec: bigint;
  flowRatePerSecNum: number;
  flowRatePerSecStr: string;
} {
  if (monthlyRentUsd <= 0) {
    throw new SuperfluidValidationError("Monthly rent must be positive", "INVALID_RENT", 400);
  }
  if (sharePercentage <= 0 || sharePercentage > 100) {
    throw new SuperfluidValidationError("Share percentage must be between 0 and 100", "INVALID_SHARE", 400);
  }

  const monthlyInvestorRent = (monthlyRentUsd * sharePercentage) / 100;
  const flowRatePerSecNum = monthlyInvestorRent / 2592000;
  // 18 decimals representation (wei per second)
  const flowRateWeiPerSec = BigInt(Math.floor(flowRatePerSecNum * 1e18));

  return {
    monthlyInvestorRent,
    flowRateWeiPerSec,
    flowRatePerSecNum,
    flowRatePerSecStr: flowRateWeiPerSec.toString(),
  };
}

/**
 * Validates that the active chain matches Base Sepolia (84532).
 */
export function validateNetwork(chainId: number | string): void {
  const num = typeof chainId === "string" ? parseInt(chainId, chainId.startsWith("0x") ? 16 : 10) : chainId;
  if (num !== 84532) {
    throw new WrongNetworkError(num);
  }
}
