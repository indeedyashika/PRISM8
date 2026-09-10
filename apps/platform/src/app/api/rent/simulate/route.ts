import { NextRequest, NextResponse } from "next/server";
import { logHcsAuditEvent } from "@/lib/hedera/hcsAudit";
import { calculateFlowRate } from "@/lib/superfluid/validation";
import { listYieldStreams, upsertYieldStream } from "@/lib/db/repo";
import { DEFAULT_FUSDCX_ADDRESS } from "@/lib/superfluid/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const propertyId = String(body.propertyId || "prop_456_oak_ave").trim();
    const amount = Number(body.amount || 3800);
    const tenantName = body.tenantName || "Acme Residential Tenant Corp";

    const { flowRatePerSecNum, flowRateWeiPerSec } = calculateFlowRate(amount, 10.0);
    const hasHederaKey = !!process.env.HEDERA_OPERATOR_KEY;
    const mode = hasHederaKey ? "live" : "simulated";
    const simulatedTxId = `sim_rent_deposit_${propertyId}_${Date.now()}`;

    // Anchor event to Hedera Consensus Service if live, or record simulated receipt
    const hcsReceipt = await logHcsAuditEvent({
      event: "TENANT_RENT_DEPOSITED",
      propertyId,
      amount: `$${amount} USD`,
      txId: hasHederaKey ? undefined : simulatedTxId,
      metadata: {
        tenant: tenantName,
        monthlyRate: amount,
        calculatedFlowRate: flowRatePerSecNum,
        mode,
      },
    });

    // Update active stream in the SQLite repository for this property
    const defaultReceiver = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const existingStreams = listYieldStreams(propertyId);
    if (existingStreams.length > 0) {
      for (const s of existingStreams) {
        if (s.status === "ACTIVE") {
          upsertYieldStream({
            ...s,
            flowRate: flowRateWeiPerSec.toString(),
            monthlyRentUsd: amount,
            updatedAt: Math.floor(Date.now() / 1000),
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
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      propertyId,
      amountDeposited: amount,
      currency: "USDC (Wrapped fUSDCx)",
      calculatedFlowRate: flowRatePerSecNum,
      flowRateWeiPerSec: flowRateWeiPerSec.toString(),
      hcsAudit: hcsReceipt,
      depositTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
