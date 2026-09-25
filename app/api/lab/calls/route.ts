import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const intent = searchParams.get("intent");
    const query = searchParams.get("query") || "";

    const where: any = {};
    if (intent && intent !== "ALL") {
      where.intent = intent;
    }
    if (query) {
      where.OR = [
        { callerPhone: { contains: query } },
        { summary: { contains: query } },
        { transcript: { contains: query } },
        { callId: { contains: query } },
      ];
    }

    const calls = await prisma.callLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json({ success: true, count: calls.length, calls });
  } catch (error: any) {
    console.error("GET /api/lab/calls error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { callId, callerPhone, transcript, summary, intent, durationSeconds } = body;

    const created = await prisma.callLog.create({
      data: {
        callId: callId || `call_manual_${Date.now()}`,
        callerPhone: callerPhone || "+91 98000 00000",
        transcript: transcript || "",
        summary: summary || "Manual or simulated call record",
        intent: intent || "OTHER",
        durationSeconds: durationSeconds || 45,
        audioStatus: "COMPLETED",
      },
    });

    return NextResponse.json({ success: true, call: created }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/lab/calls error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
