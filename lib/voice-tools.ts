import { prisma } from "./prisma";
import { calculateFastingCutoff } from "./utils";
export { calculateFastingCutoff };

export interface ToolResult {
  success: boolean;
  tool: string;
  data: any;
  speechText: string;
  error?: string;
}

const DEFAULT_SLOTS = [
  "07:30 AM",
  "08:00 AM",
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
];

export function normalizeTimeSlot(raw?: string): string {
  if (!raw) return "08:30 AM";
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!match) return trimmed;
  let hour = parseInt(match[1], 10);
  const min = match[2] || "00";
  let ampm = match[3];
  if (!ampm) {
    ampm = hour >= 7 && hour < 12 ? "AM" : "PM";
  }
  const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
  return `${hourStr}:${min} ${ampm}`;
}

// Helper to parse date strings like "tomorrow", "today", "2026-09-26"
export function parseDateInput(dateInput?: string): Date {
  const now = new Date();
  if (!dateInput) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  const lowered = dateInput.trim().toLowerCase();
  if (lowered === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
  if (lowered === "tomorrow") {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return new Date(tom.getFullYear(), tom.getMonth(), tom.getDate(), 0, 0, 0);
  }

  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0);
  }

  // fallback to tomorrow
  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  return new Date(tom.getFullYear(), tom.getMonth(), tom.getDate(), 0, 0, 0);
}

export async function checkTestPrep(testName: string): Promise<ToolResult> {
  const trimmed = testName?.trim() || "";
  if (!trimmed) {
    return {
      success: false,
      tool: "check_test_prep",
      data: null,
      speechText: "Could you please specify which diagnostic test you would like information on?",
      error: "Test name is required.",
    };
  }

  // Search in database: case-insensitive match or contains
  const allTests = await prisma.labTest.findMany();
  const lowerSearch = trimmed.toLowerCase();

  // Find exact or partial match
  let matchedTest = allTests.find(
    (t) =>
      t.name.toLowerCase() === lowerSearch ||
      t.name.toLowerCase().includes(lowerSearch) ||
      lowerSearch.includes(t.name.toLowerCase())
  );

  // Common acronym expansions in diagnostic labs
  if (!matchedTest) {
    if (lowerSearch.includes("fbs") || lowerSearch.includes("fasting sugar") || lowerSearch.includes("glucose")) {
      matchedTest = allTests.find((t) => t.name.includes("Fasting Blood Sugar"));
    } else if (lowerSearch.includes("lipid") || lowerSearch.includes("cholesterol")) {
      matchedTest = allTests.find((t) => t.name.includes("Lipid Profile"));
    } else if (lowerSearch.includes("thyroid") || lowerSearch.includes("tsh")) {
      matchedTest = allTests.find((t) => t.name.includes("Thyroid Profile"));
    } else if (lowerSearch.includes("ultrasound") || lowerSearch.includes("usg") || lowerSearch.includes("sonography")) {
      matchedTest = allTests.find((t) => t.name.includes("Ultrasound"));
    } else if (lowerSearch.includes("cbc") || lowerSearch.includes("hemoglobin")) {
      matchedTest = allTests.find((t) => t.name.includes("Complete Blood Count"));
    } else if (lowerSearch.includes("lft") || lowerSearch.includes("liver")) {
      matchedTest = allTests.find((t) => t.name.includes("Liver Function"));
    } else if (lowerSearch.includes("kft") || lowerSearch.includes("kidney") || lowerSearch.includes("rft")) {
      matchedTest = allTests.find((t) => t.name.includes("Kidney Function"));
    }
  }

  if (!matchedTest) {
    const availableNames = allTests.slice(0, 4).map((t) => t.name).join(", ");
    return {
      success: false,
      tool: "check_test_prep",
      data: { query: testName, availableTests: allTests.map((t) => t.name) },
      speechText: `I couldn't locate a test specifically named "${testName}". We offer tests like ${availableNames}. Could you verify the name?`,
      error: `Test '${testName}' not found.`,
    };
  }

  let speech = "";
  if (matchedTest.fastingRequired) {
    speech = `A ${matchedTest.name} is ₹${matchedTest.price} and requires ${matchedTest.fastingHours} hours of overnight fasting. ${matchedTest.prepInstructions}`;
  } else {
    speech = `A ${matchedTest.name} is ₹${matchedTest.price}. No fasting is required. ${matchedTest.prepInstructions}`;
  }

  return {
    success: true,
    tool: "check_test_prep",
    data: {
      id: matchedTest.id,
      name: matchedTest.name,
      category: matchedTest.category,
      price: matchedTest.price,
      fastingRequired: matchedTest.fastingRequired,
      fastingHours: matchedTest.fastingHours,
      prepInstructions: matchedTest.prepInstructions,
      sampleType: matchedTest.sampleType,
    },
    speechText: speech,
  };
}

