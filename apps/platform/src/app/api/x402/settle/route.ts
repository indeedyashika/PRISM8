import { NextRequest, NextResponse } from "next/server";
import { settleX402Payment } from "@/lib/x402/oracleService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoiceId || `inv_${Date.now()}`;
    const payee = body.payee || undefined;

    const result = await settleX402Payment(invoiceId, payee);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Settlement error";
    return NextResponse.json({ error: msg, mode: "simulated" }, { status: 500 });
  }
}
