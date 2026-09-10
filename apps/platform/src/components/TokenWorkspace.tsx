"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card } from "@/components/ui";
import HolderPanel from "@/components/HolderPanel";
import TokenChat from "@/components/TokenChat";
import EventLog from "@/components/EventLog";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { useWallet } from "@/hooks/useWalletConnect";
import type {
  EventRecord,
  HolderRecord,
  TokenRecord,
  TokenRequestRecord,
  WorldIdClientConfig,
} from "@/types";

export default function TokenWorkspace({
  token,
  holders,
  events,
  requests,
  worldConfig,
}: {
  token: TokenRecord;
  holders: HolderRecord[];
  events: EventRecord[];
  requests: TokenRequestRecord[];
  worldConfig: WorldIdClientConfig;
}) {
  return (
    <div className="token-workspace">
      <Link href="/" className="token-back-link">
        <span aria-hidden="true">←</span>
        All tokens
      </Link>
      <TokenHeader token={token} />
      <HolderPanel
        token={token}
        holders={holders}
        requests={requests}
        worldConfig={worldConfig}
      />
      <TokenChat token={token} />
      <EventLog events={events} />
    </div>
  );
}

function TokenHeader({ token }: { token: TokenRecord }) {
  return (
    <Card className="token-header-card flex flex-col gap-4">
      <div className="token-header-primary">
        <div className="token-header-identity">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="token-header-symbol">{token.symbol}</span>
            <h1 className="text-2xl font-semibold">{token.name}</h1>
            {token.paused && <Badge tone="red">PAUSED</Badge>}
          </div>
          <div className="text-sm text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono token-header-id">{token.id}</span>
            <span>·</span>
            <span>{token.tokenType}</span>
            <Badge tone={token.blockchain === "EVM" ? "violet" : "emerald"}>
              {token.blockchain === "EVM" ? "Ethereum Sepolia" : "Hedera testnet"}
            </Badge>
            <a href={token.explorerUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {token.explorerName} ↗
            </a>
          </div>
        </div>
        <ConnectedWalletBalance token={token} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {token.compliance.kycRequired && <Badge>KYC required</Badge>}
        {token.customFee && <Badge>Custom fee</Badge>}
        {token.compliance.worldIdSelfieCheck && <Badge tone="violet">Selfie Check</Badge>}
        {token.compliance.worldIdMinimumAge && (
          <Badge tone="violet">Age {token.compliance.worldIdMinimumAge}+</Badge>
        )}
        {token.compliance.worldIdNationality && (
          <Badge tone="violet">Nationality {token.compliance.worldIdNationality}</Badge>
        )}
        {token.compliance.livenessEnabled && (
          <Badge tone="amber">
            Liveness · reclaim after {formatPeriod(token.compliance.livenessPeriodSeconds)}
          </Badge>
        )}
      </div>
    </Card>
  );
}

type BalanceSnapshot = {
  accountId: string;
  balanceBaseUnits: string | null;
  error: boolean;
};

function ConnectedWalletBalance({ token }: { token: TokenRecord }) {
  const { accountId: hederaAccountId } = useWallet();
  const { accountId: evmAccountId } = useEvmWallet();
  const accountId = token.blockchain === "EVM" ? evmAccountId : hederaAccountId;
  const [snapshot, setSnapshot] = useState<BalanceSnapshot | null>(null);

  useEffect(() => {
    if (!accountId) return;

    const activeAccountId = accountId;
    const controller = new AbortController();
    let running = false;

    async function loadBalance() {
      if (running) return;
      running = true;
      try {
        const response = await fetch(
          `/api/tokens/${encodeURIComponent(token.id)}/balance?accountId=${encodeURIComponent(activeAccountId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Balance lookup failed");
        const data = (await response.json()) as { balanceBaseUnits?: unknown };
        if (typeof data.balanceBaseUnits !== "string") throw new Error("Invalid balance response");
        setSnapshot({ accountId: activeAccountId, balanceBaseUnits: data.balanceBaseUnits, error: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("token balance lookup failed", error);
        setSnapshot({ accountId: activeAccountId, balanceBaseUnits: null, error: true });
      } finally {
        running = false;
      }
    }

    void loadBalance();
    const interval = window.setInterval(loadBalance, 15_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadBalance();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [accountId, token.id]);

  const currentSnapshot = accountId && snapshot?.accountId === accountId ? snapshot : null;
  const balance = currentSnapshot?.balanceBaseUnits
    ? formatTokenBalance(currentSnapshot.balanceBaseUnits, token.decimals)
    : currentSnapshot?.balanceBaseUnits === "0"
      ? "0"
      : null;
  const value = !accountId
    ? "—"
    : currentSnapshot?.error
      ? "Unavailable"
      : balance ?? "…";
  const detail = !accountId
    ? `Connect your ${token.blockchain === "EVM" ? "Sepolia" : "Hedera"} wallet`
    : currentSnapshot?.error
      ? "We’ll retry automatically"
      : shortAccount(accountId);

  return (
    <div className="token-balance" aria-live="polite" aria-label={`Your balance: ${value} ${token.symbol}`}>
      <span className="token-balance-label">Your balance</span>
      <div className="token-balance-value-row">
        <strong className={`token-balance-value${currentSnapshot?.error ? " is-error" : ""}`}>{value}</strong>
        {accountId && !currentSnapshot?.error && <span className="token-balance-symbol">{token.symbol}</span>}
      </div>
      <span className="token-balance-account">{detail}</span>
    </div>
  );
}

function formatTokenBalance(baseUnits: string, decimals: number): string {
  const units = BigInt(baseUnits);
  const places = Math.max(0, Math.trunc(decimals));
  const negative = units < BigInt(0);
  const digits = (negative ? -units : units).toString().padStart(places + 1, "0");
  const whole = places ? digits.slice(0, -places) : digits;
  const fraction = places ? digits.slice(-places).replace(/0+$/, "") : "";
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}${groupedWhole}${fraction ? `.${fraction}` : ""}`;
}

function shortAccount(accountId: string): string {
  return accountId.startsWith("0x") ? `${accountId.slice(0, 6)}…${accountId.slice(-4)}` : accountId;
}

function formatPeriod(seconds?: number): string {
  if (!seconds) return "?";
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}
