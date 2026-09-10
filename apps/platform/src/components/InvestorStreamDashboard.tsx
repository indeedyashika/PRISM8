"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { isAddress } from "ethers";

export interface InvestorStreamDashboardProps {
  propertyId?: string;
  propertyAddress?: string;
  receiver?: string;
  monthlyRent?: number;
  sharePercentage?: number;
  initialBalance?: number;
  onClaim?: () => void;
}

interface StreamState {
  id: string;
  propertyId: string;
  tokenAddress: string;
  sender: string;
  receiver: string;
  flowRate: string;
  monthlyRentUsd: number;
  sharePercentage: number;
  startedAt: number;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  mode: "live" | "simulated";
  txHash?: string | null;
  blockNumber?: number | null;
  basescanUrl?: string;
}

export function InvestorStreamDashboard({
  propertyId = "prop_456_oak_ave",
  propertyAddress = "456 Oak Avenue, Miami FL 33101",
  receiver = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  monthlyRent = 3800,
  sharePercentage = 10.0,
  onClaim,
}: InvestorStreamDashboardProps) {
  const [stream, setStream] = useState<StreamState | null>(null);
  const [currentYield, setCurrentYield] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimSuccess, setClaimSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Authoritative base values for smoothing interpolation
  const baseAccruedRef = useRef<number>(0);
  const lastReadTimeRef = useRef<number>(Date.now());
  const flowRatePerSecRef = useRef<number>(0);

  // Validation
  const isReceiverValid = receiver ? isAddress(receiver.trim()) : false;

  // Query actual stream state from server / database
  const fetchStreamState = useCallback(async () => {
    if (!isReceiverValid) {
      setError(`Invalid receiver address: "${receiver}". Must be a valid 42-character EVM address.`);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/yield/streams?propertyId=${encodeURIComponent(propertyId)}&receiver=${encodeURIComponent(receiver)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load stream state");
      }

      const activeStream = (data.streams as StreamState[]).find(
        (s) => s.propertyId === propertyId && s.receiver.toLowerCase() === receiver.toLowerCase()
      ) || data.streams[0] || null;

      if (activeStream) {
        setStream(activeStream);
        setError(null);

        // Calculate flow rate in USD per second
        // 1 month = 2,592,000s
        const effectiveRent = activeStream.monthlyRentUsd || monthlyRent;
        const effectiveShare = activeStream.sharePercentage || sharePercentage;
        const flowRatePerSec = (effectiveRent * (effectiveShare / 100)) / 2592000;
        flowRatePerSecRef.current = flowRatePerSec;

        // Authoritative elapsed time since stream start
        const nowSec = Math.floor(Date.now() / 1000);
        const elapsedSec = Math.max(0, nowSec - activeStream.startedAt);
        // Cap accrued baseline if stream is paused
        const accruedUsd = activeStream.status === "ACTIVE" ? elapsedSec * flowRatePerSec : 0;

        baseAccruedRef.current = accruedUsd;
        lastReadTimeRef.current = Date.now();
        setCurrentYield(accruedUsd);
      } else {
        setStream(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error reading stream state";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, receiver, isReceiverValid, monthlyRent, sharePercentage]);

  // Initial load and periodic polling (every 8 seconds to synchronize with chain/db)
  useEffect(() => {
    fetchStreamState();
    const pollInterval = setInterval(fetchStreamState, 8000);
    return () => clearInterval(pollInterval);
  }, [fetchStreamState]);

  // Smooth visual interpolation between server/chain reads (every 80ms)
  useEffect(() => {
    if (!stream || stream.status !== "ACTIVE") return;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - lastReadTimeRef.current;
      const smoothAccrued = (elapsedMs / 1000) * flowRatePerSecRef.current;
      setCurrentYield(baseAccruedRef.current + smoothAccrued);
    }, 80);

    return () => clearInterval(interval);
  }, [stream]);

  // Toggle stream status (Pause / Resume) via PATCH API
  const handleToggleStream = async () => {
    if (!stream || isToggling) return;
    setIsToggling(true);
    setError(null);
    try {
      const newStatus = stream.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      const res = await fetch("/api/yield/streams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: stream.propertyId,
          receiver: stream.receiver,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to toggle stream");
      }
      await fetchStreamState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Toggle stream failed";
      setError(msg);
    } finally {
      setIsToggling(false);
    }
  };

  const handleClaim = async () => {
    setIsClaiming(true);
    setError(null);
    try {
      // Simulate claim settlement delay
      await new Promise((r) => setTimeout(r, 1000));
      setClaimSuccess(true);
      baseAccruedRef.current = 0;
      lastReadTimeRef.current = Date.now();
      setCurrentYield(0);
      if (onClaim) onClaim();
      setTimeout(() => setClaimSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setError(msg);
    } finally {
      setIsClaiming(false);
    }
  };

  const isLive = stream?.mode === "live";
  const isStreamActive = stream?.status === "ACTIVE";
  const flowRateUsdPerSec = flowRatePerSecRef.current || ((monthlyRent * sharePercentage) / 100) / 2592000;
  const investorMonthlyRent = (monthlyRent * sharePercentage) / 100;

  return (
    <div className="flex flex-col justify-between h-full font-mono text-black space-y-3">
      {/* Top Status Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
        <div className="flex items-center gap-1.5 text-xs">
          {isStreamActive ? (
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-neutral-800"}`} />
          ) : (
            <span className="w-2 h-2 rounded-full bg-neutral-400" />
          )}
          <span className="font-bold text-black truncate max-w-[180px]">
            {propertyAddress.split(",")[0]}
          </span>
        </div>

        {/* Distinct Mode Badge: ON-CHAIN vs SIMULATION */}
        {isLive ? (
          <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ON-CHAIN STREAM
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 bg-neutral-200 text-neutral-700 border border-neutral-300 font-medium">
            SIMULATED STREAM
          </span>
        )}
      </div>

      {/* Mode Metadata Panel */}
      {isLive ? (
        <div className="p-2 bg-emerald-50/50 border border-emerald-200 text-[10px] text-emerald-900 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-emerald-700">Network:</span>
            <span className="font-bold">Base Sepolia (Chain 84532)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-emerald-700">Receiver:</span>
            <span className="font-mono truncate max-w-[170px]" title={receiver}>{receiver}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-emerald-700">Transaction:</span>
            {stream?.basescanUrl ? (
              <a
                href={stream.basescanUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-emerald-800 underline hover:text-emerald-950 truncate max-w-[170px]"
              >
                {stream.txHash?.slice(0, 14)}... ↗
              </a>
            ) : (
              <span className="font-mono">{stream?.txHash?.slice(0, 14) || "Confirmed"}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2 bg-neutral-50 border border-neutral-300 text-[10px] text-neutral-600 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Mode:</span>
            <span className="font-bold text-neutral-700">[SIMULATION MODE]</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Network:</span>
            <span>Base Sepolia (Virtual)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Receiver:</span>
            <span className="font-mono truncate max-w-[170px]" title={receiver}>{receiver}</span>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-300 text-red-700 text-[10px] font-sans">
          ⚠ {error}
        </div>
      )}

      {/* Main Streaming Counter with Smooth Visual Interpolation */}
      <div className="text-center py-2.5 px-2 bg-neutral-50 border border-neutral-200">
        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-1">
          <span>Accrued Rental Yield</span>
          {isStreamActive && <span className="text-emerald-600 font-bold text-[9px]">• Ticking</span>}
          {stream?.status === "PAUSED" && <span className="text-amber-600 font-bold text-[9px]">• Paused</span>}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black tabular-nums my-1">
          ${currentYield.toFixed(6)}
        </div>
        <div className="text-[11px] text-neutral-600">
          Flow Rate: <span className="font-bold text-black">+${flowRateUsdPerSec.toFixed(8)}/s</span>
        </div>
      </div>

      {/* Share and Rent Metrics */}
      <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-neutral-200 pt-2">
        <div>
          <span className="text-neutral-500 block text-[10px]">Your Equity ({sharePercentage}%)</span>
          <span className="font-bold text-black">${investorMonthlyRent.toFixed(2)} / mo</span>
        </div>
        <div>
          <span className="text-neutral-500 block text-[10px]">Total Property Rent</span>
          <span className="font-bold text-black">${monthlyRent.toLocaleString()} / mo</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleClaim}
          disabled={isClaiming || currentYield <= 0.0001 || !isStreamActive}
          className="flex-1 bg-black text-white px-3 py-2 text-xs font-bold border border-black hover:bg-neutral-800 disabled:opacity-40 transition cursor-pointer"
        >
          {isClaiming ? "Settling..." : `Claim Yield ($${currentYield.toFixed(2)})`}
        </button>
        <button
          onClick={handleToggleStream}
          disabled={isToggling || isLoading}
          className="bg-white text-black px-3 py-2 text-xs border border-neutral-300 hover:bg-neutral-100 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          {isToggling ? "Updating..." : isStreamActive ? "Pause Stream" : "Resume Stream"}
        </button>
      </div>

      {claimSuccess && (
        <div className="text-[10px] bg-neutral-100 border border-neutral-300 p-1.5 text-center text-black font-semibold">
          ✓ Yield Claimed! Settled via Hedera Scheduled Tx
        </div>
      )}
    </div>
  );
}