export async function getAvailableSlots(dateInput?: string): Promise<ToolResult> {
  const dateObj = parseDateInput(dateInput);
  const nextDay = new Date(dateObj);
  nextDay.setDate(nextDay.getDate() + 1);

  // Find booked appointments on this day
  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: dateObj,
        lt: nextDay,
      },
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      timeSlot: true,
      patientName: true,
    },
  });

  const bookedSlots = bookedAppointments.map((a) => a.timeSlot);
  const availableSlots = DEFAULT_SLOTS.filter((s) => !bookedSlots.includes(s));

  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const slot1 = availableSlots[0] || "08:00 AM";
  const slot2 = availableSlots[1] || "09:00 AM";

  const speechText = `We have ${slot1} or ${slot2} available on ${formattedDate}. Which suits you better?`;

  return {
    success: true,
    tool: "get_available_slots",
    data: {
      date: dateObj.toISOString().split("T")[0],
      displayDate: formattedDate,
      availableSlots,
      bookedSlots,
      recommended: [slot1, slot2],
    },
    speechText,
  };
}

export async function bookLabAppointment(params: {
  patient_name: string;
  patient_phone: string;
  test_name: string;
  date: string;
  time_slot: string;
}): Promise<ToolResult> {
  const { patient_name, patient_phone, test_name, date, time_slot } = params;

  if (!patient_name || !test_name) {
    return {
      success: false,
      tool: "book_lab_appointment",
      data: null,
      speechText: "I will need your full name and the test name to proceed with booking.",
      error: "Missing required booking details.",
    };
  }

  // 1. Identify test
  const testLookup = await checkTestPrep(test_name);
  if (!testLookup.success || !testLookup.data) {
    return {
      success: false,
      tool: "book_lab_appointment",
      data: null,
      speechText: `We could not verify the test named ${test_name}. Please confirm the test so I can schedule it.`,
      error: `Unknown test ${test_name}`,
    };
  }

  const labTest = testLookup.data;
  const bookingDate = parseDateInput(date);
  const nextDay = new Date(bookingDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const normalizedSlot = normalizeTimeSlot(time_slot);

  // 2. Check collision
  const existing = await prisma.appointment.findFirst({
    where: {
      date: {
        gte: bookingDate,
        lt: nextDay,
      },
      timeSlot: normalizedSlot,
      status: {
        not: "CANCELLED",
      },
    },
  });

  if (existing) {
    const slotsRes = await getAvailableSlots(date);
    const altSlots = slotsRes.data.availableSlots.slice(0, 2).join(" or ");
    return {
      success: false,
      tool: "book_lab_appointment",
      data: { conflictSlot: normalizedSlot, alternatives: slotsRes.data.availableSlots },
      speechText: `The ${normalizedSlot} slot is already booked for ${date}. We have ${altSlots} available. Would either of those work?`,
      error: `Slot collision for ${normalizedSlot}`,
    };
  }

  const formattedPhone = patient_phone ? patient_phone.trim() : "+91 98000 00000";

  // 3. Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      patientName: patient_name.trim(),
      patientPhone: formattedPhone,
      testId: labTest.id,
      date: bookingDate,
      timeSlot: normalizedSlot,
      status: "CONFIRMED",
      fastingAcknowledged: false,
      notes: `Booked via Voice Agent. Test: ${labTest.name}. Fasting required: ${labTest.fastingRequired ? labTest.fastingHours + " hrs" : "None"}.`,
    },
    include: {
      test: true,
    },
  });

  // Calculate fasting cutoff
  const formattedDate = bookingDate.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  let speech = "";
  if (labTest.fastingRequired && labTest.fastingHours > 0) {
    const cutoffTime = calculateFastingCutoff(normalizedSlot, labTest.fastingHours);
    speech = `Your appointment for ${labTest.name} is confirmed for ${appointment.patientName} on ${formattedDate} at ${normalizedSlot}. Please ensure you do not eat anything after ${cutoffTime}. Only plain water is allowed. Confirmation details sent to ${appointment.patientPhone}!`;
  } else {
    speech = `Your appointment for ${labTest.name} is confirmed for ${appointment.patientName} on ${formattedDate} at ${normalizedSlot}. No fasting is required. Confirmation details sent to ${appointment.patientPhone}!`;
  }

  // Record CallLog for this booking
  try {
    await prisma.callLog.create({
      data: {
        callId: `booking_${appointment.id.slice(-6)}_${Date.now().toString().slice(-4)}`,
        callerPhone: appointment.patientPhone,
        transcript: `Patient: ${patient_name} requested booking for ${labTest.name} at ${normalizedSlot}.\nAI (Ananya): ${speech}`,
        summary: `Booked ${labTest.name} for ${patient_name} on ${formattedDate} at ${normalizedSlot}. Fasting rule: ${labTest.fastingHours}h.`,
        intent: "BOOKING",
        durationSeconds: 55,
      },
    });
  } catch (err) {
    console.error("Error creating CallLog:", err);
  }

  return {
    success: true,
    tool: "book_lab_appointment",
    data: {
      appointmentId: appointment.id,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      testName: labTest.name,
      price: labTest.price,
      date: appointment.date.toISOString().split("T")[0],
      displayDate: formattedDate,
      timeSlot: appointment.timeSlot,
      fastingRequired: labTest.fastingRequired,
      fastingHours: labTest.fastingHours,
      fastingCutoff: calculateFastingCutoff(normalizedSlot, labTest.fastingHours),
    },
    speechText: speech,
  };
}

