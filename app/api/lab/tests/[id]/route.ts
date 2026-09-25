import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.category !== undefined) data.category = body.category;
    if (body.price !== undefined) data.price = parseFloat(body.price);
    if (body.fastingRequired !== undefined) data.fastingRequired = Boolean(body.fastingRequired);
    if (body.fastingHours !== undefined) {
      data.fastingHours = data.fastingRequired === false ? 0 : parseInt(body.fastingHours || 0, 10);
    }
    if (body.prepInstructions !== undefined) data.prepInstructions = body.prepInstructions;
    if (body.sampleType !== undefined) data.sampleType = body.sampleType;

    const updated = await prisma.labTest.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, test: updated });
  } catch (error: any) {
    console.error("PATCH /api/lab/tests/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.labTest.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, message: "Test deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/lab/tests/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
