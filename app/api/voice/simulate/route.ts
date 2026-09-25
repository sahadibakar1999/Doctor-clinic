import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkTestPrep,
  getAvailableSlots,
  bookLabAppointment,
  confirmFastingReadiness,
  parseDateInput,
} from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage = (body.message || "").trim();
    const conversationHistory = body.history || [];

    if (!userMessage) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const lower = userMessage.toLowerCase();

    // 1. Identify intent & tools
    let toolCalled: string | null = null;
    let toolArgs: any = null;
    let toolResult: any = null;
    let aiResponse = "";
    let detectedIntent = "OTHER";

    // A. Check for Fasting Readiness Confirmation
    if (
      lower.includes("confirm fasting") ||
      lower.includes("yes i am fasting") ||
      lower.includes("started fasting") ||
      lower.includes("i have fasted") ||
      lower.includes("stopped eating") ||
      (lower.includes("fasting") && (lower.includes("yes") || lower.includes("confirm")))
    ) {
      detectedIntent = "PREP_QUERY";
      toolCalled = "confirm_fasting_readiness";

      // Extract possible name or phone
      const phoneMatch = userMessage.match(/\b\d{10}\b/);
      let nameMatch = null;
      if (lower.includes("for ")) {
        nameMatch = userMessage.split(/for /i)[1]?.split(/[.,\n]/)[0]?.trim();
      }

      toolArgs = {
        patient_phone: phoneMatch ? phoneMatch[0] : undefined,
        patient_name: nameMatch || undefined,
      };

      toolResult = await confirmFastingReadiness(toolArgs);
      aiResponse = toolResult.speechText;
    }

    // B. Check for Booking Request
    else if (
      lower.includes("book") ||
      lower.includes("schedule") ||
      lower.includes("appointment") ||
      lower.includes("reserve") ||
      (lower.includes("want") && (lower.includes("test") || lower.includes("slot")))
    ) {
      detectedIntent = "BOOKING";

      // Extract test name
      let testName = "";
      const tests = await prisma.labTest.findMany({ select: { name: true } });
      for (const t of tests) {
        const tLower = t.name.toLowerCase();
        const shortName = tLower.split("(")[0].trim();
        if (lower.includes(tLower) || lower.includes(shortName)) {
          testName = t.name;
          break;
        }
      }

      if (!testName) {
        if (lower.includes("fbs") || lower.includes("fasting sugar") || lower.includes("sugar")) {
          testName = "Fasting Blood Sugar (FBS)";
        } else if (lower.includes("lipid") || lower.includes("cholesterol")) {
          testName = "Lipid Profile";
        } else if (lower.includes("thyroid") || lower.includes("tsh")) {
          testName = "Thyroid Profile (T3, T4, TSH)";
        } else if (lower.includes("ultrasound") || lower.includes("abdomen") || lower.includes("scan")) {
          testName = "Ultrasound Whole Abdomen";
        } else if (lower.includes("blood count") || lower.includes("cbc")) {
          testName = "Complete Blood Count (CBC)";
        } else if (lower.includes("liver") || lower.includes("lft")) {
          testName = "Liver Function Test (LFT)";
        } else if (lower.includes("kidney") || lower.includes("kft")) {
          testName = "Kidney Function Test (KFT/RFT)";
        } else if (lower.includes("vitamin")) {
          testName = "Vitamin D3 (25-Hydroxy)";
        }
      }

      // Extract Patient Name
      let patientName = "Patient";
      const nameMatch = userMessage.match(/(?:my name is|i am|name is|patient:?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch && nameMatch[1]) {
        patientName = nameMatch[1].trim();
      }

      // Extract Date
      let dateStr = "tomorrow";
      if (lower.includes("today")) dateStr = "today";
      else if (lower.includes("tomorrow")) dateStr = "tomorrow";

      // Extract Slot
      let slot = "";
      const slotMatch = userMessage.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
      if (slotMatch) {
        let rawSlot = slotMatch[1].toUpperCase();
        if (!rawSlot.includes(":")) {
          rawSlot = rawSlot.replace(/(\d+)\s*(AM|PM)/, "$1:00 $2");
        }
        if (rawSlot.length === 7) rawSlot = "0" + rawSlot;
        slot = rawSlot;
      }

      // If user specified both test and slot (or we have slot)
      if (testName && slot) {
        toolCalled = "book_lab_appointment";
        toolArgs = {
          patient_name: patientName,
          patient_phone: "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
          test_name: testName,
          date: dateStr,
          time_slot: slot,
        };
        toolResult = await bookLabAppointment(toolArgs);
        aiResponse = toolResult.speechText;
      } else if (testName && !slot) {
        // Query slots first!
        toolCalled = "get_available_slots";
        toolArgs = { date: dateStr };
        toolResult = await getAvailableSlots(dateStr);
        aiResponse = `Certainly! For ${testName} on ${dateStr}, we have ${toolResult.data.recommended[0]} or ${toolResult.data.recommended[1]} available. Which suits you better?`;
      } else {
        // Did not mention test
        aiResponse = "I can certainly help you book an appointment. Which diagnostic test would you like to schedule?";
      }
    }

    // C. Check for Slot Inquiry
    else if (lower.includes("slot") || lower.includes("time") || lower.includes("available") || lower.includes("when can i")) {
      detectedIntent = "BOOKING";
      toolCalled = "get_available_slots";
      const dateStr = lower.includes("today") ? "today" : "tomorrow";
      toolArgs = { date: dateStr };
      toolResult = await getAvailableSlots(dateStr);
      aiResponse = toolResult.speechText;
    }

    // D. Check for Prep / Fasting / Price Inquiry
    else if (
      lower.includes("prep") ||
      lower.includes("fasting") ||
      lower.includes("eat") ||
      lower.includes("drink") ||
      lower.includes("water") ||
      lower.includes("tea") ||
      lower.includes("coffee") ||
      lower.includes("price") ||
      lower.includes("cost") ||
      lower.includes("charges") ||
      lower.includes("rate") ||
      lower.includes("how much") ||
      lower.includes("rules") ||
      lower.includes("instructions") ||
      lower.includes("test")
    ) {
      detectedIntent = "PREP_QUERY";
      toolCalled = "check_test_prep";

      // Extract test name
      let searchCandidate = "";
      const tests = await prisma.labTest.findMany({ select: { name: true } });
      for (const t of tests) {
        const tLower = t.name.toLowerCase();
        const shortName = tLower.split("(")[0].trim();
        if (lower.includes(tLower) || lower.includes(shortName)) {
          searchCandidate = t.name;
          break;
        }
      }

      if (!searchCandidate) {
        if (lower.includes("sugar") || lower.includes("fbs") || lower.includes("glucose")) searchCandidate = "Fasting Blood Sugar";
        else if (lower.includes("lipid") || lower.includes("cholesterol")) searchCandidate = "Lipid Profile";
        else if (lower.includes("thyroid") || lower.includes("tsh")) searchCandidate = "Thyroid Profile";
        else if (lower.includes("ultrasound") || lower.includes("abdomen") || lower.includes("sonography")) searchCandidate = "Ultrasound Whole Abdomen";
        else if (lower.includes("cbc") || lower.includes("hemoglobin")) searchCandidate = "Complete Blood Count";
        else if (lower.includes("liver") || lower.includes("lft")) searchCandidate = "Liver Function Test";
        else if (lower.includes("kidney") || lower.includes("kft")) searchCandidate = "Kidney Function Test";
        else if (lower.includes("vitamin")) searchCandidate = "Vitamin D3";
        else searchCandidate = userMessage;
      }

      toolArgs = { test_name: searchCandidate };
      toolResult = await checkTestPrep(searchCandidate);

      if (toolResult.success) {
        // Tailor specific questions like "can I drink tea?"
        if (lower.includes("tea") || lower.includes("coffee") || lower.includes("milk")) {
          if (toolResult.data.fastingRequired) {
            aiResponse = `No, tea, coffee, and milk are strictly prohibited. ${toolResult.data.name} requires ${toolResult.data.fastingHours} hours of fasting with plain water only.`;
          } else {
            aiResponse = `Yes, tea or coffee is acceptable as no fasting is required for ${toolResult.data.name}.`;
          }
        } else {
          aiResponse = toolResult.speechText;
        }
      } else {
        aiResponse = toolResult.speechText;
      }
    }

    // Default Fallback
    else {
      aiResponse = "Hello! This is Ananya from Apex Diagnostic Centre. How may I assist you with your lab tests or bookings today?";
    }

    return NextResponse.json({
      success: true,
      userMessage,
      aiResponse,
      detectedIntent,
      toolCalled,
      toolArgs,
      toolResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("POST /api/voice/simulate error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
