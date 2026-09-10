import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SubgraphQueryBody {
  query?: string;
  variables?: Record<string, unknown>;
  action?: "top_holders" | "transfers" | "token_info" | "status";
  tokenAddress?: string;
}

const DEMO_SUBGRAPH_DATA = {
  tokens: [
    {
      id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0",
      name: "456 Oak Avenue Fractional RWA",
      symbol: "OAK-RWA",
      decimals: 18,
      transferCount: "142",
      totalHolders: 18,
    },
    {
      id: "0x10279e6333f9d0ee103f4715b8aaea75be61464c",
      name: "789 Pine Blvd Commercial Vault",
      symbol: "PINE-YIELD",
      decimals: 18,
      transferCount: "89",
      totalHolders: 12,
    },
  ],
  holders: [
    {
      address: "0x742d35cc6634c0532925a3b844bc454e4438f44e",
      token: { id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0", symbol: "OAK-RWA" },
      balance: "250000000000000000000", // 250 tokens (25% share)
      formattedBalance: "250.00",
      sharePercentage: "25.00%",
      monthlyYieldUsd: 950.0,
      sentCount: "2",
      receivedCount: "4",
    },
    {
      address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      token: { id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0", symbol: "OAK-RWA" },
      balance: "150000000000000000000", // 150 tokens (15% share)
      formattedBalance: "150.00",
      sharePercentage: "15.00%",
      monthlyYieldUsd: 570.0,
      sentCount: "0",
      receivedCount: "3",
    },
    {
      address: "0x28a8746e75304c0780e011bed21c72cd78cd535e",
      token: { id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0", symbol: "OAK-RWA" },
      balance: "100000000000000000000", // 100 tokens (10% share - Investor Demo)
      formattedBalance: "100.00",
      sharePercentage: "10.00%",
      monthlyYieldUsd: 380.0,
      sentCount: "1",
      receivedCount: "2",
    },
    {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      token: { id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0", symbol: "OAK-RWA" },
      balance: "80000000000000000000",
      formattedBalance: "80.00",
      sharePercentage: "8.00%",
      monthlyYieldUsd: 304.0,
      sentCount: "0",
      receivedCount: "1",
    },
  ],
  recentTransfers: [
    {
      id: "0xabc123-1",
      token: { id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0", symbol: "OAK-RWA" },
      from: { address: "0x0000000000000000000000000000000000000000" },
      to: { address: "0x742d35cc6634c0532925a3b844bc454e4438f44e" },
      value: "250000000000000000000",
      formattedValue: "250.00 OAK-RWA",
      isMintOrBurn: true,
      blockNumber: "11350120",
      blockTimestamp: Math.floor(Date.now() / 1000) - 3600 * 24,
      transactionHash: "0x4e8d35a9f2421319c5225c5f49ef2ff445a5dbe4223403a4bcf3c95977ba2f9a",
    },
    {
      id: "0xdef456-2",
      token: { id: "0xf531b8f309be94191af87605cfbf600d71c2cfe0", symbol: "OAK-RWA" },
      from: { address: "0x742d35cc6634c0532925a3b844bc454e4438f44e" },
      to: { address: "0x28a8746e75304c0780e011bed21c72cd78cd535e" },
      value: "100000000000000000000",
      formattedValue: "100.00 OAK-RWA",
      isMintOrBurn: false,
      blockNumber: "11350350",
      blockTimestamp: Math.floor(Date.now() / 1000) - 3600 * 4,
      transactionHash: "0x892a013ef312384a838df483920afcaee3847291038573928173928193850183",
    },
  ],
  meta: {
    deployment: "QmQ65v4hUvG1K3T6q21bL5f9N4d9zXJ8pD32A1f6K9z1ab",
    subgraphName: "liquiditystream-rwa",
    network: "sepolia",
    block: {
      number: 11350480,
      timestamp: Math.floor(Date.now() / 1000) - 120,
    },
    hasIndexingErrors: false,
    synced: true,
  },
};

export async function GET() {
  const subgraphUrl = process.env.SUBGRAPH_URL;
  const isLive = Boolean(subgraphUrl && subgraphUrl.startsWith("http"));

  return NextResponse.json({
    status: "ok",
    subgraphUrl: subgraphUrl || "https://api.studio.thegraph.com/query/example/liquiditystream-rwa/version/latest",
    isLive,
    mode: isLive ? "live-studio" : "demonstration-mode",
    meta: DEMO_SUBGRAPH_DATA.meta,
    schemaEntities: ["Token", "Account", "Transfer"],
    mcpTools: {
      read: [
        "get_token_info",
        "get_biggest_transfer",
        "get_top_holders",
        "get_recent_transfers",
        "get_account_balance",
        "get_latest_sepolia_block",
        "get_tracked_tokens",
        "get_deployment_status",
      ],
      write: ["add_token_source", "set_token_sources"],
    },
    data: {
      tokens: DEMO_SUBGRAPH_DATA.tokens,
      holders: DEMO_SUBGRAPH_DATA.holders,
      recentTransfers: DEMO_SUBGRAPH_DATA.recentTransfers,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body: SubgraphQueryBody = await req.json();
    const subgraphUrl = process.env.SUBGRAPH_URL;

    // If live SUBGRAPH_URL is configured, proxy GraphQL query directly
    if (subgraphUrl && subgraphUrl.startsWith("http") && body.query) {
      try {
        const response = await fetch(subgraphUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: body.query,
            variables: body.variables || {},
          }),
        });
        const resData = await response.json();
        return NextResponse.json(resData);
      } catch (err: any) {
        console.warn("[Subgraph Route] Upstream fetch error:", err.message);
      }
    }

    // Otherwise return rich simulated GraphQL response for client demo
    if (body.action === "top_holders") {
      return NextResponse.json({
        data: {
          accounts: DEMO_SUBGRAPH_DATA.holders,
        },
      });
    }

    if (body.action === "transfers") {
      return NextResponse.json({
        data: {
          transfers: DEMO_SUBGRAPH_DATA.recentTransfers,
        },
      });
    }

    if (body.action === "token_info") {
      return NextResponse.json({
        data: {
          tokens: DEMO_SUBGRAPH_DATA.tokens,
        },
      });
    }

    // Default mock response executing the incoming query structure
    return NextResponse.json({
      data: {
        tokens: DEMO_SUBGRAPH_DATA.tokens,
        accounts: DEMO_SUBGRAPH_DATA.holders,
        transfers: DEMO_SUBGRAPH_DATA.recentTransfers,
        _meta: DEMO_SUBGRAPH_DATA.meta,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute subgraph query" },
      { status: 500 }
    );
  }
}
