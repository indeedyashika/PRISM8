"use client";

import { useState, useEffect } from "react";

interface TheGraphInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HolderData {
  address: string;
  formattedBalance: string;
  sharePercentage: string;
  monthlyYieldUsd: number;
}

interface TransferData {
  id: string;
  from: { address: string };
  to: { address: string };
  formattedValue: string;
  isMintOrBurn: boolean;
  blockNumber: string;
  transactionHash: string;
}

export function TheGraphInspectorModal({ isOpen, onClose }: TheGraphInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<"query" | "mcp" | "architecture">("query");
  const [queryType, setQueryType] = useState<"holders" | "transfers" | "meta">("holders");
  const [loading, setLoading] = useState(false);
  const [subgraphData, setSubgraphData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
  }, [isOpen, queryType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subgraph");
      const json = await res.json();
      setSubgraphData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 overflow-y-auto animate-fade-in font-mono">
      <div className="relative w-full max-w-4xl rounded-3xl border border-neutral-300 bg-white p-6 sm:p-8 text-black shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-300 text-black">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-black tracking-tight">The Graph AI Integration</h3>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-black border border-neutral-300">
                  Dual MCP + GraphQL
                </span>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                Live Subgraph indexing real-estate tokens & fueling autonomous Superfluid cashflow distribution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 bg-neutral-50 p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 mt-4 text-sm font-medium gap-2">
          <button
            onClick={() => setActiveTab("query")}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "query"
                ? "border-b-2 border-black text-black bg-neutral-100 font-semibold"
                : "text-neutral-500 hover:text-black"
            }`}
          >
            Live GraphQL Query Runner
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "mcp"
                ? "border-b-2 border-black text-black bg-neutral-100 font-semibold"
                : "text-neutral-500 hover:text-black"
            }`}
          >
            Subgraph MCP Tooling
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "architecture"
                ? "border-b-2 border-black text-black bg-neutral-100 font-semibold"
                : "text-neutral-500 hover:text-black"
            }`}
          >
            Hackathon Track Alignment
          </button>
        </div>

        {/* Tab 1: Live GraphQL Query Runner */}
        {activeTab === "query" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50 p-3 rounded-2xl border border-neutral-300">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Endpoint:</span>
                <span className="font-mono text-xs text-black truncate max-w-md">
                  {subgraphData?.subgraphUrl || "https://api.studio.thegraph.com/query/.../version/latest"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-black" />
                <span className="text-xs text-black font-mono">
                  {subgraphData?.mode === "live-studio" ? "Studio Live" : "Indexed Simulation"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-600 font-medium">Quick Queries:</span>
              <button
                onClick={() => setQueryType("holders")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  queryType === "holders"
                    ? "bg-black text-white font-bold border border-black"
                    : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Top Token Holders (Yield Allocation)
              </button>
              <button
                onClick={() => setQueryType("transfers")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  queryType === "transfers"
                    ? "bg-black text-white font-bold border border-black"
                    : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Recent Transfers (Mints / Secondary)
              </button>
              <button
                onClick={() => setQueryType("meta")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  queryType === "meta"
                    ? "bg-black text-white font-bold border border-black"
                    : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Subgraph Metadata (_meta)
              </button>
            </div>

            {/* Query Content Display */}
            {queryType === "holders" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                  <div className="text-xs font-semibold text-neutral-600 mb-2 flex items-center justify-between">
                    <span>Indexed Entities: `Account` & `Token`</span>
                    <span className="text-black font-mono text-[11px]">Auto-derived Flow Rates</span>
                  </div>
                  <div className="divide-y divide-neutral-200 font-mono text-xs">
                    <div className="grid grid-cols-12 py-2 text-neutral-600 font-bold uppercase text-[10px]">
                      <div className="col-span-6">Holder Address</div>
                      <div className="col-span-2 text-right">Balance</div>
                      <div className="col-span-2 text-right">Share</div>
                      <div className="col-span-2 text-right text-black">Yield/Mo</div>
                    </div>
                    {(subgraphData?.data?.holders || []).map((h: HolderData, i: number) => (
                      <div key={i} className="grid grid-cols-12 py-2.5 items-center hover:bg-neutral-50 px-1 rounded-lg">
                        <div className="col-span-6 flex items-center gap-2 truncate text-neutral-800">
                          <span className="text-neutral-500">#{i + 1}</span>
                          <span className="truncate">{h.address}</span>
                        </div>
                        <div className="col-span-2 text-right text-neutral-700">{h.formattedBalance}</div>
                        <div className="col-span-2 text-right text-black font-semibold">{h.sharePercentage}</div>
                        <div className="col-span-2 text-right text-black font-bold">
                          ${h.monthlyYieldUsd.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-neutral-700 bg-neutral-50 p-2.5 rounded-xl border border-neutral-300">
                  <strong className="text-black">How Agent Uses This:</strong> The Hermes autonomous agent calls <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">subgraph_read.get_top_holders</code> to discover shareholder proportions and immediately opens or scales continuous Superfluid CFA cashflow streams in <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">YieldVault.sol</code>.
                </p>
              </div>
            )}

            {queryType === "transfers" && (
              <div className="rounded-2xl border border-neutral-300 bg-white p-4 font-mono text-xs">
                <div className="divide-y divide-neutral-200">
                  <div className="grid grid-cols-12 py-2 text-neutral-600 font-bold uppercase text-[10px]">
                    <div className="col-span-3">Tx Hash</div>
                    <div className="col-span-4">From → To</div>
                    <div className="col-span-3 text-right">Amount</div>
                    <div className="col-span-2 text-right">Type</div>
                  </div>
                  {(subgraphData?.data?.recentTransfers || []).map((t: TransferData, i: number) => (
                    <div key={i} className="grid grid-cols-12 py-2.5 items-center hover:bg-neutral-50 px-1 rounded-lg">
                      <div className="col-span-3 truncate text-neutral-600">
                        {t.transactionHash.slice(0, 10)}...
                      </div>
                      <div className="col-span-4 text-neutral-700 truncate text-[11px]">
                        {t.from.address.slice(0, 6)}... → {t.to.address.slice(0, 6)}...
                      </div>
                      <div className="col-span-3 text-right text-black font-semibold">{t.formattedValue}</div>
                      <div className="col-span-2 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-black border border-neutral-300">
                          {t.isMintOrBurn ? "Mint" : "Transfer"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {queryType === "meta" && (
              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4 font-mono text-xs text-black">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-neutral-800">
{JSON.stringify(subgraphData?.meta || {}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Subgraph MCP Tooling */}
        {activeTab === "mcp" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
              <h4 className="font-bold text-sm text-black mb-1">Official Model Context Protocol (MCP) Integration</h4>
              <p className="text-neutral-700">
                Two dedicated MCP servers (<code className="text-black bg-neutral-200 px-1 py-0.5 rounded">subgraph_read</code> and <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">subgraph_write</code>) built with <code className="text-neutral-800 font-semibold">@modelcontextprotocol/sdk</code> allow any LLM (Hermes, Claude, Cursor, ChatGPT) to interact with The Graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                <div className="flex items-center gap-2 mb-2 font-bold text-black">
                  <span>subgraph_read (Query Suite)</span>
                </div>
                <ul className="space-y-1.5 font-mono text-neutral-600 text-[11px]">
                  <li>• <strong className="text-black">get_token_info</strong>: Name, symbol, supply, tx count</li>
                  <li>• <strong className="text-black">get_top_holders</strong>: Rank holders by balance</li>
                  <li>• <strong className="text-black">get_recent_transfers</strong>: Filter transfers/mints</li>
                  <li>• <strong className="text-black">get_account_balance</strong>: Live derived balance</li>
                  <li>• <strong className="text-black">get_biggest_transfer</strong>: Largest whale movements</li>
                  <li>• <strong className="text-black">get_deployment_status</strong>: Graph Studio IPFS hash</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                <div className="flex items-center gap-2 mb-2 font-bold text-black">
                  <span>subgraph_write (Self-Deployment)</span>
                </div>
                <p className="text-neutral-600 mb-2 text-[11px]">
                  Autonomous pipeline enabling the agent to reconfigure and redeploy Subgraphs on the fly:
                </p>
                <ul className="space-y-1.5 font-mono text-neutral-600 text-[11px]">
                  <li>• <strong className="text-black">add_token_source</strong>: Appends new RWA contract to <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">subgraph.yaml</code></li>
                  <li>• <strong className="text-black">set_token_sources</strong>: Replaces tracked token registry</li>
                  <li>• Auto-triggers <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">graph codegen &amp;&amp; graph deploy</code> to Studio</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
              <div className="text-black font-semibold mb-2">Natural Language Agent Query Example:</div>
              <div className="bg-white p-3 rounded-xl font-mono text-[11px] text-neutral-800 border border-neutral-300">
                <span className="text-neutral-500 font-semibold">&gt; User:</span> "Who owns the highest share in 456 Oak Avenue and how much yield did they earn this month?"<br />
                <span className="text-black font-bold">&gt; Hermes Agent:</span> Calling <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">subgraph_read.get_top_holders(tokenAddress: "0xf531...")</code>...<br />
                <span className="text-neutral-700">&gt; Agent Response:</span> "The top holder is 0x742d... with 250 OAK-RWA tokens (25% share). Based on monthly rental collections of $3,800, their Superfluid CFA stream continuously accrues $950.00/month."
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Track Alignment */}
        {activeTab === "architecture" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-neutral-700">
            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
              <h4 className="font-bold text-sm text-black mb-1">
                Aligned with The Graph Track: "One AI track, two ways to build"
              </h4>
              <p className="text-neutral-600">
                Prism 8 directly satisfies both halves of the track prompt + the featured x402 payment challenge.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                <span className="font-bold text-black text-sm">Way 1: Tooling for AI Environments</span>
                <p className="mt-1 text-neutral-600">
                  Built standard TypeScript Model Context Protocol (MCP) servers (<code className="text-black bg-neutral-200 px-1 py-0.5 rounded">read.ts</code> and <code className="text-black bg-neutral-200 px-1 py-0.5 rounded">write.ts</code>) enabling LLMs to run structured GraphQL queries, monitor indexing health, and autonomously mutate/redeploy Subgraph manifests without human developer intervention.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                <span className="font-bold text-black text-sm">Way 2: AI Agents Using Live Blockchain Data</span>
                <p className="mt-1 text-neutral-600">
                  The Hermes autonomous asset manager consumes The Graph as its live source of truth to index real estate fractional tokens, determine shareholder proportions, verify tenant payments, and stream continuous per-second cashflows via Superfluid CFA.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-white p-4">
                <span className="font-bold text-black text-sm">Autonomous x402 Payment Challenge</span>
                <p className="mt-1 text-neutral-600">
                  The Graph track prompt asks: <em>"or let your agent pay per query autonomously with x402."</em> Prism 8 integrates the native Hedera x402 protocol, where the agent pays 0.5 HBAR per request autonomously with Blocky402 facilitator and HCS audit receipts, proving zero-subscription machine commerce.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-neutral-200 pt-4 text-xs text-neutral-600 font-mono">
          <div className="flex items-center gap-2">
            <span>Powered by:</span>
            <span className="font-semibold text-black">The Graph</span>
            <span>·</span>
            <span className="font-semibold text-black">Superfluid</span>
            <span>·</span>
            <span className="font-semibold text-black">Hedera x402</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-black text-white px-5 py-2 font-medium hover:bg-neutral-800 transition cursor-pointer border border-black"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
