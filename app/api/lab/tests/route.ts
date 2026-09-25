import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const category = searchParams.get("category") || "";

    const where: any = {};
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { prepInstructions: { contains: query } },
        { sampleType: { contains: query } },
      ];
    }
    if (category && category !== "ALL") {
      where.category = category;
    }

    const tests = await prisma.labTest.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { appointments: true },
        },
      },
    });

    return NextResponse.json({ success: true, count: tests.length, tests });
  } catch (error: any) {
    console.error("GET /api/lab/tests error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, price, fastingRequired, fastingHours, prepInstructions, sampleType } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { success: false, error: "Test name and price are required." },
        { status: 400 }
      );
    }

    const created = await prisma.labTest.create({
      data: {
        name: name.trim(),
        category: category || "General",
        price: parseFloat(price),
        fastingRequired: Boolean(fastingRequired),
        fastingHours: fastingRequired ? parseInt(fastingHours || 0, 10) : 0,
        prepInstructions: prepInstructions || "Standard precautions.",
        sampleType: sampleType || "Blood",
      },
    });

    return NextResponse.json({ success: true, test: created }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/lab/tests error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
