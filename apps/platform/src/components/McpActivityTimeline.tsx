"use client";

import React, { useState, useMemo } from "react";
import { McpActionStatus } from "@/lib/mcp/mcpClient";

export interface McpTimelineEntry {
  id: string;
  timestamp: string; // e.g. "18:42:01"
  agentOrServer: string; // e.g. "HERMES", "usps_chainlink", "hedera_write", etc.
  tool: string; // e.g. "validate_property_address", "deploy_token"
  status: McpActionStatus;
  shortResult: string; // e.g. "DPV = Y", "0.5 HBAR", "0.0001466/sec"
  durationMs?: number;
  durationLabel?: string; // e.g. "241ms", "1.2s"
  // Technical details
  actionLabel?: string;
  network?: string;
  referenceId?: string;
  explorerUrl?: string;
  arguments?: Record<string, unknown>;
  rawResult?: unknown;
  errorDetail?: string;
}

interface McpActivityTimelineProps {
  entries: McpTimelineEntry[];
  isExecuting?: boolean;
  onClear?: () => void;
  className?: string;
}

export function McpActivityTimeline({
  entries,
  isExecuting = false,
  onClear,
  className = "",
}: McpActivityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLog, setCopiedLog] = useState(false);

  // Toggle individual row expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(entries.map((e) => e.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleCopyJson = (id: string, data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopyTextLog = () => {
    const formatted = entries
      .map(
        (e) =>
          `${e.timestamp}\n${e.agentOrServer}\n${e.tool}\n${e.status}\n${e.shortResult}${
            e.durationLabel ? `\n${e.durationLabel}` : ""
          }`
      )
      .join("\n\n");
    navigator.clipboard.writeText(formatted);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (activeFilter === "ALL") return entries;
    return entries.filter((e) => e.status === activeFilter);
  }, [entries, activeFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = entries.length;
    const successCount = entries.filter((e) => e.status === "SUCCESS").length;
    const failedCount = entries.filter((e) => e.status === "FAILED").length;
    const blockedCount = entries.filter((e) => e.status === "BLOCKED").length;
    const simulatedCount = entries.filter((e) => e.status === "SIMULATED").length;
    const runningCount = entries.filter((e) => e.status === "RUNNING").length;
    const totalDurationMs = entries.reduce((acc, e) => acc + (e.durationMs || 0), 0);

    const servers = new Set(
      entries.map((e) => e.agentOrServer).filter((s) => s && s !== "HERMES")
    );

    return {
      total,
      successCount,
      failedCount,
      blockedCount,
      simulatedCount,
      runningCount,
      totalDurationMs,
      serverCount: servers.size,
    };
  }, [entries]);

  // Status badge style helper
  const getStatusBadge = (status: McpActionStatus) => {
    switch (status) {
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-neutral-950 text-neutral-100 border border-neutral-700 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            RUNNING
          </span>
        );
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span className="text-emerald-600 font-bold">✓</span>
            SUCCESS
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-800 border border-red-300">
            <span className="text-red-600 font-bold">✕</span>
            FAILED
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="text-amber-600 font-bold">⚠</span>
            BLOCKED
          </span>
        );
      case "SIMULATED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-300">
            <span className="text-purple-600 font-bold">◇</span>
            SIMULATED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      className={`border border-neutral-300 bg-white shadow-sm font-mono text-xs ${className}`}
    >
      {/* Institutional Top Bar */}
      <div className="bg-neutral-100 px-4 py-3 border-b border-neutral-300 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isExecuting
                ? "bg-blue-600 animate-ping"
                : entries.length > 0
                ? "bg-black"
                : "bg-neutral-400"
            }`}
          />
          <div>
            <span className="font-bold text-black tracking-tight">
              LIVE MCP ACTIVITY TIMELINE
            </span>
            <span className="text-neutral-500 text-[10px] ml-2">
              Model Context Protocol Execution Trace
            </span>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <>
              <button
                onClick={handleCopyTextLog}
                className="px-2 py-1 text-[10px] border border-neutral-300 bg-white hover:bg-neutral-200 transition text-neutral-700 hover:text-black cursor-pointer font-semibold"
                title="Copy structured plain text timeline to clipboard"
              >
                {copiedLog ? "✓ Copied Log" : "Copy Log"}
              </button>
              <button
                onClick={expandedIds.size > 0 ? handleCollapseAll : handleExpandAll}
                className="px-2 py-1 text-[10px] border border-neutral-300 bg-white hover:bg-neutral-200 transition text-neutral-700 hover:text-black cursor-pointer"
              >
                {expandedIds.size > 0 ? "Collapse All" : "Expand All"}
              </button>
              {onClear && (
                <button
                  onClick={onClear}
                  className="px-2 py-1 text-[10px] border border-neutral-300 bg-white hover:bg-neutral-200 transition text-neutral-700 hover:text-black cursor-pointer"
                >
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Aggregate Metric Ribbon */}
      <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-neutral-600">
        <div>
          <span className="text-neutral-400 block text-[9px] uppercase tracking-wider">
            Total Invocations
          </span>
          <span className="font-bold text-black text-xs">{stats.total} calls</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[9px] uppercase tracking-wider">
            Execution Status
          </span>
          <span className="font-semibold text-neutral-800 text-xs">
            {stats.failedCount > 0 ? (
              <span className="text-red-700 font-bold">{stats.failedCount} Failed</span>
            ) : stats.blockedCount > 0 ? (
              <span className="text-amber-700 font-bold">{stats.blockedCount} Blocked</span>
            ) : stats.runningCount > 0 ? (
              <span className="text-blue-700 font-bold">Executing...</span>
            ) : stats.total > 0 ? (
              <span className="text-emerald-700 font-bold">100% Succeeded</span>
            ) : (
              "Idle"
            )}
          </span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[9px] uppercase tracking-wider">
            Cumulative Duration
          </span>
          <span className="font-mono text-black text-xs">
            {stats.totalDurationMs > 0 ? `${stats.totalDurationMs}ms` : "—"}
          </span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[9px] uppercase tracking-wider">
            MCP Servers Invoked
          </span>
          <span className="font-mono text-black text-xs">
            {stats.serverCount > 0 ? `${stats.serverCount} active` : "0 active"}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      {entries.length > 0 && (
        <div className="px-4 py-2 border-b border-neutral-200 bg-white flex flex-wrap items-center gap-1 text-[11px]">
          <span className="text-neutral-400 text-[10px] mr-2">Filter:</span>
          {(
            [
              { label: `ALL (${stats.total})`, value: "ALL", show: true },
              { label: `RUNNING (${stats.runningCount})`, value: "RUNNING", show: stats.runningCount > 0 },
              { label: `SUCCESS (${stats.successCount})`, value: "SUCCESS", show: stats.successCount > 0 },
              { label: `FAILED (${stats.failedCount})`, value: "FAILED", show: stats.failedCount > 0 },
              { label: `BLOCKED (${stats.blockedCount})`, value: "BLOCKED", show: stats.blockedCount > 0 },
              { label: `SIMULATED (${stats.simulatedCount})`, value: "SIMULATED", show: stats.simulatedCount > 0 },
            ]
          )
            .filter((t) => t.show !== false)
            .map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={`px-2 py-0.5 font-semibold text-[10px] transition cursor-pointer border ${
                  activeFilter === tab.value
                    ? "bg-black text-white border-black"
                    : "bg-neutral-100 text-neutral-600 border-neutral-300 hover:text-black"
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      )}

      {/* Table Column Labels Header */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-neutral-100 border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
        <div className="col-span-1">Timestamp</div>
        <div className="col-span-3">Agent / MCP Server</div>
        <div className="col-span-3">Tool</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Short Result</div>
        <div className="col-span-1 text-right">Duration</div>
      </div>

      {/* Timeline Event Feed */}
      <div className="divide-y divide-neutral-200 max-h-[520px] overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 space-y-2">
            <div className="text-black font-bold text-sm">
              {isExecuting ? "Initializing Autonomous Toolchain..." : "Standby: Awaiting Mission"}
            </div>
            <p className="text-xs text-neutral-600 max-w-md mx-auto">
              {isExecuting
                ? "Hermes agent is actively evaluating natural-language instructions and invoking MCP servers..."
                : "No MCP tools executed yet. Submit a natural-language mission or click a Flagship Mission trigger to watch real-time MCP activity."}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedIds.has(entry.id);

            return (
              <div
                key={entry.id}
                className={`transition-colors ${
                  entry.status === "FAILED"
                    ? "bg-red-50/30 hover:bg-red-50/60"
                    : entry.status === "BLOCKED"
                    ? "bg-amber-50/30 hover:bg-amber-50/60"
                    : entry.status === "RUNNING"
                    ? "bg-blue-50/30 hover:bg-blue-50/50"
                    : "hover:bg-neutral-50"
                }`}
              >
                {/* Main Summary Row */}
                <div
                  onClick={() => toggleExpand(entry.id)}
                  className="px-4 py-2.5 cursor-pointer flex flex-col md:grid md:grid-cols-12 gap-2 items-start md:items-center text-xs"
                >
                  {/* Timestamp */}
                  <div className="col-span-1 text-neutral-500 text-[11px] font-mono whitespace-nowrap">
                    {entry.timestamp}
                  </div>

                  {/* Agent / MCP Server */}
                  <div className="col-span-3 flex items-center gap-1.5 truncate max-w-full">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold border font-mono truncate ${
                        entry.agentOrServer === "HERMES"
                          ? "bg-black text-white border-black"
                          : "bg-neutral-100 text-black border-neutral-300"
                      }`}
                    >
                      {entry.agentOrServer}
                    </span>
                  </div>

                  {/* Tool */}
                  <div className="col-span-3 font-semibold text-black font-mono truncate max-w-full">
                    {entry.tool}
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-2 whitespace-nowrap">
                    {getStatusBadge(entry.status)}
                  </div>

                  {/* Short Result */}
                  <div className="col-span-2 font-mono font-medium text-neutral-800 text-[11px] truncate max-w-full">
                    {entry.shortResult || "—"}
                  </div>

                  {/* Duration & Expand Chevron */}
                  <div className="col-span-1 flex items-center justify-end gap-2 text-right">
                    <span className="text-neutral-500 text-[11px] font-mono whitespace-nowrap">
                      {entry.durationLabel || (entry.durationMs !== undefined ? `${entry.durationMs}ms` : "—")}
                    </span>
                    <span className="text-neutral-400 text-[10px] select-none">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expandable Technical Details Drawer */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-neutral-50 border-t border-dashed border-neutral-200 text-[11px] space-y-2.5 ml-0 md:ml-6 mb-2 mr-2 border-l-2 border-l-black">
                    {/* Action Description */}
                    {entry.actionLabel && (
                      <div className="text-black font-bold flex items-center gap-2">
                        <span>Action:</span>
                        <span className="font-mono font-normal text-neutral-700">
                          {entry.actionLabel}
                        </span>
                      </div>
                    )}

                    {/* Network & Protocol Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                      {entry.network && (
                        <div>
                          <span className="text-neutral-500">Network / Environment: </span>
                          <span className="font-semibold text-black">{entry.network}</span>
                        </div>
                      )}
                      {entry.referenceId && (
                        <div>
                          <span className="text-neutral-500">Tx / Reference ID: </span>
                          {entry.explorerUrl ? (
                            <a
                              href={entry.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-black font-semibold underline hover:text-neutral-600 truncate inline-block max-w-[220px] align-bottom"
                            >
                              {entry.referenceId} ↗
                            </a>
                          ) : (
                            <span className="font-semibold text-black font-mono">
                              {entry.referenceId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Explicit Error Display if Failed */}
                    {(entry.status === "FAILED" || entry.errorDetail) && (
                      <div className="p-2.5 bg-red-100/60 border border-red-300 text-red-800 text-[11px] font-mono rounded">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-red-900">
                          <span>✕</span>
                          <span>MCP Tool Execution Failure</span>
                        </div>
                        <div className="whitespace-pre-wrap">
                          {entry.errorDetail || entry.shortResult}
                        </div>
                      </div>
                    )}

                    {/* Explicit Guardrail Display if Blocked */}
                    {entry.status === "BLOCKED" && (
                      <div className="p-2.5 bg-amber-100/60 border border-amber-300 text-amber-900 text-[11px] font-mono rounded">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
                          <span>⚠</span>
                          <span>Session Guardrail Violation Rejection</span>
                        </div>
                        <div>Action blocked cryptographically by session policy guardrail.</div>
                      </div>
                    )}

                    {/* Sanitized Tool Arguments */}
                    {entry.arguments && Object.keys(entry.arguments).length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-semibold">
                          <span>Tool Arguments (Sanitized)</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyJson(`args-${entry.id}`, entry.arguments);
                            }}
                            className="text-black hover:underline cursor-pointer"
                          >
                            {copiedId === `args-${entry.id}` ? "Copied" : "Copy JSON"}
                          </button>
                        </div>
                        <div className="bg-white border border-neutral-200 p-2 font-mono text-[10px] overflow-x-auto text-neutral-800 max-h-36">
                          <pre>{JSON.stringify(entry.arguments, null, 2)}</pre>
                        </div>
                      </div>
                    )}

                    {/* Raw Result Payload */}
                    {entry.rawResult !== undefined && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-semibold">
                          <span>Raw MCP Return Data</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyJson(`res-${entry.id}`, entry.rawResult);
                            }}
                            className="text-black hover:underline cursor-pointer"
                          >
                            {copiedId === `res-${entry.id}` ? "Copied" : "Copy JSON"}
                          </button>
                        </div>
                        <div className="bg-white border border-neutral-200 p-2 font-mono text-[10px] overflow-x-auto text-neutral-800 max-h-48">
                          <pre>
                            {typeof entry.rawResult === "object"
                              ? JSON.stringify(entry.rawResult, null, 2)
                              : String(entry.rawResult)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
