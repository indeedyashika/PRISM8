"use client";

import { useState } from "react";
import Link from "next/link";
import type { TokenRecord } from "@/types";
import { InvestorStreamDashboard } from "./InvestorStreamDashboard";
import { RentSimulatorPanel } from "./RentSimulatorPanel";
import { PropertyTokenizeModal } from "./PropertyTokenizeModal";
import { TheGraphInspectorModal } from "./TheGraphInspectorModal";
import { AgenticSafetyCockpit } from "./AgenticSafetyCockpit";

const ASSET_CATEGORY_LABELS: Record<NonNullable<TokenRecord["assetCategory"]>, string> = {
  securities: "Securities",
  "real-estate": "Real estate",
  invoices: "Invoices",
  "carbon-credits": "Carbon credits",
  commodities: "Commodities",
  other: "Tokenized asset",
};

export default function DeployedTokenCatalog({ tokens }: { tokens: TokenRecord[] }) {
  const [isTokenizeOpen, setIsTokenizeOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-mono text-black">
      <div className="max-w-7xl mx-auto px-4 py-16">
        
        {/* 1. Hero Section (Ad402 Exact Layout) */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-neutral-300 bg-neutral-100 text-xs font-mono text-black">
            <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
            <span>Hedera x402 · The Graph · Superfluid CFA</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-mono font-bold text-black mb-6 tracking-tight">
            Prism 8
          </h1>
          <p className="text-lg sm:text-xl font-mono text-neutral-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            The future of decentralized real-estate yield streaming. Autonomous agents discover property oracles, pay per query via Hedera x402, index ownership on The Graph, and stream rental cashflow per-second with Superfluid CFA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setIsTokenizeOpen(true)}
              className="bg-black text-white px-8 py-3.5 hover:bg-neutral-800 transition-colors font-mono font-bold cursor-pointer border border-black"
            >
              Tokenize Property (x402)
            </button>
            <button
              onClick={() => setIsGraphOpen(true)}
              className="bg-white text-black px-8 py-3.5 border border-black hover:bg-neutral-100 transition-colors font-mono font-semibold cursor-pointer"
            >
              The Graph AI Inspector
            </button>
            <a
              href="#safety-cockpit"
              className="bg-black text-white px-8 py-3.5 hover:bg-neutral-800 transition-colors font-mono font-bold cursor-pointer border border-black text-center"
            >
              Agentic Safety Cockpit
            </a>
            <a
              href="#instruments"
              className="bg-white text-black px-8 py-3.5 border border-black hover:bg-neutral-100 transition-colors font-mono font-semibold text-center"
            >
              Publisher Dashboard
            </a>
          </div>
        </div>

        {/* 2. 3 Slot Cards (Ad402 Exact Slot Grid Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-stretch">
          
          {/* Slot 1: Live Yield Stream */}
          <div className="bg-white p-6 border border-neutral-300 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-mono font-semibold text-black">Yield Stream Slot</h3>
                <span className="text-[11px] px-2 py-0.5 bg-neutral-100 text-black border border-neutral-300 font-mono">
                  Superfluid CFA
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-mono mb-4 min-h-[32px]">
                Continuous cashflow streaming at +$0.00162037/sec on Base Sepolia.
              </p>
              <div className="ad402-slot mb-4 min-h-[260px] flex flex-col justify-between">
                <InvestorStreamDashboard
                  propertyAddress="456 Oak Avenue, Miami FL 33101"
                  monthlyRent={3800}
                  sharePercentage={10.0}
                  initialBalance={14.8251}
                />
              </div>
            </div>
            <div className="text-[11px] text-neutral-600 font-mono flex items-center justify-between pt-2 border-t border-neutral-300">
              <span>Wrapped Token:</span>
              <span className="text-black font-bold">fUSDCx (Super Token)</span>
            </div>
          </div>

          {/* Slot 2: Tenant Payment Simulator */}
          <div className="bg-white p-6 border border-neutral-300 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-mono font-semibold text-black">Tenant Payment Slot</h3>
                <span className="text-[11px] px-2 py-0.5 bg-neutral-100 text-black border border-neutral-300 font-mono">
                  Rent Inflow
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-mono mb-4 min-h-[32px]">
                Simulate tenant rent deposit ($3,800) converting into yield streams.
              </p>
              <div className="ad402-slot mb-4 min-h-[260px] flex flex-col justify-between">
                <RentSimulatorPanel
                  propertyId="prop_456_oak_ave"
                  defaultRentAmount={3800}
                />
              </div>
            </div>
            <div className="text-[11px] text-neutral-600 font-mono flex items-center justify-between pt-2 border-t border-neutral-300">
              <span>Payout Rail:</span>
              <span className="text-black font-bold">Hedera Scheduled Tx</span>
            </div>
          </div>

          {/* Slot 3: Hedera x402 Oracle */}
          <div className="bg-white p-6 border border-neutral-300 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-mono font-semibold text-black">x402 Verification Slot</h3>
                <span className="text-[11px] px-2 py-0.5 bg-neutral-100 text-black border border-neutral-300 font-mono">
                  Hedera 0.5 HBAR
                </span>
              </div>
              <p className="text-xs text-neutral-600 font-mono mb-4 min-h-[32px]">
                USPS physical address validation with unforgeable HCS audit receipt.
              </p>
              <div className="ad402-slot mb-4 min-h-[260px] flex flex-col justify-between">
                <div className="flex flex-col justify-between h-full font-mono text-black space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                      <span className="font-bold text-black">ORACLE GATEWAY</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-black">
                      HTTP 402
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                      <span className="text-neutral-500">Endpoint:</span>
                      <span className="text-black font-mono text-[11px] truncate max-w-[160px]">/api/x402/property-oracle</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                      <span className="text-neutral-500">Status Gate:</span>
                      <span className="text-black font-bold">HTTP 402 → 200 OK</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                      <span className="text-neutral-500">USPS DPV:</span>
                      <span className="text-black font-semibold">Code Y (Deliverable)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">HCS Topic:</span>
                      <a
                        href="https://hashscan.io/testnet"
                        target="_blank"
                        rel="noreferrer"
                        className="text-black hover:underline font-bold"
                      >
                        0.0.4491823 ↗
                      </a>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsTokenizeOpen(true)}
                    className="w-full bg-black text-white py-2 text-xs font-bold border border-black hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Inspect x402 Handshake
                  </button>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-neutral-600 font-mono flex items-center justify-between pt-2 border-t border-neutral-300">
              <span>Oracle Rail:</span>
              <span className="text-black font-bold">Chainlink + USPS DPV</span>
            </div>
          </div>
        </div>

        {/* 2.5 Agentic Autonomy with Safety Guardrails */}
        <div id="safety-cockpit" className="mb-16">
          <AgenticSafetyCockpit />
        </div>

        {/* 3. Key Features (Ad402 Exact 3-Column Layout with Icons) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="bg-neutral-100 w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-neutral-300">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-semibold mb-2 text-black">Instant Payments</h3>
            <p className="text-neutral-600 font-mono text-sm leading-relaxed">
              Publishers receive payments instantly using the Hedera x402 protocol. No waiting periods or complex withdrawal processes.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-neutral-100 w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-neutral-300">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-semibold mb-2 text-black">No Intermediaries</h3>
            <p className="text-neutral-600 font-mono text-sm leading-relaxed">
              Direct connection between property owners and investors. Lower fees, more transparency, and continuous Superfluid cashflows.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-neutral-100 w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-neutral-300">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-semibold mb-2 text-black">Real-time Analytics</h3>
            <p className="text-neutral-600 font-mono text-sm leading-relaxed">
              The Graph indexes token transfers and holder distributions in real-time. Query live blockchain data through dual MCP servers.
            </p>
          </div>
        </div>

        {/* 4. How It Works (Ad402 Exact 4-Step Numbered Box) */}
        <div className="bg-white border border-neutral-300 shadow-sm p-8 mb-16">
          <h2 className="text-3xl font-mono font-bold text-center mb-8 text-black">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-black text-white w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                1
              </div>
              <h3 className="font-mono font-semibold mb-2 text-black">Register Slots</h3>
              <p className="text-neutral-600 text-sm font-mono leading-relaxed">
                Publishers and agents verify addresses via x402, paying 0.5 HBAR on Hedera testnet.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-black text-white w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                2
              </div>
              <h3 className="font-mono font-semibold mb-2 text-black">Browse & Select</h3>
              <p className="text-neutral-600 text-sm font-mono leading-relaxed">
                Investors browse tokenized properties, verify identity via World ID, and acquire fractional shares.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-black text-white w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                3
              </div>
              <h3 className="font-mono font-semibold mb-2 text-black">Pay & Place</h3>
              <p className="text-neutral-600 text-sm font-mono leading-relaxed">
                The Graph indexes shareholder distributions, enabling automated proportional flow rates.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-black text-white w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                4
              </div>
              <h3 className="font-mono font-semibold mb-2 text-black">Go Live</h3>
              <p className="text-neutral-600 text-sm font-mono leading-relaxed">
                Rental yield streams live every second into investor wallets via Superfluid CFA on Base Sepolia.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Ready to Get Started? (Ad402 Exact Primary Call-to-Action) */}
        <div className="text-center bg-white text-black p-12 border-2 border-black mb-16">
          <h2 className="text-3xl font-mono font-bold mb-4 text-black">Ready to Get Started?</h2>
          <p className="text-xl mb-8 font-mono text-neutral-600">
            Join the decentralized real-estate yield revolution today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setIsTokenizeOpen(true)}
              className="bg-black text-white px-8 py-3 hover:bg-neutral-800 transition-colors font-mono border border-black font-bold cursor-pointer"
            >
              Try Demo (Tokenize)
            </button>
            <button
              onClick={() => setIsGraphOpen(true)}
              className="bg-white text-black px-8 py-3 hover:bg-neutral-100 transition-colors font-mono border border-black font-bold cursor-pointer"
            >
              Start Publishing
            </button>
          </div>
        </div>

        {/* 6. Real-Estate Instruments Catalog (Ad402 Style Card Grid) */}
        <div id="instruments" className="mb-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-300">
            <div>
              <p className="text-xs uppercase font-bold text-black tracking-wider">Live Registry</p>
              <h2 className="text-2xl font-mono font-bold text-black">Available Real-Estate Instruments</h2>
            </div>
            <span className="text-xs font-mono text-neutral-600 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-black" />
              Synced by Hermes
            </span>
          </div>

          {tokens.length === 0 ? (
            <div className="bg-white border border-neutral-300 p-12 text-center">
              <p className="font-mono text-neutral-600">No property tokens deployed yet. Use the Hermes operator to tokenize.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tokens.map((token) => {
                const assetType = token.assetCategory
                  ? ASSET_CATEGORY_LABELS[token.assetCategory]
                  : "Real estate";

                return (
                  <Link
                    key={token.id}
                    href={`/tokens/${token.id}`}
                    className="bg-white border border-neutral-300 p-6 hover:border-black transition-colors flex flex-col justify-between block group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold px-2 py-1 bg-neutral-100 text-black border border-neutral-300">
                          {token.symbol}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {token.blockchain === "EVM" ? "Sepolia" : "Hedera"}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold font-mono text-black mb-1 group-hover:underline transition-colors">
                        {token.name}
                      </h3>
                      <p className="text-xs font-mono text-neutral-600 mb-4 line-clamp-2">
                        {token.memo || `Fractional real-estate asset on ${token.blockchain}.`}
                      </p>

                      <div className="space-y-2 text-xs font-mono border-t border-neutral-300 pt-3 mb-4">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Token ID:</span>
                          <span className="font-semibold text-black truncate max-w-[160px]">{token.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Supply:</span>
                          <span className="text-black">{token.initialSupply} shares</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Category:</span>
                          <span className="text-black">{assetType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-300 flex items-center justify-between text-xs font-mono text-black font-bold">
                      <span>View Instrument</span>
                      <span>→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        <PropertyTokenizeModal
          isOpen={isTokenizeOpen}
          onClose={() => setIsTokenizeOpen(false)}
          onTokenized={() => {
            window.location.reload();
          }}
        />

        <TheGraphInspectorModal
          isOpen={isGraphOpen}
          onClose={() => setIsGraphOpen(false)}
        />

      </div>
    </div>
  );
}
