import { NextRequest, NextResponse } from "next/server";
import {
  getActiveSession,
  createSessionGrant,
  SessionPolicyConstraints,
} from "@/lib/hermes/sessionPolicy";

export async function GET(req: NextRequest) {
  const grantor = req.nextUrl.searchParams.get("grantor") || undefined;
  const session = getActiveSession(grantor);
  return NextResponse.json({ success: true, session });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { grantor, signature, constraints } = body as {
      grantor: string;
      signature: string;
      constraints?: Partial<SessionPolicyConstraints>;
    };

    if (!grantor || !signature) {
      return NextResponse.json(
        { error: "Missing required grantor address or wallet signature." },
        { status: 400 }
      );
    }

    const session = createSessionGrant(grantor, signature, constraints);
    return NextResponse.json({
      success: true,
      message: "Cryptographic session key granted successfully to Hermes Agent.",
      session,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create agent session" },
      { status: 500 }
    );
  }
}
