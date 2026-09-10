import crypto from "node:crypto";

export interface SessionPolicyConstraints {
  maxSpendHbar: number;
  maxFlowRateMonthlyUsd: number;
  allowedActions: string[];
  durationHours: number;
}

export interface AgentSessionRecord {
  sessionId: string;
  grantor: string;
  agentId: string;
  constraints: SessionPolicyConstraints;
  spentHbar: number;
  activeStreamsCount: number;
  createdAt: number;
  expiresAt: number;
  signature: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
  remainingHbar: number;
  session?: AgentSessionRecord;
}

// In-memory session registry (persists across runtime turns)
const sessionRegistry = new Map<string, AgentSessionRecord>();

// Default demo fallback session if user hasn't signed yet
const DEFAULT_GRANTOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const defaultSession: AgentSessionRecord = {
  sessionId: "session_prism8_genesis_demo",
  grantor: DEFAULT_GRANTOR,
  agentId: "hermes-agentic-operator",
  constraints: {
    maxSpendHbar: 5.0,
    maxFlowRateMonthlyUsd: 5000,
    allowedActions: [
      "ORACLE_USPS_X402",
      "HCS_CONSENSUS_AUDIT",
      "SUBGRAPH_HOLDER_DISCOVERY",
      "CFA_YIELD_STREAM_START",
      "CFA_YIELD_STREAM_ADJUST",
      "COMPLIANCE_FREEZE",
    ],
    durationHours: 24,
  },
  spentHbar: 0.5,
  activeStreamsCount: 1,
  createdAt: Date.now() - 3600000,
  expiresAt: Date.now() + 82800000,
  signature: "0x38ba6156ac3f289611f7c11f421e9c8f01b50e0d17dc79c8a9f4c3217b58a129d21e843f5451e944738590172bf4212a1c",
  status: "ACTIVE",
};

sessionRegistry.set(DEFAULT_GRANTOR.toLowerCase(), defaultSession);
sessionRegistry.set(defaultSession.sessionId, defaultSession);

export function getActiveSession(grantorAddress?: string): AgentSessionRecord {
  if (grantorAddress) {
    const found = sessionRegistry.get(grantorAddress.toLowerCase());
    if (found && found.expiresAt > Date.now() && found.status === "ACTIVE") {
      return found;
    }
  }
  return defaultSession;
}

export function createSessionGrant(
  grantor: string,
  signature: string,
  customConstraints?: Partial<SessionPolicyConstraints>
): AgentSessionRecord {
  const constraints: SessionPolicyConstraints = {
    maxSpendHbar: customConstraints?.maxSpendHbar ?? 5.0,
    maxFlowRateMonthlyUsd: customConstraints?.maxFlowRateMonthlyUsd ?? 5000,
    allowedActions: customConstraints?.allowedActions ?? [
      "ORACLE_USPS_X402",
      "HCS_CONSENSUS_AUDIT",
      "SUBGRAPH_HOLDER_DISCOVERY",
      "CFA_YIELD_STREAM_START",
      "CFA_YIELD_STREAM_ADJUST",
      "COMPLIANCE_FREEZE",
    ],
    durationHours: customConstraints?.durationHours ?? 24,
  };

  const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const record: AgentSessionRecord = {
    sessionId,
    grantor: grantor.toLowerCase(),
    agentId: "hermes-agentic-operator",
    constraints,
    spentHbar: 0,
    activeStreamsCount: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + constraints.durationHours * 3600000,
    signature,
    status: "ACTIVE",
  };

  sessionRegistry.set(grantor.toLowerCase(), record);
  sessionRegistry.set(sessionId, record);
  return record;
}

export function validateSessionPolicy(
  sessionId: string,
  action: string,
  spendHbar: number = 0,
  flowRateMonthly: number = 0
): PolicyValidationResult {
  const session = sessionRegistry.get(sessionId) || defaultSession;

  if (session.status !== "ACTIVE" || Date.now() > session.expiresAt) {
    return {
      allowed: false,
      reason: "Session key has expired or was revoked. Re-authorization required.",
      remainingHbar: 0,
      session,
    };
  }

  // 1. Check Action Whitelist
  if (!session.constraints.allowedActions.includes(action)) {
    return {
      allowed: false,
      reason: `Cryptographic Policy Violation: Action '${action}' is not in the delegated whitelist.`,
      remainingHbar: Math.max(0, session.constraints.maxSpendHbar - session.spentHbar),
      session,
    };
  }

  // 2. Check Spend Budget Constraint
  const remaining = session.constraints.maxSpendHbar - session.spentHbar;
  if (spendHbar > 0 && spendHbar > remaining) {
    return {
      allowed: false,
      reason: `Budget Cap Exceeded: Requested ${spendHbar} HBAR exceeds remaining session allowance (${remaining.toFixed(2)} HBAR).`,
      remainingHbar: remaining,
      session,
    };
  }

  // 3. Check Flow Rate Ceiling Constraint
  if (
    flowRateMonthly > 0 &&
    flowRateMonthly > session.constraints.maxFlowRateMonthlyUsd
  ) {
    return {
      allowed: false,
      reason: `Yield Ceiling Violation: Requested monthly stream of $${flowRateMonthly} exceeds permitted maximum of $${session.constraints.maxFlowRateMonthlyUsd}.`,
      remainingHbar: remaining,
      session,
    };
  }

  return {
    allowed: true,
    remainingHbar: remaining - spendHbar,
    session,
  };
}

export function commitSessionSpend(
  sessionId: string,
  spendHbar: number = 0,
  newStreamOpened: boolean = false
): AgentSessionRecord {
  const session = sessionRegistry.get(sessionId) || defaultSession;
  session.spentHbar = Number((session.spentHbar + spendHbar).toFixed(4));
  if (newStreamOpened) {
    session.activeStreamsCount += 1;
  }
  return session;
}
