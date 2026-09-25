import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrowStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // 1. Today's appointments count
    const todayAppointmentsCount = await prisma.appointment.count({
      where: {
        date: {
          gte: todayStart,
          lt: tomorrowStart,
        },
        status: { not: "CANCELLED" },
      },
    });

    // 2. Fasting pending acknowledgment (all active today & tomorrow appointments requiring fasting where fastingAcknowledged is false)
    const fastingPendingAckCount = await prisma.appointment.count({
      where: {
        date: {
          gte: todayStart,
          lt: dayAfterTomorrow,
        },
        fastingAcknowledged: false,
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
        test: {
          fastingRequired: true,
        },
      },
    });

    // 3. Calls Handled by AI Today
    const callsTodayCount = await prisma.callLog.count({
      where: {
        timestamp: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
    });

    // Total calls count
    const totalCallsCount = await prisma.callLog.count();

    // 4. No-Show Risk Metric
    // Appointments with fastingRequired = true and fastingAcknowledged = false represent high risk!
    const totalUpcomingFastingTests = await prisma.appointment.count({
      where: {
        date: {
          gte: todayStart,
          lt: dayAfterTomorrow,
        },
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
        test: {
          fastingRequired: true,
        },
      },
    });

    const noShowRiskRate = totalUpcomingFastingTests > 0
      ? Math.round((fastingPendingAckCount / totalUpcomingFastingTests) * 100)
      : 12; // baseline benchmark

    // Status counts
    const statusCounts = await prisma.appointment.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    });

    const totalTestsCount = await prisma.labTest.count();

    return NextResponse.json({
      success: true,
      stats: {
        todayAppointments: todayAppointmentsCount,
        fastingPendingAck: fastingPendingAckCount,
        callsToday: callsTodayCount > 0 ? callsTodayCount : totalCallsCount,
        totalCalls: totalCallsCount,
        noShowRiskRate: `${noShowRiskRate}%`,
        noShowRiskLevel: noShowRiskRate > 35 ? "High Risk" : noShowRiskRate > 15 ? "Moderate" : "Low Risk",
        totalTestsCount,
        statusDistribution: statusCounts.reduce((acc: any, curr) => {
          acc[curr.status] = curr._count._all;
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    console.error("GET /api/lab/stats error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