export async function confirmFastingReadiness(identifier: {
  appointment_id?: string;
  patient_phone?: string;
  patient_name?: string;
}): Promise<ToolResult> {
  let appointment = null;

  if (identifier.appointment_id) {
    appointment = await prisma.appointment.findUnique({
      where: { id: identifier.appointment_id },
      include: { test: true },
    });
  }

  if (!appointment && identifier.patient_phone) {
    appointment = await prisma.appointment.findFirst({
      where: {
        patientPhone: {
          contains: identifier.patient_phone.slice(-8),
        },
        status: { not: "CANCELLED" },
      },
      orderBy: { date: "desc" },
      include: { test: true },
    });
  }

  if (!appointment && identifier.patient_name) {
    appointment = await prisma.appointment.findFirst({
      where: {
        patientName: {
          contains: identifier.patient_name.trim(),
        },
        status: { not: "CANCELLED" },
      },
      orderBy: { date: "desc" },
      include: { test: true },
    });
  }

  if (!appointment) {
    return {
      success: false,
      tool: "confirm_fasting_readiness",
      data: null,
      speechText: "I could not find an active appointment matching those details to confirm fasting.",
      error: "Appointment not found for fasting acknowledgment.",
    };
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      fastingAcknowledged: true,
      notes: (appointment.notes || "") + ` [Fasting verified via Voice Protocol at ${new Date().toLocaleTimeString()}]`,
    },
    include: { test: true },
  });

  return {
    success: true,
    tool: "confirm_fasting_readiness",
    data: {
      appointmentId: updated.id,
      patientName: updated.patientName,
      testName: updated.test.name,
      fastingAcknowledged: true,
    },
    speechText: `Fasting readiness confirmed for ${updated.patientName}. We have recorded your confirmation. Thank you!`,
  };
}
