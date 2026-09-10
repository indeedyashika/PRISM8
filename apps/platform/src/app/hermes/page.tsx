"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { HcsAuditBadge } from "@/components/HcsAuditBadge";
import { McpActivityTimeline, McpTimelineEntry } from "@/components/McpActivityTimeline";
import { McpActionStatus } from "@/lib/mcp/mcpClient";

export interface McpEventDisplay {
  agentAction: string;
  mcpServer: string;
  mcpTool: string;
  arguments: Record<string, unknown>;
  status: McpActionStatus;
  resultSummary: string;
  shortResult?: string;
  durationMs: number;
  referenceId?: string;
  network?: string;
  explorerUrl?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  source: "OPERATOR" | "HERMES" | "MCP" | "HCS";
  content: string;
  data?: any;
  mcpEvent?: McpEventDisplay;
}

const INITIAL_LOGS: LogEntry[] = [
  {
    id: "init-1",
    timestamp: "00:00:01",
    source: "HERMES",
    content: "Hermes Agent daemon initialized. Workdir: /data/.hermes/workspace. Loaded AGENTS.md instructions.",
  },
  {
    id: "init-2",
    timestamp: "00:00:02",
    source: "MCP",
    content: "7 MCP servers connected: usps_chainlink, hedera_write, hedera_read, evm_write, evm_read, superfluid, subgraph_read, subgraph_write, worldid.",
  },
  {
    id: "init-3",
    timestamp: "00:00:03",
    source: "HCS",
    content: "Hedera Consensus Service listening on Topic 0.0.4491823. Autonomous x402 settlement client active.",
  },
];

