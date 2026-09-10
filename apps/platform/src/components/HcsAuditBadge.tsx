"use client";

import React from "react";
import type { BlockchainMode } from "@/types/blockchain";

export interface HcsAuditBadgeProps {
  topicId?: string;
  sequence?: number | string;
  sequenceNumber?: number | string;
  transactionId?: string;
  txId?: string;
  consensusTimestamp?: string;
  compact?: boolean;
  mode?: BlockchainMode;
  status?: "confirmed" | "failed";
  explorerUrl?: string;
  error?: string;
}

export function HcsAuditBadge({
  topicId = "0.0.4491823",
  sequence,
  sequenceNumber,
  transactionId,
  txId,
  consensusTimestamp,
  compact = false,
  mode = "live",
  status = "confirmed",
  explorerUrl,
  error,
}: HcsAuditBadgeProps) {
  const effectiveSeq = sequence ?? sequenceNumber;
  const effectiveTxId = transactionId ?? txId;
  const isFailed = status === "failed";
  const isSimulated =
    !isFailed &&
    (mode === "simulated" ||
      !effectiveTxId ||
      effectiveTxId.startsWith("sim_") ||
      effectiveTxId.startsWith("mock_"));

  // Never produce an explorer URL for simulation or failed audits
  const hashscanTopicUrl = !isSimulated && !isFailed ? `https://hashscan.io/testnet/topic/${topicId}` : undefined;
  const hashscanTxUrl =
    !isSimulated && !isFailed && effectiveTxId
      ? explorerUrl || `https://hashscan.io/testnet/transaction/${encodeURIComponent(effectiveTxId)}`
      : undefined;

  // ---------------------------------------------------------------------------
  // FAILED STATUS
  // ---------------------------------------------------------------------------
  if (isFailed) {
    if (compact) {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-red-100 text-red-800 border border-red-300"
          title={error || "HCS Audit Submission Failed"}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="font-bold">HCS FAILED</span>
        </span>
      );
    }

    return (
      <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 shadow-sm font-mono">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
            <span className="font-semibold text-red-950 tracking-wide uppercase text-[10px]">
              Hedera Consensus Audit Trail (HCS)
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono border bg-red-100 text-red-800 border-red-300 font-bold">
            FAILED
          </span>
        </div>
        <div className="text-[11px] text-red-700 mt-1">
          <span className="font-bold">Error:</span> {error || "HCS live consensus audit submission failed."}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // COMPACT VIEW
  // ---------------------------------------------------------------------------
  if (compact) {
    if (isSimulated) {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 text-neutral-600 border border-neutral-300"
          title="Simulated Audit Anchor (Demo mode · No on-chain funds/anchors)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
          <span>SIMULATED {effectiveSeq ? `(#${effectiveSeq})` : ""}</span>
        </span>
      );
    }

    return (
      <a
        href={hashscanTxUrl || hashscanTopicUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 text-black border border-neutral-300 hover:bg-neutral-200 transition-colors"
        title="Verified on Hedera Consensus Service (HCS)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>ON-CHAIN {effectiveSeq ? `#${effectiveSeq}` : "HCS"}</span>
      </a>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs text-black shadow-sm font-mono">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          {isSimulated ? (
            <span className="inline-flex h-2 w-2 rounded-full bg-neutral-400" />
          ) : (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <span className="font-semibold text-black tracking-wide uppercase text-[10px]">
            Hedera Consensus Audit Trail (HCS)
          </span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
            isSimulated
              ? "bg-neutral-200 text-neutral-600 border-neutral-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-300"
          }`}
        >
          {isSimulated ? "SIMULATION" : effectiveSeq ? `Seq #${effectiveSeq}` : "ON-CHAIN"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-300 font-mono text-[11px]">
        <div>
          <span className="text-neutral-500 text-[10px] block">Topic ID</span>
          {isSimulated || !hashscanTopicUrl ? (
            <span className="text-neutral-600 font-medium block">{topicId}</span>
          ) : (
            <a
              href={hashscanTopicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-black font-semibold hover:underline flex items-center gap-1"
            >
              {topicId} ↗
            </a>
          )}
        </div>
        <div>
          <span className="text-neutral-500 text-[10px] block">Settlement Tx</span>
          {isSimulated ? (
            <span className="text-neutral-500 text-[11px] block truncate">
              {effectiveTxId || "Simulation (No on-chain Tx)"}
            </span>
          ) : hashscanTxUrl ? (
            <a
              href={hashscanTxUrl}
              target="_blank"
              rel="noreferrer"
              className="text-black font-semibold hover:underline truncate block"
            >
              {effectiveTxId ? `${effectiveTxId.slice(0, 16)}...` : "Confirmed on Testnet ↗"}
            </a>
          ) : (
            <span className="text-neutral-500">Confirmed on Testnet</span>
          )}
        </div>
      </div>
    </div>
  );
}
