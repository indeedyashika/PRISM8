<!-- Logo / Banner placeholder: user will add later -->

# Prism 8 — Autonomous Real-Estate Yield Streaming Engine

**Prism 8** is a next-generation autonomous **Real-Estate Tokenization & Continuous Yield Streaming Engine**. It combines **Hedera x402** machine-to-machine payments, **Hedera Token Service (HTS)** fractionalization, **Superfluid CFA** per-second yield streaming on Base Sepolia, **The Graph** autonomous indexing & Model Context Protocol (MCP) tooling, and **USPS Chainlink Functions** physical address validation.

Built for **ETHGlobal 2026**:
* **Hedera Track**: Agentic Economy x402 Machine-to-Machine Challenge
* **The Graph Track**: One AI Track, Two Ways to Build
* **Superfluid Track**: Real-time continuous cashflow & EVM yield streaming
* **Chainlink / World ID**: Verifiable physical deliverability & investor identity

---

## ⚡ 1. Hedera x402 Machine-to-Machine Payment Rail

The agentic economy requires payment rails that operate at machine speed: sub-second finality, predictable sub-cent fees, and native token operations without smart contract overhead.

Prism 8 delivers:
1. **Live x402-gated service on Hedera Testnet**: A metered property verification & physical address validation oracle (`/api/x402/property-oracle`) settled through the **Blocky402** facilitator.
2. **Autonomous Consuming Agent (Hermes)**: Hermes detects `HTTP 402 Payment Required` challenges, signs and broadcasts micropayments (0.5 HBAR) on Hedera testnet, and completes paid queries end-to-end with **zero human intervention, no API keys, and no subscriptions**.
3. **Verifiable Payment Audit Trails on HCS**: Every settlement is anchored to a **Hedera Consensus Service (HCS) Topic**, creating an unforgeable, consensus-timestamped public audit log verifiable on HashScan.
4. **Scheduled Transactions for Yield**: Rent distributions are queued and scheduled via native Hedera `ScheduleCreate` transactions (HIP-423).
5. **Agent Discovery Directory**: Public machine-readable service directory exposed at `/.well-known/agent-services.json` and `/api/x402/directory`.

---

## 📊 2. The Graph Track: "One AI track, two ways to build"

Prism 8 fulfills **both halves** of The Graph hackathon track plus the featured x402 payment challenge:

```
                            ┌──────────────────────────────────────┐
                            │    Hermes Autonomous AI Agent        │
                            └──────────────────┬───────────────────┘
                                               │
             ┌─────────────────────────────────┴────────────────────────────────┐
             │ (Model Context Protocol)                                         │ (Model Context Protocol)
             ▼                                                                  ▼
┌──────────────────────────────┐                                   ┌──────────────────────────────┐
│  subgraph_read MCP Server    │                                   │  subgraph_write MCP Server   │
│ - get_top_holders            │                                   │ - add_token_source           │
│ - get_token_info             │                                   │ - set_token_sources          │
│ - get_recent_transfers       │                                   │ - Auto `graph codegen`       │
│ - get_account_balance        │                                   │ - Auto `graph deploy` to     │
│ - get_deployment_status      │                                   │   Graph Studio               │
└──────────────┬───────────────┘                                   └──────────────┬───────────────┘
               │                                                                  │
               ▼ (GraphQL Queries)                                                ▼ (Automated Manifest Mutation)
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               The Graph Studio (Sepolia Subgraph)                               │
│                         Entities: Token  •  Account  •  Transfer                                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │
                                               ▼ (Live Shareholder Distribution)
                                ┌──────────────────────────────┐
                                │ Superfluid YieldVault.sol    │
                                │ (Continuous CFA Cashflows)   │
                                └──────────────────────────────┘
```

