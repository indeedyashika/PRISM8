import { NextRequest, NextResponse } from "next/server";
import { logHcsAuditEvent } from "@/lib/hedera/hcsAudit";
import { calculateFlowRate } from "@/lib/superfluid/validation";
import { listYieldStreams, upsertYieldStream } from "@/lib/db/repo";
import { DEFAULT_FUSDCX_ADDRESS } from "@/lib/superfluid/client";

export const dynamic = "force-dynamic";

/**
 * RENT SIMULATION ENDPOINT (/api/rent/simulate)
 * 
 * Strict Semantics:
 * - Simulation only: NO FUNDS MOVED (fundsMoved: false).
 * - Used purely for demo modeling, cashflow forecasting, and Superfluid stream rate calculations.
 * - Always returns mode: "simulated", isSimulation: true.
 * - NEVER claims to have executed a real on-chain deposit.
 * - Message format: "Simulating $3,800 rent inflow".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const propertyId = String(body.propertyId || "prop_456_oak_ave").trim();
    const amount = Number(body.amount || 3800);
    const tenantName = body.tenantName || "Acme Residential Tenant Corp";

    const { flowRatePerSecNum, flowRateWeiPerSec } = calculateFlowRate(amount, 10.0);

    const simulationMessage = `Simulating $${amount.toLocaleString()} rent inflow`;
    const simulatedTxId = `sim_calc_${propertyId}_${Date.now()}`;

    // Anchor simulation calculation record to Hedera Consensus Service audit log
    const hcsReceipt = await logHcsAuditEvent(
      {
        event: "TENANT_RENT_SIMULATION_CALCULATED",
        propertyId,
        amount: `$${amount} USD (SIMULATED)`,
        txId: simulatedTxId,
        metadata: {
          isSimulation: true,
          fundsMoved: false,
          tenant: tenantName,
          monthlyRate: amount,
          calculatedFlowRate: flowRatePerSecNum,
          mode: "simulated",
          description: simulationMessage,
          disclaimer: "Demo simulation only - no on-chain funds transferred to YieldVault",
        },
      },
      { isSimulation: true }
    );

    // Update stream calculation in local SQLite repository with strictly SIMULATED status
    const defaultReceiver = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const existingStreams = listYieldStreams(propertyId);
    if (existingStreams.length > 0) {
      for (const s of existingStreams) {
        if (s.status === "ACTIVE") {
          // If the stream was simulated, update its flow rate keeping mode="simulated"
          // If the stream was already live on-chain, update the modeled flow rate without faking txHash
          upsertYieldStream({
            ...s,
            flowRate: flowRateWeiPerSec.toString(),
            monthlyRentUsd: amount,
            updatedAt: Math.floor(Date.now() / 1000),
            // Ensure simulated route never claims on-chain confirmation
            mode: s.mode === "live" && s.txHash ? "live" : "simulated",
            txHash: s.mode === "live" ? s.txHash : null,
          });
        }
      }
    } else {
      upsertYieldStream({
        propertyId,
        tokenAddress: DEFAULT_FUSDCX_ADDRESS,
        sender: "0x0000000000000000000000000000000000000000",
        receiver: defaultReceiver,
        flowRate: flowRateWeiPerSec.toString(),
        monthlyRentUsd: amount,
        sharePercentage: 10.0,
        startedAt: Math.floor(Date.now() / 1000),
        status: "ACTIVE",
        mode: "simulated",
        txHash: null,
        blockNumber: null,
      });
    }

    return NextResponse.json({
      success: true,
      mode: "simulated",
      isSimulation: true,
      fundsMoved: false,
      action: "RENT_SIMULATION",
      message: simulationMessage,
      propertyId,
      simulatedRentAmount: amount,
      currency: "USDC (Wrapped fUSDCx)",
      calculatedFlowRate: flowRatePerSecNum,
      flowRateWeiPerSec: flowRateWeiPerSec.toString(),
      hcsAudit: hcsReceipt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
