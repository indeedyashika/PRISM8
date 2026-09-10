import {
  Client,
  TopicId,
  TopicMessageSubmitTransaction,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";
import { getOperatorClient } from "./client";
import { hashscanTxUrl } from "./format";

export interface HcsAuditEventPayload {
  event: string;
  invoiceId?: string;
  txId?: string;
  payer?: string;
  service?: string;
  amount?: string;
  propertyId?: string;
  addressHash?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  isSimulation?: boolean;
}

/**
 * Strongly-typed HCS Audit Receipt
 * 
 * Strict Semantics:
 * - LIVE: Genuine HCS submission returning real topic, sequence, and transaction metadata.
 * - FAILURE: Explicit status "failed" with real error message. Never generates mock sequence/txId.
 * - SIMULATION: Explicit mode "simulated" with status "confirmed". Never generates explorerUrl.
 */
export interface HcsAuditReceipt {
  mode: "live" | "simulated";
  status: "confirmed" | "failed";
  topicId?: string;
  sequence?: number;
  sequenceNumber?: number; // backwards-compatible alias
  transactionId?: string;
  txId?: string; // backwards-compatible alias
  explorerUrl?: string;
  hashscanUrl?: string; // backwards-compatible alias
  consensusTimestamp?: string;
  error?: string;
  event?: string;
}

export interface LogHcsAuditOptions {
  isSimulation?: boolean;
  client?: Client;
  topicId?: string;
  submitFn?: (
    tx: TopicMessageSubmitTransaction,
    client: Client
  ) => Promise<{
    transactionId: { toString: () => string };
    getRecord: (client: Client) => Promise<{
      receipt: { topicSequenceNumber?: number | string | { toString: () => string } };
      consensusTimestamp?: { toDate: () => Date };
    }>;
  }>;
}

let cachedTopicId: string | null = process.env.HEDERA_AUDIT_TOPIC_ID ?? null;

export async function getOrCreateAuditTopic(
  client?: Client,
  options?: { isSimulation?: boolean; topicId?: string }
): Promise<string> {
  if (options?.topicId) return options.topicId;
  if (process.env.HEDERA_AUDIT_TOPIC_ID) return process.env.HEDERA_AUDIT_TOPIC_ID;
  if (cachedTopicId) return cachedTopicId;

  const isSim = Boolean(options?.isSimulation || !process.env.HEDERA_OPERATOR_KEY);
  if (isSim) {
    cachedTopicId = process.env.HEDERA_AUDIT_TOPIC_ID || "0.0.4491823";
    return cachedTopicId;
  }

  try {
    const hederaClient = client ?? getOperatorClient();
    const createTx = await new TopicCreateTransaction()
      .setTopicMemo("LiquidityStream x402 Verifiable Audit Trail")
      .execute(hederaClient);
    const receipt = await createTx.getReceipt(hederaClient);
    if (receipt.topicId) {
      cachedTopicId = receipt.topicId.toString();
      return cachedTopicId;
    }
  } catch (err) {
    console.error("[HCS] Topic creation failed on Hedera network:", err);
    throw new Error(
      `Failed to create or discover live HCS topic: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  throw new Error("Unable to determine HCS topic ID for live audit submission");
}

export async function logHcsAuditEvent(
  payload: HcsAuditEventPayload,
  options?: LogHcsAuditOptions
): Promise<HcsAuditReceipt> {
  const timestamp = payload.timestamp ?? new Date().toISOString();
  const isSimulation = Boolean(
    options?.isSimulation ??
    payload.isSimulation ??
    payload.metadata?.isSimulation
  );

  // -------------------------------------------------------------------------
  // DEMO / SIMULATION MODE
  // -------------------------------------------------------------------------
  if (isSimulation) {
    const topicId = options?.topicId || cachedTopicId || process.env.HEDERA_AUDIT_TOPIC_ID || "0.0.4491823";
    const simulatedTxId = payload.txId || "sim_hcs_topic_audit";

    return {
      mode: "simulated",
      status: "confirmed",
      topicId,
      sequence: undefined,
      sequenceNumber: undefined,
      transactionId: simulatedTxId,
      txId: simulatedTxId,
      explorerUrl: undefined,
      hashscanUrl: undefined,
      consensusTimestamp: timestamp,
      event: payload.event,
    };
  }

  // -------------------------------------------------------------------------
  // LIVE MODE: Enforce real credentials and genuine network submission
  // -------------------------------------------------------------------------
  if (!process.env.HEDERA_OPERATOR_KEY || !process.env.HEDERA_OPERATOR_ID) {
    return {
      mode: "live",
      status: "failed",
      error: "HCS live audit failed: Hedera operator credentials (HEDERA_OPERATOR_KEY / HEDERA_OPERATOR_ID) are not configured.",
      consensusTimestamp: timestamp,
      event: payload.event,
    };
  }

  let topicIdStr: string;
  try {
    topicIdStr = await getOrCreateAuditTopic(options?.client, {
      isSimulation: false,
      topicId: options?.topicId,
    });
  } catch (topicErr) {
    return {
      mode: "live",
      status: "failed",
      error: `HCS topic discovery failed: ${topicErr instanceof Error ? topicErr.message : String(topicErr)}`,
      consensusTimestamp: timestamp,
      event: payload.event,
    };
  }

  const fullPayload = {
    ...payload,
    timestamp,
    standard: "x402-hcs-audit-v1",
  };
  const messageStr = JSON.stringify(fullPayload);

  try {
    const client = options?.client ?? getOperatorClient();
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicIdStr))
      .setMessage(messageStr);

    const txResponse = options?.submitFn
      ? await options.submitFn(tx, client)
      : await tx.execute(client);

    const record = await txResponse.getRecord(client);
    const rawSeq = record.receipt.topicSequenceNumber;
    const seqNum =
      rawSeq !== undefined && rawSeq !== null
        ? Number(typeof rawSeq === "object" && "toString" in rawSeq ? rawSeq.toString() : rawSeq)
        : undefined;

    if (seqNum === undefined || isNaN(seqNum)) {
      return {
        mode: "live",
        status: "failed",
        topicId: topicIdStr,
        error: "HCS submission succeeded but topicSequenceNumber was not assigned by consensus node.",
        consensusTimestamp: timestamp,
        event: payload.event,
      };
    }

    const consensusTimestamp = record.consensusTimestamp
      ? record.consensusTimestamp.toDate().toISOString()
      : timestamp;
    const txIdStr = txResponse.transactionId.toString();
    const explorerUrl = hashscanTxUrl(txIdStr);

    return {
      mode: "live",
      status: "confirmed",
      topicId: topicIdStr,
      sequence: seqNum,
      sequenceNumber: seqNum,
      transactionId: txIdStr,
      txId: txIdStr,
      explorerUrl,
      hashscanUrl: explorerUrl,
      consensusTimestamp,
      event: payload.event,
    };
  } catch (error) {
    console.error("[HCS] Live audit submission error:", error);
    return {
      mode: "live",
      status: "failed",
      topicId: topicIdStr,
      error: `HCS submission failed: ${error instanceof Error ? error.message : String(error)}`,
      consensusTimestamp: timestamp,
      event: payload.event,
    };
  }
}