### Way 1: Tooling for AI Environments
* **Dual MCP Servers (`@modelcontextprotocol/sdk`)**:
  * [`apps/agent/mcps/subgraph/mcp-server/src/read.ts`](apps/agent/mcps/subgraph/mcp-server/src/read.ts) (**`subgraph_read`**): Equips LLM agents with 8 tools to query on-chain indexed data in natural language (`get_token_info`, `get_top_holders`, `get_recent_transfers`, `get_account_balance`, `get_biggest_transfer`, `get_tracked_tokens`, `get_deployment_status`).
  * [`apps/agent/mcps/subgraph/mcp-server/src/write.ts`](apps/agent/mcps/subgraph/mcp-server/src/write.ts) (**`subgraph_write`**): Autonomous manifest mutation pipeline (`add_token_source`, `set_token_sources`) that dynamically rewrites `subgraph.yaml`, executes `graph codegen`, builds, and redeploys to Graph Studio with zero human intervention.
* **Featured x402 Autonomous Payment Challenge**:
  * The Graph track prompt asks: *"or let your agent pay per query autonomously with x402"*.
  * Prism 8 implements this via native Hedera x402 + Blocky402 facilitator, allowing agents to pay for data queries and oracles per call with zero subscription lock-in.

### Way 2: AI Agent Using Live Blockchain Data
* **Autonomous Real-Estate Yield Allocation**: The Hermes agent uses `subgraph_read.get_top_holders` to query live fractional real-estate ownership distributions, deriving proportional shareholder percentages to open Superfluid CFA cashflow streams.
* **Public Token Chat**: Investors query their token metrics in natural language via `/api/tokens/[tokenId]/chat`, where Hermes consults The Graph in real-time.
* **The Graph AI Inspector**: Interactive modal on the storefront homepage allowing users and judges to run live GraphQL queries, test MCP tool calls, and inspect indexer sync health.

---

## 🌊 3. Continuous Real-Time Yield Streaming (Superfluid CFA)

Unlike traditional platforms that distribute rental yield once a month, Prism 8 streams cashflows **per-second**:
* Rental inflows are deposited into `YieldVault.sol` on Base Sepolia (wrapping stablecoins into `fUSDCx` Super Tokens).
* Continuous Flow Agreements (CFA) stream yield directly into fractional token holders' wallets every second:
  $$\text{flowRate} = \frac{\text{monthlyRentUsd} \times \text{investorShareRatio}}{2,592,000 \text{ seconds}}$$
* **Real-time Ticking Dashboard**: Storefront UI ticks every 80ms, visually rendering cashflow streaming continuously into the investor's balance.
* **Tenant Simulator**: One-click "Simulate Tenant Rent Payment" button injects rent payments and triggers dynamic flow-rate adjustments.

---

## 🏛️ Full System Architecture

```
                           ┌──────────────────────────────────────────────┐
                           │      Public Next.js Storefront & App         │
                           │  - Real-Estate Listing Form (USPS verified)  │
                           │  - Live Superfluid Yield Ticker Dashboard    │
                           │  - "The Graph AI Inspector" Modal            │
                           │  - "Simulate Tenant Rent Payment" Trigger    │
                           │  - World ID Verification Modal               │
                           └──────────────────────┬───────────────────────┘
                                                  │ (REST / Webhooks)
                                                  ▼
                           ┌──────────────────────────────────────────────┐
                           │     Hermes Autonomous Operator Console       │
                           │  - Natural language property tokenization    │
                           │  - Mandatory USPS address check policy       │
                           │  - The Graph holder distribution discovery   │
                           │  - Automated per-second flow rate math       │
                           │  - Real-time stream management & freezing    │
                           └──────────────────────┬───────────────────────┘
                                                  │ (MCP Protocol)
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
      ┌─────────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
      │ usps_chainlink_mcp  │          │   superfluid_mcp    │          │  subgraph_read/write│
      │  (Address & x402)   │          │  (CFA Stream Mgmt)  │          │ (GraphQL & Deploy)  │
      └──────────┬──────────┘          └──────────┬──────────┘          └──────────┬──────────┘
                 │                                │                                │
                 ├────────────────────────┐       │                                │
                 ▼                        ▼       ▼                                ▼
┌──────────────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────────────────────────┐
│          Hedera Testnet          │ │      HCS Audit Topic      │ │        Base Sepolia / The Graph      │
│ - x402 Oracle Payment Settlement │ │ - Consensus timestamps    │ │ - PropertyRegistry.sol (Metadata)   │
│ - Native HTS Real-Estate Shares  │ │ - Publicly auditable on   │ │ - YieldVault.sol (Rent Staking)     │
│ - Scheduled Yield Transactions   │ │   HashScan                │ │ - Superfluid CFAv1 (fUSDCx Streams) │
│ - Blocky402 Facilitator          │ │                           │ │ - The Graph Studio Subgraph Indexer │
└──────────────────────────────────┘ └───────────────────────────┘ └──────────────────────────────────────┘
```

