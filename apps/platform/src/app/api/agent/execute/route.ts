import { NextRequest, NextResponse } from "next/server";
import { executeHermesMission, HermesMissionRequest } from "@/lib/hermes/agentOrchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      instruction,
      action = "FULL_TOKENIZATION_AND_YIELD_PIPELINE",
      sessionId = "session_prism8_genesis_demo",
      property = {
        street: "456 Oak Avenue",
        city: "Miami",
        state: "FL",
        zip: "33101",
        monthlyRent: 3800,
        shares: 1000,
      },
      simulateMalicious = false,
    } = body;

    // Derive server base URL from request headers so MCP tools call the live app
    const host = req.headers.get("host") || "127.0.0.1:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = process.env.TOKENIZATION_BASE_URL || `${proto}://${host}`;

    const missionRequest: HermesMissionRequest = {
      instruction,
      action,
      sessionId,
      property,
      simulateMalicious,
      baseUrl,
    };

    const result = await executeHermesMission(missionRequest);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    const isGuardrail =
      err.message?.includes("Guardrail") ||
      err.message?.includes("Policy Violation") ||
      err.message?.includes("Unauthorized");

    return NextResponse.json(
      {
        success: false,
        blockedByGuardrail: isGuardrail,
        error: err.message || "Failed to execute autonomous agent mission",
      },
      { status: isGuardrail ? 403 : 500 }
    );
  }
}
