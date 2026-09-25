import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFilter = searchParams.get("date"); // "all", "today", "tomorrow", "YYYY-MM-DD"
    const statusFilter = searchParams.get("status");
    const fastingFilter = searchParams.get("fasting"); // "pending", "acknowledged"
    const query = searchParams.get("query") || "";

    const where: any = {};

    // Date filtering
    if (dateFilter && dateFilter !== "all") {
      const parsedDate = parseDateInput(dateFilter);
      const nextDay = new Date(parsedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      where.date = {
        gte: parsedDate,
        lt: nextDay,
      };
    }

    // Status filtering
    if (statusFilter && statusFilter !== "ALL") {
      where.status = statusFilter;
    }

    // Fasting acknowledgment filtering
    if (fastingFilter === "pending") {
      where.fastingAcknowledged = false;
      where.test = {
        fastingRequired: true,
      };
    } else if (fastingFilter === "acknowledged") {
      where.fastingAcknowledged = true;
    }

    // Search query
    if (query) {
      where.OR = [
        { patientName: { contains: query } },
        { patientPhone: { contains: query } },
        { test: { name: { contains: query } } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [
        { date: "asc" },
        { timeSlot: "asc" },
      ],
      include: {
        test: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error: any) {
    console.error("GET /api/lab/appointments error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientName, patientPhone, testId, date, timeSlot, notes, fastingAcknowledged } = body;

    if (!patientName || !testId || !date || !timeSlot) {
      return NextResponse.json(
        { success: false, error: "Patient name, test, date, and time slot are required." },
        { status: 400 }
      );
    }

    const bookingDate = parseDateInput(date);
    const nextDay = new Date(bookingDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Collision check
    const existing = await prisma.appointment.findFirst({
      where: {
        date: {
          gte: bookingDate,
          lt: nextDay,
        },
        timeSlot: timeSlot.trim(),
        status: { not: "CANCELLED" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Time slot ${timeSlot} on this date is already booked.` },
        { status: 409 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientName: patientName.trim(),
        patientPhone: patientPhone ? patientPhone.trim() : "+91 98000 00000",
        testId,
        date: bookingDate,
        timeSlot: timeSlot.trim(),
        status: "CONFIRMED",
        fastingAcknowledged: Boolean(fastingAcknowledged),
        notes: notes || "Direct front-desk entry",
      },
      include: {
        test: true,
      },
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/lab/appointments error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
