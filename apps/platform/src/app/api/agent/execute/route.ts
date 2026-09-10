import { NextRequest, NextResponse } from "next/server";
import { executeHermesMission, HermesMissionRequest } from "@/lib/hermes/agentOrchestrator";

export async function POST(req: NextRequest) {
  try {
    const isStream =
      req.nextUrl.searchParams.get("stream") === "true" ||
      req.headers.get("accept")?.includes("text/event-stream");

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
      dryRun = false,
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
      dryRun,
      baseUrl,
    };

    if (isStream) {
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();

      const sendEvent = async (data: Record<string, unknown>) => {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      (async () => {
        try {
          await sendEvent({
            type: "HERMES_START",
            instruction,
            sessionId,
            timestamp: new Date().toISOString(),
          });

          const result = await executeHermesMission(missionRequest, {
            onToolStart: (server, tool, actionLabel, timestamp) => {
              void sendEvent({
                type: "TOOL_START",
                server,
                tool,
                actionLabel,
                timestamp,
              });
            },
            onToolComplete: (event) => {
              void sendEvent({
                type: "TOOL_COMPLETE",
                event,
              });
            },
          });

          await sendEvent({
            type: "MISSION_COMPLETE",
            result,
          });
        } catch (err: any) {
          const isGuardrail =
            err.message?.includes("Guardrail") ||
            err.message?.includes("Policy Violation") ||
            err.message?.includes("Unauthorized");

          await sendEvent({
            type: "ERROR",
            error: err.message || "Failed to execute autonomous agent mission",
            blockedByGuardrail: isGuardrail,
            status: isGuardrail ? "BLOCKED" : "FAILED",
          });
        } finally {
          try {
            await writer.close();
          } catch {}
        }
      })();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    }

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
