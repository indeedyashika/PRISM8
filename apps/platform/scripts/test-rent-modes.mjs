/**
 * Automated Verification Test Suite for Prism 8 Rent Flow Modes
 * 
 * Verifies:
 * 1. Rent Simulation Semantics (/api/rent/simulate)
 *    - fundsMoved: false
 *    - mode: "simulated"
 *    - message: "Simulating $3,800 rent inflow"
 *    - Zero fabricated transaction hashes
 *    - Zero explorer URLs
 * 2. Superfluid Stream Gating
 *    - Resulting stream from simulation is strictly mode: "simulated"
 *    - txHash is null
 *    - basescanUrl / explorerUrl is undefined
 * 3. Live Rent Deposit Error Handling (/api/rent/deposit)
 *    - Refuses to fake a transaction when live keys are unconfigured
 *    - Returns HTTP 400 with explicit error code
 *    - Never produces a fake hash or explorer link
 * 4. Hermes Orchestrator Language Enforcement
 *    - Strictly says "Simulating $3,800 rent inflow" during simulation
 *    - Never says "depositing rent" or "executing YieldVault deposit"
 */

import assert from "node:assert";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

async function runTests() {
  console.log("===============================================================");
  console.log("  PRISM 8 RENT FLOW AUDIT: LIVE DEPOSIT VS. SIMULATION TESTS   ");
  console.log("===============================================================\n");

  // -------------------------------------------------------------------------
  // Test 1: Simulation Mode Semantics
  // -------------------------------------------------------------------------
  console.log("[Test 1] Testing /api/rent/simulate strict simulation semantics...");
  const simRes = await fetch(`${BASE_URL}/api/rent/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId: "prop_audit_verify_456",
      amount: 3800,
      tenantName: "Audit Test Tenant",
    }),
  });

  assert.strictEqual(simRes.status, 200, "Simulation endpoint must return HTTP 200");
  const simData = await simRes.json();

  assert.strictEqual(simData.success, true, "Simulation should be successful");
  assert.strictEqual(simData.mode, "simulated", "Mode must be strictly 'simulated'");
  assert.strictEqual(simData.isSimulation, true, "isSimulation must be true");
  assert.strictEqual(simData.fundsMoved, false, "fundsMoved must be false");
  assert.strictEqual(simData.message, "Simulating $3,800 rent inflow", "Message must be 'Simulating $3,800 rent inflow'");
  assert.strictEqual(simData.simulatedRentAmount, 3800, "simulatedRentAmount must equal 3800");
  assert.strictEqual(simData.amountDeposited, undefined, "amountDeposited must NOT exist (no funds moved)");
  assert.strictEqual(simData.txHash, undefined, "Simulation must NEVER return a txHash");
  assert.strictEqual(simData.basescanUrl, undefined, "Simulation must NEVER return an explorer link");

  console.log("  ✓ fundsMoved === false confirmed.");
  console.log("  ✓ mode === 'simulated' confirmed.");
  console.log("  ✓ message === 'Simulating $3,800 rent inflow' confirmed.");
  console.log("  ✓ No fake transaction hashes or explorer links produced.");
  console.log("✓ Test 1 Passed: Simulation semantics strictly verified.\n");

  // -------------------------------------------------------------------------
  // Test 2: Stream Gating - Stream resulting from simulation is strictly simulated
  // -------------------------------------------------------------------------
  console.log("[Test 2] Testing Superfluid stream gating in SQLite...");
  const streamsRes = await fetch(
    `${BASE_URL}/api/yield/streams?propertyId=prop_audit_verify_456`
  );
  assert.strictEqual(streamsRes.status, 200, "Streams query must succeed");
  const streamsData = await streamsRes.json();
  const testStream = streamsData.streams.find((s) => s.propertyId === "prop_audit_verify_456");

  assert(testStream, "Stream for property must be created or updated");
  assert.strictEqual(testStream.mode, "simulated", "Stream mode must remain 'simulated'");
  assert.strictEqual(testStream.txHash, null, "Stream txHash must be null");
  assert.strictEqual(testStream.basescanUrl, undefined, "basescanUrl must be undefined for simulated stream");
  assert.strictEqual(testStream.explorerUrl, undefined, "explorerUrl must be undefined for simulated stream");

  console.log("  ✓ Resulting stream is strictly marked mode='simulated'.");
  console.log("  ✓ Resulting stream txHash is null.");
  console.log("  ✓ Stream cannot be presented as live on-chain.");
  console.log("✓ Test 2 Passed: Stream gating verified.\n");

  // -------------------------------------------------------------------------
  // Test 3: Live Deposit Rejection When Signer Unconfigured
  // -------------------------------------------------------------------------
  console.log("[Test 3] Testing /api/rent/deposit explicit rejection when live keys unconfigured...");
  const liveRes = await fetch(`${BASE_URL}/api/rent/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId: "prop_audit_verify_456",
      amount: 3800,
    }),
  });

  const liveData = await liveRes.json();

  if (process.env.SUPERFLUID_PRIVATE_KEY || process.env.EVM_OPERATOR_PRIVATE_KEY) {
    console.log("  (Live operator keys detected in environment)");
    if (liveRes.status === 200) {
      assert.strictEqual(liveData.mode, "live");
      assert.strictEqual(liveData.fundsMoved, true);
      assert.strictEqual(liveData.message, "Rent deposit submitted");
      assert.strictEqual(liveData.confirmation, "Transaction confirmed");
      assert(liveData.txHash.startsWith("0x"));
      assert(liveData.basescanUrl.includes(liveData.txHash));
      console.log("  ✓ Live deposit confirmed on Base Sepolia:", liveData.txHash);
    } else {
      assert.strictEqual(liveRes.status, 400);
      assert(liveData.error === "INSUFFICIENT_GAS_BALANCE" || liveData.error === "LIVE_OPERATOR_NOT_CONFIGURED");
      console.log("  ✓ Live deposit cleanly failed due to gas balance without faking:", liveData.error);
    }
  } else {
    assert.strictEqual(liveRes.status, 400, "Live deposit without operator must return 400");
    assert.strictEqual(liveData.mode, "live", "Mode must be 'live'");
    assert.strictEqual(liveData.error, "LIVE_OPERATOR_NOT_CONFIGURED", "Error code must indicate unconfigured operator");
    assert.strictEqual(liveData.txHash, undefined, "Must NEVER fake a transaction hash when unconfigured");
    assert.strictEqual(liveData.basescanUrl, undefined, "Must NEVER produce a fake explorer link");
    console.log("  ✓ HTTP 400 LIVE_OPERATOR_NOT_CONFIGURED returned.");
    console.log("  ✓ Zero mock transaction hashes produced.");
  }
  console.log("✓ Test 3 Passed: Live deposit semantics and anti-fabrication verified.\n");

  // -------------------------------------------------------------------------
  // Test 4: Hermes Autonomous Agent Language & Semantics
  // -------------------------------------------------------------------------
  console.log("[Test 4] Testing Hermes agent execution language for simulation...");
  const agentRes = await fetch(`${BASE_URL}/api/agent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction: "Superfluid: Simulating $3,800 rent inflow",
      dryRun: true,
    }),
  });

  assert.strictEqual(agentRes.status, 200, "Agent execution must succeed");
  const agentData = await agentRes.json();
  const step = agentData.steps?.[0];

  assert(step, "Step must exist in agent execution response");
  assert.strictEqual(step.mode, "simulated", "Step mode must be simulated");
  assert.strictEqual(step.shortResult, "Simulating $3,800 rent inflow", "Step shortResult must say 'Simulating $3,800 rent inflow'");

  const forbiddenPhrases = [
    "depositing rent",
    "executing YieldVault deposit",
  ];

  const fullResponseStr = JSON.stringify(agentData).toLowerCase();
  for (const phrase of forbiddenPhrases) {
    assert(
      !fullResponseStr.includes(phrase.toLowerCase()),
      `Forbidden phrase found in agent simulation response: "${phrase}"`
    );
  }

  assert(
    agentData.summary.includes("Simulating $3,800 rent inflow"),
    "Summary must state 'Simulating $3,800 rent inflow'"
  );

  console.log("  ✓ Step shortResult strictly says 'Simulating $3,800 rent inflow'.");
  console.log("  ✓ Hermes UI/Agent contains ZERO occurrences of 'depositing rent' or 'executing YieldVault deposit'.");
  console.log("  ✓ Summary accurately reflects simulation mode.");
  console.log("✓ Test 4 Passed: Hermes agent truthful language verified.\n");

  console.log("===============================================================");
  console.log("  ALL 4 PRISM 8 RENT FLOW AUDIT TESTS PASSED SUCCESSFULLY!    ");
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
