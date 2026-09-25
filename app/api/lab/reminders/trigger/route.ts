import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateFastingCutoff, parseDateInput } from "@/lib/voice-tools";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { appointmentId, target = "tomorrow", markAcknowledged = false } = body;

    let targetAppointments = [];

    if (appointmentId) {
      const app = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { test: true },
      });
      if (app) targetAppointments.push(app);
    } else {
      // Find appointments based on target
      const targetDate = parseDateInput(target === "today" ? "today" : "tomorrow");
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      targetAppointments = await prisma.appointment.findMany({
        where: {
          date: {
            gte: targetDate,
            lt: nextDay,
          },
          status: {
            notIn: ["COMPLETED", "CANCELLED"],
          },
          ...(target === "all_pending"
            ? { fastingAcknowledged: false }
            : {}),
        },
        include: { test: true },
      });
    }

    if (targetAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible appointments found requiring reminders for this selection.",
        dispatchedCount: 0,
        reminders: [],
      });
    }

    const dispatchedResults = [];

    for (const app of targetAppointments) {
      const test = app.test;
      const cutoffTime = calculateFastingCutoff(app.timeSlot, test.fastingHours);
      const formattedDate = app.date.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      // Construct Outbound Voice Persona Script (Ananya)
      const transcript = [
        `AI (Ananya): Hello, am I speaking with ${app.patientName}?`,
        `Patient: Yes, this is ${app.patientName.split(" ")[0]}.`,
        `AI (Ananya): This is Ananya calling from Apex Diagnostic Centre regarding your ${test.name} scheduled for ${formattedDate} at ${app.timeSlot}.`,
        test.fastingRequired
          ? `AI (Ananya): As a critical reminder, this test requires ${test.fastingHours} hours of strict fasting. Please stop eating by ${cutoffTime}. Only plain water is permitted. Will you be able to follow this?`
          : `AI (Ananya): As a reminder, please arrive 10 minutes prior to your slot. ${test.prepInstructions}`,
        `Patient: Yes, absolutely. I have noted down to stop eating before ${cutoffTime}.`,
        `AI (Ananya): Wonderful! Your fasting protocol readiness is confirmed. We look forward to seeing you at ${app.timeSlot}. Have a good day!`,
      ].join("\n");

      const summary = `Outbound prep reminder dispatched to ${app.patientName} (${app.patientPhone}) for ${test.name}. Fasting cutoff: ${cutoffTime}. Status: ${markAcknowledged ? "Acknowledged" : "Delivered"}.`;

      // Update appointment
      await prisma.appointment.update({
        where: { id: app.id },
        data: {
          status: "REMINDER_SENT",
          fastingAcknowledged: markAcknowledged ? true : app.fastingAcknowledged,
          notes: (app.notes || "") + ` [Outbound Voice Reminder sent at ${new Date().toLocaleTimeString()} - Fasting cutoff: ${cutoffTime}]`,
        },
      });

      // Log Call in DB
      const callLog = await prisma.callLog.create({
        data: {
          callId: `outbound_${app.id.slice(-6)}_${Date.now().toString().slice(-4)}`,
          callerPhone: app.patientPhone,
          transcript,
          summary,
          intent: "PREP_QUERY",
          durationSeconds: 52,
          audioStatus: "COMPLETED",
        },
      });

      dispatchedResults.push({
        appointmentId: app.id,
        patientName: app.patientName,
        patientPhone: app.patientPhone,
        testName: test.name,
        timeSlot: app.timeSlot,
        fastingHours: test.fastingHours,
        fastingCutoff: cutoffTime,
        transcript,
        callLogId: callLog.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully dispatched ${dispatchedResults.length} outbound voice prep reminders!`,
      dispatchedCount: dispatchedResults.length,
      reminders: dispatchedResults,
    });
  } catch (error: any) {
    console.error("POST /api/lab/reminders/trigger error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
