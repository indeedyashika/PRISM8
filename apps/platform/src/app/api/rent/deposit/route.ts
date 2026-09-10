import { NextRequest, NextResponse } from "next/server";
import { Contract, parseUnits, encodeBytes32String, id as keccak256Str } from "ethers";
import { logHcsAuditEvent } from "@/lib/hedera/hcsAudit";
import { calculateFlowRate, validateFlowRate } from "@/lib/superfluid/validation";
import { listYieldStreams, upsertYieldStream } from "@/lib/db/repo";
import {
  getBaseSepoliaOperator,
  getBaseSepoliaProvider,
  DEFAULT_FUSDCX_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
} from "@/lib/superfluid/client";

export const dynamic = "force-dynamic";

const YIELD_VAULT_ABI = [
  "function depositRent(bytes32 propertyId, uint256 amount) external",
  "function totalRentDeposited(bytes32 propertyId) external view returns (uint256)",
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

/**
 * LIVE RENT DEPOSIT ENDPOINT (/api/rent/deposit)
 * 
 * Strict Semantics:
 * - Actual on-chain transaction on Base Sepolia.
 * - Actual token transfer or YieldVault deposit.
 * - Real transaction hash from confirmed blockchain transaction.
 * - Real chain confirmation (waits for 1 block confirmation).
 * - Refuses to execute or fabricate a fake hash if keys/gas are missing.
 * - Shows: "Rent deposit submitted", "Transaction confirmed".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const propertyId = String(body.propertyId || "prop_456_oak_ave").trim();
    const amount = Number(body.amount || 3800);
    const tenantName = body.tenantName || "Acme Residential Tenant Corp";
    const vaultAddress = body.vaultAddress || process.env.YIELD_VAULT_ADDRESS;
    const tokenAddress = body.tokenAddress || DEFAULT_FUSDCX_ADDRESS;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, mode: "live", error: "Missing required field: propertyId" },
        { status: 400 }
      );
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, mode: "live", error: "Rent deposit amount must be a positive number" },
        { status: 400 }
      );
    }

    // Check Base Sepolia live operator configuration
    const operator = getBaseSepoliaOperator();
    if (!operator) {
      return NextResponse.json(
        {
          success: false,
          mode: "live",
          error: "LIVE_OPERATOR_NOT_CONFIGURED",
          message:
            "Base Sepolia operator private key is not configured (set SUPERFLUID_PRIVATE_KEY or EVM_OPERATOR_PRIVATE_KEY). Live rent deposit cannot be submitted on-chain without an active signer. For demo forecasting without fund movement, use /api/rent/simulate.",
        },
        { status: 400 }
      );
    }

    const provider = getBaseSepoliaProvider();
    const balance = await provider.getBalance(operator.address);
    if (balance === BigInt(0)) {
      return NextResponse.json(
        {
          success: false,
          mode: "live",
          error: "INSUFFICIENT_GAS_BALANCE",
          message: `Operator wallet ${operator.address} has 0 Base Sepolia ETH for gas. Cannot submit live rent deposit. Use /api/rent/simulate for simulation.`,
        },
        { status: 400 }
      );
    }

    // Submit live on-chain transaction to Base Sepolia
    let tx;
    const amountWei = parseUnits(amount.toString(), 18);

    if (vaultAddress && vaultAddress.startsWith("0x") && vaultAddress.length === 42) {
      // Direct call to deployed YieldVault contract
      const vaultContract = new Contract(vaultAddress, YIELD_VAULT_ABI, operator);
      let propertyBytes32: string;
      try {
        propertyBytes32 = encodeBytes32String(propertyId.slice(0, 31));
      } catch {
        propertyBytes32 = keccak256Str(propertyId);
      }
      tx = await vaultContract.depositRent(propertyBytes32, amountWei);
    } else {
      // Transfer rental token (fUSDCx) to designated receiver/vault escrow on Base Sepolia
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, operator);
      const receiver = body.receiver || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      tx = await tokenContract.transfer(receiver, amountWei);
    }

    // Wait for genuine on-chain block confirmation
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Live rent deposit transaction reverted on Base Sepolia: ${tx.hash}`);
    }

    const txHash = receipt.hash;
    const blockNumber = receipt.blockNumber;
    const basescanUrl = `https://sepolia.basescan.org/tx/${txHash}`;

    // Anchor real on-chain deposit receipt to Hedera Consensus Service audit log
    const hcsReceipt = await logHcsAuditEvent({
      event: "TENANT_RENT_DEPOSITED_ONCHAIN",
      propertyId,
      amount: `$${amount} USD (CONFIRMED)`,
      txId: txHash,
      metadata: {
        mode: "live",
        isSimulation: false,
        fundsMoved: true,
        tenant: tenantName,
        amountUsd: amount,
        txHash,
        blockNumber,
        network: "Base Sepolia",
        chainId: BASE_SEPOLIA_CHAIN_ID,
        basescanUrl,
      },
    });

    // Update the live stream record in SQLite with real on-chain confirmation
    const { flowRateWeiPerSec, flowRatePerSecNum } = calculateFlowRate(amount, 10.0);
    const existingStreams = listYieldStreams(propertyId);
    if (existingStreams.length > 0) {
      for (const s of existingStreams) {
        if (s.status === "ACTIVE") {
          upsertYieldStream({
            ...s,
            flowRate: flowRateWeiPerSec.toString(),
            monthlyRentUsd: amount,
            updatedAt: Math.floor(Date.now() / 1000),
            mode: "live",
            txHash,
            blockNumber,
          });
        }
      }
    } else {
      upsertYieldStream({
        propertyId,
        tokenAddress,
        sender: operator.address,
        receiver: body.receiver || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        flowRate: flowRateWeiPerSec.toString(),
        monthlyRentUsd: amount,
        sharePercentage: 10.0,
        startedAt: Math.floor(Date.now() / 1000),
        status: "ACTIVE",
        mode: "live",
        txHash,
        blockNumber,
      });
    }

    return NextResponse.json({
      success: true,
      mode: "live",
      isSimulation: false,
      fundsMoved: true,
      action: "LIVE_RENT_DEPOSIT",
      message: "Rent deposit submitted",
      confirmation: "Transaction confirmed",
      propertyId,
      amount,
      currency: "USDC (Wrapped fUSDCx)",
      txHash,
      blockNumber,
      basescanUrl,
      explorerUrl: basescanUrl,
      network: "Base Sepolia",
      chainId: BASE_SEPOLIA_CHAIN_ID,
      calculatedFlowRate: flowRatePerSecNum,
      hcsAudit: hcsReceipt,
      depositTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, mode: "live", error: msg }, { status: 500 });
  }
}