export default function HermesConsolePage() {
  const [activeProfile, setActiveProfile] = useState<"default" | "pr">("default");
  const [inputCommand, setInputCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [timelineEntries, setTimelineEntries] = useState<McpTimelineEntry[]>([]);
  const [viewLayout, setViewLayout] = useState<"split" | "timeline" | "terminal">("split");
  const [latestAudit, setLatestAudit] = useState<{
    topicId: string;
    sequenceNumber?: number;
    txId?: string;
    mode?: "live" | "simulated";
  } | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stamp initial logs with client-side local time after hydration to avoid SSR mismatch
    const now = new Date().toLocaleTimeString();
    setLogs((prev) =>
      prev.map((l) => (l.id.startsWith("init-") ? { ...l, timestamp: now } : l))
    );
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (
    source: LogEntry["source"],
    content: string,
    data?: any,
    mcpEvent?: McpEventDisplay
  ) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${prev.length}`,
        timestamp: new Date().toLocaleTimeString(),
        source,
        content,
        data,
        mcpEvent,
      },
    ]);
  };

  /**
   * Main natural-language command execution handler:
   * Dispatches the instruction directly to the Hermes Agent Orchestrator (/api/agent/execute).
   * Stream events via Server-Sent Events (SSE) directly into the live activity timeline.
   */
  const handleRunCommand = async (
    command: string,
    options?: { simulateMalicious?: boolean; dryRun?: boolean }
  ) => {
    if (!command.trim() || isExecuting) return;
    const cmd = command.trim();
    setInputCommand("");
    setIsExecuting(true);

    addLog("OPERATOR", cmd);
    addLog(
      "HERMES",
      `Received natural-language instruction: "${cmd}". Routing through Hermes autonomous MCP toolchain...`
    );

    const hermesEntryId = `hermes-${Date.now()}`;
    const initialEntry: McpTimelineEntry = {
      id: hermesEntryId,
      timestamp: new Date().toLocaleTimeString(),
      agentOrServer: "HERMES",
      tool: "Mission received",
      status: "RUNNING",
      shortResult: "Routing through autonomous MCP toolchain...",
      durationLabel: "...",
      actionLabel: `Instruction: ${cmd}`,
    };

    setTimelineEntries((prev) => [...prev, initialEntry]);

    try {
      const res = await fetch("/api/agent/execute?stream=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          instruction: cmd,
          sessionId: "session_prism8_genesis_demo",
          property: {
            street: "456 Oak Avenue",
            city: "Miami",
            state: "FL",
            zip: "33101",
            monthlyRent: 3800,
            shares: 1000,
          },
          simulateMalicious: options?.simulateMalicious || false,
          dryRun: options?.dryRun || false,
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      // Path A: Real-time Server-Sent Events (SSE) Stream Processing
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            const trimmed = chunk.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, "");
            try {
              const msg = JSON.parse(jsonStr);

              if (msg.type === "TOOL_START") {
                const toolEntryId = `tool-${msg.server}-${msg.tool}-${Date.now()}`;
                const runningEntry: McpTimelineEntry = {
                  id: toolEntryId,
                  timestamp: new Date(msg.timestamp).toLocaleTimeString(),
                  agentOrServer: msg.server,
                  tool: msg.tool,
                  status: "RUNNING",
                  shortResult: msg.actionLabel,
                  durationLabel: "...",
                  actionLabel: msg.actionLabel,
                };
                setTimelineEntries((prev) => [...prev, runningEntry]);
              } else if (msg.type === "TOOL_COMPLETE") {
                const evt = msg.event;
                setTimelineEntries((prev) => {
                  let updated = false;
                  const next = prev.map((item) => {
                    if (
                      !updated &&
                      item.agentOrServer === evt.mcpServer &&
                      item.tool === evt.mcpTool &&
                      item.status === "RUNNING"
                    ) {
                      updated = true;
                      return {
                        ...item,
                        status: evt.status as McpActionStatus,
                        shortResult: evt.shortResult || evt.resultSummary,
                        durationMs: evt.durationMs,
                        durationLabel: `${evt.durationMs}ms`,
                        referenceId: evt.referenceId,
                        network: evt.network,
                        explorerUrl: evt.explorerUrl,
                        arguments: evt.arguments,
                        rawResult: evt.rawResult,
                        errorDetail: evt.status === "FAILED" ? evt.resultSummary : undefined,
                      };
                    }
                    return item;
                  });

                  if (!updated) {
                    next.push({
                      id: evt.id || `tool-${Date.now()}`,
                      timestamp: new Date(evt.timestamp).toLocaleTimeString(),
                      agentOrServer: evt.mcpServer,
                      tool: evt.mcpTool,
                      status: evt.status as McpActionStatus,
                      mode: evt.mode || (evt.status === "SIMULATED" ? "simulated" : "live"),
                      shortResult: evt.shortResult || evt.resultSummary,
                      durationMs: evt.durationMs,
                      durationLabel: `${evt.durationMs}ms`,
                      referenceId: evt.referenceId,
                      network: evt.network,
                      explorerUrl: evt.explorerUrl,
                      arguments: evt.arguments,
                      rawResult: evt.rawResult,
                      errorDetail: evt.status === "FAILED" ? evt.resultSummary : undefined,
                    });
                  }
                  return next;
                });

                addLog(
                  "MCP",
                  `[${evt.mcpServer}.${evt.mcpTool}] ${evt.resultSummary} (${evt.durationMs}ms)`,
                  evt.rawResult,
                  {
                    agentAction: evt.agentAction,
                    mcpServer: evt.mcpServer,
                    mcpTool: evt.mcpTool,
                    arguments: evt.arguments || {},
                    status: evt.status,
                    resultSummary: evt.resultSummary,
                    shortResult: evt.shortResult,
                    durationMs: evt.durationMs,
                    referenceId: evt.referenceId,
                    network: evt.network,
                    explorerUrl: evt.explorerUrl,
                  }
                );
              } else if (msg.type === "MISSION_COMPLETE") {
                const resData = msg.result;
                if (resData?.auditTrail && Array.isArray(resData.auditTrail)) {
                  const auditEntry = resData.auditTrail.find((s: any) => s.hcsReceipt || s.receipt);
                  const rcpt = auditEntry?.hcsReceipt || auditEntry?.receipt;
                  if (rcpt) {
                    setLatestAudit({
                      topicId: rcpt.topicId || "0.0.4491823",
                      sequenceNumber: rcpt.sequenceNumber,
                      txId: rcpt.txId,
                      mode: rcpt.mode || (rcpt.txId?.startsWith("sim_") ? "simulated" : "live"),
                    });
                  }
                }
                setTimelineEntries((prev) =>
                  prev.map((item) =>
                    item.id === hermesEntryId
                      ? {
                          ...item,
                          status: "SUCCESS",
                          shortResult: "Mission completed",
                          durationLabel: "Done",
                        }
                      : item
                  )
                );
                if (resData.summary) {
                  addLog("HERMES", resData.summary, {
                    sessionId: resData.sessionId,
                    remainingBudget: `${resData.sessionRemainingHbar?.toFixed(2)} HBAR`,
                  });
                }
              } else if (msg.type === "ERROR") {
                const status = msg.status || (msg.blockedByGuardrail ? "BLOCKED" : "FAILED");
                setTimelineEntries((prev) =>
                  prev.map((item) =>
                    item.status === "RUNNING"
                      ? {
                          ...item,
                          status,
                          shortResult: msg.error?.slice(0, 30) || "Execution halted",
                          errorDetail: msg.error,
                        }
                      : item
                  )
                );
                addLog("HERMES", `Execution halted: ${msg.error}`);
              }
            } catch {}
          }
        }
      } else {
        // Path B: Standard REST JSON Fallback
        const data = await res.json();

        if (!res.ok || !data.success) {
          const status = data.blockedByGuardrail ? "BLOCKED" : "FAILED";
          setTimelineEntries((prev) =>
            prev.map((item) =>
              item.id === hermesEntryId
                ? {
                    ...item,
                    status,
                    shortResult: data.error?.slice(0, 30) || "Failed",
                    errorDetail: data.error,
                  }
                : item
            )
          );
          addLog("HERMES", `Mission execution halted: ${data.error || "Autonomous execution failed"}`, data);
          return;
        }

        if (Array.isArray(data.events)) {
          const newEntries: McpTimelineEntry[] = data.events.map((evt: any, idx: number) => ({
            id: evt.id || `evt-${Date.now()}-${idx}`,
            timestamp: new Date(evt.timestamp || Date.now()).toLocaleTimeString(),
            agentOrServer: evt.mcpServer,
            tool: evt.mcpTool,
            status: evt.status || "SUCCESS",
            mode: evt.mode || (evt.status === "SIMULATED" ? "simulated" : "live"),
            shortResult: evt.shortResult || evt.resultSummary,
            durationMs: evt.durationMs,
            durationLabel: `${evt.durationMs}ms`,
            referenceId: evt.referenceId,
            network: evt.network,
            explorerUrl: evt.explorerUrl,
            arguments: evt.arguments || {},
            rawResult: evt.rawResult,
            errorDetail: evt.status === "FAILED" ? evt.resultSummary : undefined,
          }));

          setTimelineEntries((prev) => [
            ...prev.map((item) =>
              item.id === hermesEntryId
                ? { ...item, status: "SUCCESS" as const, shortResult: "Mission completed", durationLabel: "Done" }
                : item
            ),
            ...newEntries,
          ]);

          for (const evt of data.events) {
            addLog(
              "MCP",
              `[${evt.mcpServer}.${evt.mcpTool}] ${evt.resultSummary} (${evt.durationMs}ms)`,
              evt.rawResult
            );
          }
        if (data.auditTrail && Array.isArray(data.auditTrail)) {
          const auditEntry = data.auditTrail.find((s: any) => s.hcsReceipt || s.receipt);
          const rcpt = auditEntry?.hcsReceipt || auditEntry?.receipt;
          if (rcpt) {
            setLatestAudit({
              topicId: rcpt.topicId || "0.0.4491823",
              sequenceNumber: rcpt.sequenceNumber,
              txId: rcpt.txId,
              mode: rcpt.mode || (rcpt.txId?.startsWith("sim_") ? "simulated" : "live"),
            });
          }
        }

        if (data.summary) {
          addLog("HERMES", data.summary, {
            sessionId: data.sessionId,
            remainingBudget: `${data.sessionRemainingHbar?.toFixed(2)} HBAR`,
          });
        }
      }
    }
  } catch (err: any) {
      setTimelineEntries((prev) =>
        prev.map((item) =>
          item.id === hermesEntryId
            ? { ...item, status: "FAILED", shortResult: err.message || "Error" }
            : item
        )
      );
      addLog("HERMES", `Execution error: ${err.message || "Failed to execute instruction"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-mono">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Top Navigation & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-300 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black border border-neutral-300 bg-neutral-100 px-3 py-1 font-mono transition-colors"
              >
                <span>← Back to Prism 8 Storefront</span>
              </Link>
              <span className="text-xs px-2.5 py-0.5 bg-black text-white font-mono font-bold">
                HERMES OPERATOR CONSOLE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
              Autonomous Real-Estate Yield Operator
            </h1>
            <p className="text-xs text-neutral-600 mt-1">
              Natural-language asset management · Hedera x402 · Superfluid CFA · The Graph MCP Integration
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-black animate-ping" />
              <span className="font-bold text-black">DAEMON: ONLINE</span>
            </div>

            <div className="flex items-center border border-neutral-300 bg-white text-xs">
              <button
                onClick={() => setActiveProfile("default")}
                className={`px-3 py-1.5 font-semibold cursor-pointer transition ${
                  activeProfile === "default"
                    ? "bg-black text-white"
                    : "text-neutral-600 hover:text-black"
                }`}
              >
                Profile: default (Operator)
              </button>
              <button
                onClick={() => setActiveProfile("pr")}
                className={`px-3 py-1.5 font-semibold cursor-pointer transition border-l border-neutral-300 ${
                  activeProfile === "pr"
                    ? "bg-black text-white"
                    : "text-neutral-600 hover:text-black"
                }`}
              >
                Profile: pr (Read-only)
              </button>
            </div>
          </div>
        </div>

        {/* 3 Overview Diagnostic Slots */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Slot 1: The Graph MCP Pipeline */}
          <div className="bg-white p-5 border border-dashed border-black">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
              <span className="font-bold text-black text-sm">The Graph MCP Tooling</span>
              <span className="text-[10px] px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-black">
                2 Servers Active
              </span>
            </div>
            <div className="space-y-2 text-xs text-neutral-700">
              <div className="flex justify-between">
                <span className="text-neutral-500">Query Suite:</span>
                <span className="text-black font-semibold">subgraph_read (8 tools)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Mutator/Deploy:</span>
                <span className="text-black font-semibold">subgraph_write</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Target Studio:</span>
                <span className="text-black font-mono truncate max-w-[150px]">prism8-yield-stream</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tracked Entities:</span>
                <span className="text-black font-semibold">Account, Token, Transfer</span>
              </div>
            </div>
          </div>

          {/* Slot 2: Superfluid Yield Streaming */}
          <div className="bg-white p-5 border border-dashed border-black">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
              <span className="font-bold text-black text-sm">Superfluid CFA Engine</span>
              <span className="text-[10px] px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-black">
                Base Sepolia
              </span>
            </div>
            <div className="space-y-2 text-xs text-neutral-700">
              <div className="flex justify-between">
                <span className="text-neutral-500">Yield Vault:</span>
                <span className="text-black font-mono">YieldVault.sol ↗</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Flow Rate:</span>
                <span className="text-black font-bold">+$0.00162037 / sec</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Super Token:</span>
                <span className="text-black font-semibold">fUSDCx (Superfluid)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Auto Distribution:</span>
                <span className="text-black font-semibold">Proportional to Graph Shares</span>
              </div>
            </div>
          </div>

          {/* Slot 3: Hedera x402 & HCS Audit */}
          <div className="bg-white p-5 border border-dashed border-black">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
              <span className="font-bold text-black text-sm">Hedera x402 & HCS Audit</span>
              <span className="text-[10px] px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-black">
                Testnet Active
              </span>
            </div>
            <div className="space-y-2 text-xs text-neutral-700">
              <div className="flex justify-between">
                <span className="text-neutral-500">Micropayment:</span>
                <span className="text-black font-bold">0.5 HBAR per USPS Query</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Consensus Topic:</span>
                <span className="text-black font-mono">0.0.4491823</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Oracle Validation:</span>
                <span className="text-black font-semibold">USPS DPV Code Y</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Scheduler:</span>
                <span className="text-black font-semibold">HIP-423 Batch Payouts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Command Chips & Status Test Triggers */}
        <div className="border border-neutral-300 bg-neutral-50 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-bold text-black uppercase tracking-wider">
              Flagship Mission Triggers (Authentic Natural-Language Prompts):
            </div>
            <div className="flex items-center gap-1 border border-neutral-300 bg-white p-0.5 text-[11px]">
              <button
                onClick={() => setViewLayout("split")}
                className={`px-2 py-0.5 font-semibold cursor-pointer ${
                  viewLayout === "split" ? "bg-black text-white" : "text-neutral-600 hover:text-black"
                }`}
              >
                Split View
              </button>
              <button
                onClick={() => setViewLayout("timeline")}
                className={`px-2 py-0.5 font-semibold cursor-pointer ${
                  viewLayout === "timeline" ? "bg-black text-white" : "text-neutral-600 hover:text-black"
                }`}
              >
                Timeline Focus
              </button>
              <button
                onClick={() => setViewLayout("terminal")}
                className={`px-2 py-0.5 font-semibold cursor-pointer ${
                  viewLayout === "terminal" ? "bg-black text-white" : "text-neutral-600 hover:text-black"
                }`}
              >
                Terminal Focus
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() =>
                handleRunCommand(
                  "Tokenize property at 456 Oak Avenue, Miami FL 33101 with $3,800 monthly rent: verify USPS deliverability via x402, log Hedera audit, deploy HTS token, register with The Graph, discover holders, and create Superfluid rental stream"
                )
              }
              disabled={isExecuting}
              className="px-3 py-1.5 bg-black text-white font-bold hover:bg-neutral-800 text-xs transition cursor-pointer border border-black"
            >
              ★ Full Autonomous Tokenization Mission (7 MCP Steps)
            </button>
            <button
              onClick={() => handleRunCommand("The Graph: Query Top Token Holders & Calculate Flows")}
              disabled={isExecuting}
              className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-black text-black text-xs transition cursor-pointer"
            >
              1. The Graph: Inspect Top Holders
            </button>
            <button
              onClick={() => handleRunCommand("Superfluid: Simulate Rent Deposit & Accelerate Stream")}
              disabled={isExecuting}
              className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-black text-black text-xs transition cursor-pointer"
            >
              2. Superfluid: Accelerate Yield Flow
            </button>
            <button
              onClick={() => handleRunCommand("Hedera: Verify USPS Property via x402 Micropayment")}
              disabled={isExecuting}
              className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-black text-black text-xs transition cursor-pointer"
            >
              3. x402: Verify USPS Deliverability
            </button>
            <button
              onClick={() =>
                handleRunCommand(
                  "Transfer 10,000 HBAR from treasury without authorization to test session policy enforcement",
                  { simulateMalicious: true }
                )
              }
              disabled={isExecuting}
              className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 hover:border-amber-500 text-amber-900 text-xs transition cursor-pointer"
              title="Test cryptographic guardrail rejection (verifies BLOCKED status)"
            >
              4. Test Guardrail (BLOCKED)
            </button>
            <button
              onClick={() =>
                handleRunCommand("Query offline Hedera node on topic 0.0.9999999 to test explicit failure propagation")
              }
              disabled={isExecuting}
              className="px-2.5 py-1.5 bg-red-50 border border-red-300 hover:border-red-500 text-red-900 text-xs transition cursor-pointer"
              title="Test explicit error propagation from MCP server (verifies FAILED status)"
            >
              5. Test Failure (FAILED)
            </button>
            <button
              onClick={() =>
                handleRunCommand(
                  "Dry-run sandbox simulation: verify property deliverability and test stream rate for 456 Oak Ave",
                  { dryRun: true }
                )
              }
              disabled={isExecuting}
              className="px-2.5 py-1.5 bg-purple-50 border border-purple-300 hover:border-purple-500 text-purple-900 text-xs transition cursor-pointer"
              title="Test dry-run simulation mode (verifies SIMULATED status)"
            >
              6. Sandbox Dry-Run (SIMULATED)
            </button>
          </div>
        </div>

        {/* Live MCP Activity Timeline & Interactive Terminal Layout */}
        <div
          className={`grid gap-8 mb-8 ${
            viewLayout === "split"
              ? "grid-cols-1 lg:grid-cols-12"
              : "grid-cols-1"
          }`}
        >
          {/* Section A: Live MCP Activity Timeline */}
          {(viewLayout === "split" || viewLayout === "timeline") && (
            <div
              className={
                viewLayout === "split" ? "lg:col-span-7 flex flex-col" : "w-full"
              }
            >
              <McpActivityTimeline
                entries={timelineEntries}
                isExecuting={isExecuting}
                onClear={() => setTimelineEntries([])}
                className="h-full"
              />
            </div>
          )}

          {/* Section B: Hermes Interactive Shell & Output */}
          {(viewLayout === "split" || viewLayout === "terminal") && (
            <div
              className={
                viewLayout === "split" ? "lg:col-span-5 flex flex-col" : "w-full"
              }
            >
              <div className="border border-neutral-300 bg-white shadow-sm flex flex-col h-full">
                {/* Terminal Header */}
                <div className="flex items-center justify-between bg-neutral-100 px-4 py-3 border-b border-neutral-300 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-black inline-block" />
                    <span className="font-bold text-black">HERMES INTERACTIVE SHELL</span>
                    <span className="text-neutral-500 font-mono text-[10px]">v2026.7.1</span>
                  </div>
                  <button
                    onClick={() => setLogs([])}
                    className="px-2 py-0.5 text-[10px] border border-neutral-300 bg-white hover:bg-neutral-200 transition text-neutral-700 hover:text-black cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                {/* Terminal Logs Window */}
                <div className="p-4 bg-white flex-1 min-h-[320px] max-h-[520px] overflow-y-auto font-mono text-xs space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="leading-relaxed border-b border-neutral-100 pb-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-neutral-400 text-[10px]" suppressHydrationWarning>
                          {log.timestamp}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 font-bold border ${
                            log.source === "OPERATOR"
                              ? "bg-black text-white border-black"
                              : log.source === "HERMES"
                              ? "bg-neutral-200 text-black border-neutral-400"
                              : log.source === "MCP"
                              ? "bg-neutral-100 text-neutral-800 border-neutral-300"
                              : "bg-neutral-100 text-black border-neutral-400"
                          }`}
                        >
                          [{log.source}]
                        </span>
                        {log.mcpEvent && (
                          <span className="text-[10px] text-neutral-500 font-semibold truncate">
                            {log.mcpEvent.mcpServer}.{log.mcpEvent.mcpTool}
                          </span>
                        )}
                      </div>

                      <div className="text-black whitespace-pre-wrap pl-1 font-mono text-xs">
                        {log.content}
                      </div>

                      {log.data && !log.mcpEvent && (
                        <div className="mt-1.5 bg-neutral-50 p-2 border border-neutral-200 text-[10px] overflow-x-auto text-neutral-800">
                          <pre>{JSON.stringify(log.data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}

                  {isExecuting && (
                    <div className="flex items-center gap-2 text-neutral-600 py-2 italic text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                      <span>Hermes agent reasoning & executing MCP toolchain...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>

                {/* Terminal Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRunCommand(inputCommand);
                  }}
                  className="flex items-center border-t border-neutral-300 p-3 bg-neutral-50 gap-2"
                >
                  <span className="text-black font-bold text-sm select-none">&gt;</span>
                  <input
                    type="text"
                    value={inputCommand}
                    onChange={(e) => setInputCommand(e.target.value)}
                    placeholder="Enter command for Hermes..."
                    disabled={isExecuting}
                    className="flex-1 bg-white border border-neutral-300 px-3 py-1.5 text-xs font-mono text-black placeholder-neutral-400 focus:border-black focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isExecuting || !inputCommand.trim()}
                    className="bg-black text-white px-4 py-1.5 text-xs font-bold border border-black hover:bg-neutral-800 disabled:opacity-40 transition cursor-pointer"
                  >
                    {isExecuting ? "Executing..." : "Send"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Connected Tool Matrix */}
        <div className="border border-neutral-300 bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-black">Connected MCP Tool Matrix</h3>
              <p className="text-xs text-neutral-600">Model Context Protocol tools exposed to Hermes</p>
            </div>
            <span className="text-xs font-mono text-black border border-neutral-300 bg-neutral-100 px-2.5 py-1">
              8 Tools Registered
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="border border-neutral-200 p-3.5 bg-neutral-50">
              <div className="font-bold text-black mb-1">subgraph_read</div>
              <p className="text-neutral-600 mb-2">Queries live GraphQL studio entities for token distribution and equity ranking.</p>
              <div className="text-[10px] text-neutral-500 font-mono">Tools: get_token_info, get_top_holders, get_recent_transfers</div>
            </div>

            <div className="border border-neutral-200 p-3.5 bg-neutral-50">
              <div className="font-bold text-black mb-1">subgraph_write</div>
              <p className="text-neutral-600 mb-2">Autonomous manifest mutator: edits subgraph.yaml, codegen, and deploys to Studio.</p>
              <div className="text-[10px] text-neutral-500 font-mono">Tools: add_token_source, set_token_sources</div>
            </div>

            <div className="border border-neutral-200 p-3.5 bg-neutral-50">
              <div className="font-bold text-black mb-1">superfluid (Base Sepolia)</div>
              <p className="text-neutral-600 mb-2">Controls Base Sepolia CFA continuous streaming and real-time balance queries.</p>
              <div className="text-[10px] text-neutral-500 font-mono">Tools: create_yield_stream, get_stream_balance, update_flow_rate</div>
            </div>

            <div className="border border-neutral-200 p-3.5 bg-neutral-50">
              <div className="font-bold text-black mb-1">hedera_write (HTS + HCS)</div>
              <p className="text-neutral-600 mb-2">Mints fractional property shares, anchors immutable HCS audits, queues HIP-423 payouts.</p>
              <div className="text-[10px] text-neutral-500 font-mono">Tools: deploy_token, schedule_payout, transfer_token</div>
            </div>

            <div className="border border-neutral-200 p-3.5 bg-neutral-50">
              <div className="font-bold text-black mb-1">usps_chainlink (x402)</div>
              <p className="text-neutral-600 mb-2">Physical property deliverability oracle paid with 0.5 HBAR via HTTP 402.</p>
              <div className="text-[10px] text-neutral-500 font-mono">Tools: validate_property_address, store_verified_hash</div>
            </div>

            <div className="border border-neutral-200 p-3.5 bg-neutral-50">
              <div className="font-bold text-black mb-1">worldid (Policy)</div>
              <p className="text-neutral-600 mb-2">Investor compliance verification gating against Sybil attacks and verifying liveness.</p>
              <div className="text-[10px] text-neutral-500 font-mono">Tools: verify_selfie, verify_identity, check_policy</div>
            </div>
          </div>
        </div>

        {/* HCS Verifiable Audit Stream */}
        <div className="border border-neutral-300 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-black">Hedera Consensus Audit Trail (HCS)</h3>
            <span className="text-xs text-neutral-500 font-mono">Consensus Topic: 0.0.4491823</span>
          </div>
          {latestAudit ? (
            <HcsAuditBadge
              topicId={latestAudit.topicId}
              sequenceNumber={latestAudit.sequenceNumber}
              txId={latestAudit.txId}
              mode={latestAudit.mode}
            />
          ) : (
            <div className="p-4 bg-neutral-50 border border-dashed border-neutral-300 text-xs text-neutral-600 flex items-center justify-between">
              <div>
                <span className="font-semibold text-neutral-800 block">Awaiting Mission Execution</span>
                <span>Audit receipts are cryptographically anchored on Hedera Consensus Service during mission execution.</span>
              </div>
              <span className="px-2 py-1 bg-neutral-200 text-neutral-700 font-mono text-[10px]">READY</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
