"use client";

import React from "react";
import type { BlockchainMode } from "@/types/blockchain";

export interface HcsAuditBadgeProps {
  topicId?: string;
  sequenceNumber?: number | string;
  txId?: string;
  consensusTimestamp?: string;
  compact?: boolean;
  mode?: BlockchainMode;
}

export function HcsAuditBadge({
  topicId = "0.0.4491823",
  sequenceNumber,
  txId,
  consensusTimestamp,
  compact = false,
  mode = "live",
}: HcsAuditBadgeProps) {
  const isSimulated =
    mode === "simulated" ||
    !txId ||
    txId.startsWith("sim_") ||
    txId.startsWith("mock_");

  const hashscanTopicUrl = `https://hashscan.io/testnet/topic/${topicId}`;
  const hashscanTxUrl =
    !isSimulated && txId
      ? `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`
      : undefined;

  if (compact) {
    if (isSimulated) {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 text-neutral-600 border border-neutral-300"
          title="Simulated Audit Anchor (Offline / Testnet fallback)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
          <span>SIMULATION {sequenceNumber ? `(#${sequenceNumber})` : ""}</span>
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
        <span>ON-CHAIN {sequenceNumber ? `#${sequenceNumber}` : "HCS"}</span>
      </a>
    );
  }

  return (
    <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs text-black shadow-sm">
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
        <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
          isSimulated
            ? "bg-neutral-200 text-neutral-600 border-neutral-300"
            : "bg-emerald-50 text-emerald-700 border-emerald-300"
        }`}>
          {isSimulated ? "SIMULATION" : sequenceNumber ? `Seq #${sequenceNumber}` : "ON-CHAIN"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-300 font-mono text-[11px]">
        <div>
          <span className="text-neutral-500 text-[10px] block">Topic ID</span>
          {isSimulated ? (
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
              {txId || "Simulation (No on-chain Tx)"}
            </span>
          ) : hashscanTxUrl ? (
            <a
              href={hashscanTxUrl}
              target="_blank"
              rel="noreferrer"
              className="text-black font-semibold hover:underline truncate block"
            >
              {txId ? `${txId.slice(0, 16)}...` : "Confirmed on Testnet ↗"}
            </a>
          ) : (
            <span className="text-neutral-500">Confirmed on Testnet</span>
          )}
        </div>
      </div>
    </div>
  );
}