---

## 🤖 Registered Hermes MCP Servers

Hermes is equipped with 6 specialized MCP servers:

1. **`usps_chainlink`** — Validates physical property addresses against USPS records, intercepts and settles x402 challenges on Hedera, and anchors verified hashes.
2. **`superfluid`** — Opens, updates, monitors, and freezes per-second CFA yield streams on Base Sepolia (`fUSDCx`).
3. **`subgraph_read`** — Queries indexed ERC-20 token distributions, holders, and transfer events via The Graph GraphQL API.
4. **`subgraph_write`** — Autonomously mutates `subgraph.yaml` and redeploys new property contracts to Graph Studio via CLI.
5. **`hedera`** — Deploys and manages fractional real-estate shares via native HTS with compliance controls.
6. **`worldid`** — Verifies investor identity and selfie proofs in the trusted backend.

---

## 🚀 Quickstart & Running Locally

### 1. Run the Platform & Contracts (Next.js)
```bash
cd apps/platform
cp .env.example .env
npm install
npm run compile:contracts
npm run dev
```
Open `http://localhost:3000` to view the storefront, live stream dashboard, The Graph AI Inspector, and rent simulator.

### 2. Run the Verification Test Suite
```bash
# 1. Test x402 Property Oracle Protocol & Discovery
node apps/platform/scripts/test-x402-oracle.mjs

# 2. Test Smart Contracts (PropertyRegistry, YieldVault, USPSChainlinkConsumer)
node apps/platform/scripts/test-contracts.mjs

# 3. Test The Graph Subgraph Manifest, MCP Tools & API Route
node apps/platform/scripts/test-subgraph.mjs

# 4. Test usps_chainlink MCP (Python)
python apps/agent/mcps/usps_chainlink/test_server.py

# 5. Test superfluid MCP (Python)
python apps/agent/mcps/superfluid/test_server.py
```

### 3. Deploy to Railway
Keep root directory at `/`. Railway builds `apps/agent/Dockerfile` with the whole repository as context, running Next.js, Hermes, and all MCP servers in a single unified container.

---

## 🎬 Hackathon Demo Script & Track Walkthrough
See [`docs/demo-script.md`](docs/demo-script.md) for the step-by-step judge walkthrough covering:
1. Agent service discovery at `/.well-known/agent-services.json`
2. Autonomous x402 micropayment on Hedera Testnet (0.5 HBAR)
3. USPS DPV delivery verification & HTS token minting
4. The Graph AI Inspector & live shareholder GraphQL discovery
5. Continuous Superfluid per-second yield streaming on Base Sepolia
6. HCS verifiable consensus audit trail on HashScan

---

## 📜 Credits & Sponsors
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- [Blocky402 Facilitator](https://blocky402.com/) & [Hedera Hashgraph](https://hedera.com/)
- [The Graph](https://thegraph.com/)
- [Superfluid Finance](https://superfluid.finance/)
- [Chainlink Functions](https://chain.link/functions)
- [World ID](https://worldcoin.org/world-id)
