import { NextRequest, NextResponse } from "next/server";
import {
  listYieldStreams,
  getYieldStream,
  upsertYieldStream,
  closeYieldStream,
  updateYieldStream,
} from "@/lib/db/repo";
import {
  validateReceiver,
  validateFlowRate,
  DuplicateStreamError,
  StreamNotFoundError,
  SuperfluidValidationError,
} from "@/lib/superfluid/validation";
import {
  DEFAULT_FUSDCX_ADDRESS,
  submitOnchainCfaFlow,
  isBaseSepoliaConfigured,
} from "@/lib/superfluid/client";

export const dynamic = "force-dynamic";

// Ensure a default simulated demo stream exists in the database if empty
function ensureDemoSeed(): void {
  const existing = getYieldStream("prop_456_oak_ave", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  if (!existing) {
    upsertYieldStream({
      propertyId: "prop_456_oak_ave",
      tokenAddress: DEFAULT_FUSDCX_ADDRESS,
      sender: "0x0000000000000000000000000000000000000000",
      receiver: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      flowRate: "1620370370370", // 10% share of $3,800/mo = $380/mo
      monthlyRentUsd: 3800,
      sharePercentage: 10.0,
      startedAt: Math.floor(Date.now() / 1000) - 7200,
      status: "ACTIVE",
      mode: "simulated",
      txHash: null,
      blockNumber: null,
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    ensureDemoSeed();

    const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
    const receiverParam = req.nextUrl.searchParams.get("receiver") || undefined;
    const receiver = receiverParam ? validateReceiver(receiverParam) : undefined;

    const rawStreams = listYieldStreams(propertyId, receiver);

    // Augment with explorer URLs strictly when live and confirmed
    const streams = rawStreams.map((s) => ({
      ...s,
      flowRateNum: Number(s.flowRate),
      explorerUrl:
        s.mode === "live" && s.txHash && !s.txHash.startsWith("sim_")
          ? `https://sepolia.basescan.org/tx/${s.txHash}`
          : undefined,
      basescanUrl:
        s.mode === "live" && s.txHash && !s.txHash.startsWith("sim_")
          ? `https://sepolia.basescan.org/tx/${s.txHash}`
          : undefined,
    }));

    return NextResponse.json({
      success: true,
      count: streams.length,
      streams,
    });
  } catch (err: unknown) {
    if (err instanceof SuperfluidValidationError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to query streams";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const propertyId = String(body.propertyId || "").trim();
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: propertyId" },
        { status: 400 }
      );
    }

    const receiver = validateReceiver(body.receiver);
    const flowRateBigInt = validateFlowRate(body.flowRate);
    const monthlyRentUsd = Number(body.monthlyRentUsd || 3800);
    const sharePercentage = Number(body.sharePercentage || 10.0);
    const tokenAddress = body.tokenAddress || body.token || DEFAULT_FUSDCX_ADDRESS;

    // Check for existing active stream
    const existing = getYieldStream(propertyId, receiver);
    if (existing && existing.status === "ACTIVE" && !body.allowUpdate) {
      throw new DuplicateStreamError(propertyId, receiver);
    }

    let mode: "live" | "simulated" = body.mode === "live" ? "live" : "simulated";
    let txHash: string | null = body.txHash || null;
    let blockNumber: number | null = body.blockNumber || null;

    // If live mode requested and operator configured, submit real on-chain transaction
    if (body.executeOnchain && isBaseSepoliaConfigured()) {
      const onchainResult = await submitOnchainCfaFlow("create", {
        tokenAddress,
        receiver,
        flowRate: flowRateBigInt,
      });
      mode = "live";
      txHash = onchainResult.txHash;
      blockNumber = onchainResult.blockNumber;
    } else if (body.executeOnchain && !isBaseSepoliaConfigured()) {
      // Caller asked for live on-chain, but no keys configured
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot execute on-chain: Base Sepolia operator key not configured. Set SUPERFLUID_PRIVATE_KEY or run in simulation mode.",
          code: "NOT_CONFIGURED",
        },
        { status: 400 }
      );
    }

    const saved = upsertYieldStream({
      propertyId,
      tokenAddress,
      sender: body.sender || "0x0000000000000000000000000000000000000000",
      receiver,
      flowRate: flowRateBigInt.toString(),
      monthlyRentUsd,
      sharePercentage,
      startedAt: body.startedAt ? Number(body.startedAt) : Math.floor(Date.now() / 1000),
      status: "ACTIVE",
      mode,
      txHash,
      blockNumber,
    });

    return NextResponse.json({
      success: true,
      stream: {
        ...saved,
        flowRateNum: Number(saved.flowRate),
        explorerUrl:
          saved.mode === "live" && saved.txHash
            ? `https://sepolia.basescan.org/tx/${saved.txHash}`
            : undefined,
        basescanUrl:
          saved.mode === "live" && saved.txHash
            ? `https://sepolia.basescan.org/tx/${saved.txHash}`
            : undefined,
      },
    });
  } catch (err: unknown) {
    if (err instanceof SuperfluidValidationError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to create stream";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const propertyId = req.nextUrl.searchParams.get("propertyId") || "";
    const receiverParam = req.nextUrl.searchParams.get("receiver") || "";
    if (!propertyId || !receiverParam) {
      return NextResponse.json(
        { success: false, error: "Missing required query params: propertyId, receiver" },
        { status: 400 }
      );
    }

    const receiver = validateReceiver(receiverParam);
    const existing = getYieldStream(propertyId, receiver);
    if (!existing || existing.status === "CLOSED") {
      throw new StreamNotFoundError(propertyId, receiver);
    }

    const closed = closeYieldStream(propertyId, receiver);
    return NextResponse.json({
      success: true,
      status: "STREAM_CLOSED",
      stream: closed,
    });
  } catch (err: unknown) {
    if (err instanceof SuperfluidValidationError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to close stream";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const propertyId = String(body.propertyId || "").trim();
    const receiver = validateReceiver(body.receiver);

    const existing = getYieldStream(propertyId, receiver);
    if (!existing) {
      throw new StreamNotFoundError(propertyId, receiver);
    }

    const updates: Record<string, unknown> = {};
    if (body.flowRate !== undefined) {
      updates.flowRate = validateFlowRate(body.flowRate, true).toString();
    }
    if (body.status !== undefined) {
      if (!["ACTIVE", "PAUSED", "CLOSED"].includes(body.status)) {
        return NextResponse.json(
          { success: false, error: "Status must be ACTIVE, PAUSED, or CLOSED" },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    if (body.mode !== undefined) {
      updates.mode = body.mode === "live" ? "live" : "simulated";
    }

    const updated = updateYieldStream(propertyId, receiver, updates);
    return NextResponse.json({
      success: true,
      status: "STREAM_UPDATED",
      stream: updated,
    });
  } catch (err: unknown) {
    if (err instanceof SuperfluidValidationError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to update stream";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
