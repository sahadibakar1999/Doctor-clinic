import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.fastingAcknowledged !== undefined) data.fastingAcknowledged = Boolean(body.fastingAcknowledged);
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.timeSlot !== undefined) data.timeSlot = body.timeSlot;
    if (body.date !== undefined) data.date = parseDateInput(body.date);
    if (body.patientPhone !== undefined) data.patientPhone = body.patientPhone;
    if (body.patientName !== undefined) data.patientName = body.patientName;

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: {
        test: true,
      },
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    console.error("PATCH /api/lab/appointments/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.appointment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Appointment deleted" });
  } catch (error: any) {
    console.error("DELETE /api/lab/appointments/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
