import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkTestPrep,
  getAvailableSlots,
  bookLabAppointment,
  confirmFastingReadiness,
  parseDateInput,
  normalizeTimeSlot,
} from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage = (body.message || "").trim();
    const conversationHistory: Array<{
      sender?: string;
      text?: string;
      toolCall?: { name: string; args: any; result: any };
    }> = body.history || [];

    if (!userMessage) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const lower = userMessage.toLowerCase();

    // 1. Extract context from conversation history
    let contextTestName = "";
    let contextDate = "tomorrow";
    let lastOfferedSlots: string[] = [];
    let lastAiText = "";
    let lastToolName = "";
    let contextPatientName = "";

    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const item = conversationHistory[i];
      if (item.sender === "ai" && !lastAiText) {
        lastAiText = item.text || "";
      }
      if (item.toolCall) {
        if (!lastToolName) lastToolName = item.toolCall.name;
        if (!contextTestName) {
          contextTestName =
            item.toolCall.args?.test_name ||
            item.toolCall.result?.name ||
            item.toolCall.result?.testName ||
            "";
        }
        if (
          item.toolCall.name === "get_available_slots" &&
          lastOfferedSlots.length === 0
        ) {
          lastOfferedSlots =
            item.toolCall.result?.recommended ||
            item.toolCall.result?.availableSlots?.slice(0, 2) ||
            [];
          if (item.toolCall.args?.date) contextDate = item.toolCall.args.date;
        }
      }
      if (!contextTestName && item.text) {
        const tLower = item.text.toLowerCase();
        if (tLower.includes("fbs") || tLower.includes("fasting sugar") || tLower.includes("sugar")) {
          contextTestName = "Fasting Blood Sugar (FBS)";
        } else if (tLower.includes("lipid") || tLower.includes("cholesterol")) {
          contextTestName = "Lipid Profile";
        } else if (tLower.includes("thyroid") || tLower.includes("tsh")) {
          contextTestName = "Thyroid Profile (T3, T4, TSH)";
        } else if (tLower.includes("ultrasound") || tLower.includes("abdomen") || tLower.includes("scan")) {
          contextTestName = "Ultrasound Whole Abdomen";
        } else if (tLower.includes("cbc") || tLower.includes("complete blood count")) {
          contextTestName = "Complete Blood Count (CBC)";
        } else if (tLower.includes("liver") || tLower.includes("lft")) {
          contextTestName = "Liver Function Test (LFT)";
        } else if (tLower.includes("kidney") || tLower.includes("kft")) {
          contextTestName = "Kidney Function Test (KFT/RFT)";
        } else if (tLower.includes("vitamin")) {
          contextTestName = "Vitamin D3 (25-Hydroxy)";
        }
      }
      if (!contextPatientName && item.text) {
        const nameMatch = item.text.match(/(?:my name is|i am|for\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (nameMatch && nameMatch[1]) {
          contextPatientName = nameMatch[1].trim();
        }
      }
    }

    // Also look for offered slots in last AI text if not in tool results
    if (lastOfferedSlots.length === 0 && lastAiText) {
      const matches = lastAiText.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi);
      if (matches && matches.length > 0) {
        lastOfferedSlots = matches;
      }
    }

    // 2. Detect patient name in current message
    let patientName = contextPatientName || "Patient";
    const currentNameMatch = userMessage.match(/(?:my name is|i am|for\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (currentNameMatch && currentNameMatch[1]) {
      patientName = currentNameMatch[1].trim();
    }

    // 3. Detect date in current message
    let dateStr = contextDate;
    if (lower.includes("today")) dateStr = "today";
    else if (lower.includes("tomorrow")) dateStr = "tomorrow";

    // 4. Detect slot choice in current message
    let detectedSlot = "";
    const timeMatch = userMessage.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
    if (
      timeMatch &&
      (timeMatch[1].toLowerCase().includes("am") ||
        timeMatch[1].toLowerCase().includes("pm") ||
        timeMatch[1].includes(":"))
    ) {
      detectedSlot = normalizeTimeSlot(timeMatch[1]);
    } else if (lower.includes("first") && lastOfferedSlots.length > 0) {
      detectedSlot = lastOfferedSlots[0];
    } else if ((lower.includes("second") || lower.includes("later")) && lastOfferedSlots.length > 1) {
      detectedSlot = lastOfferedSlots[1];
    } else if ((lower.includes("either") || lower.includes("any")) && lastOfferedSlots.length > 0) {
      detectedSlot = lastOfferedSlots[0];
    }

    let toolCalled: string | null = null;
    let toolArgs: any = null;
    let toolResult: any = null;
    let aiResponse = "";
    let detectedIntent = "OTHER";

    // Check if slot context is active (last AI asked about slots or offered slots)
    const slotContextActive =
      lastToolName === "get_available_slots" ||
      lastAiText.toLowerCase().includes("which suits you better") ||
      lastAiText.toLowerCase().includes("available on") ||
      lastOfferedSlots.length > 0;

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

      const phoneMatch = userMessage.match(/\b\d{10}\b/);
      let nameMatch = null;
      if (lower.includes("for ")) {
        nameMatch = userMessage.split(/for /i)[1]?.split(/[.,\n]/)[0]?.trim();
      }

      toolArgs = {
        patient_phone: phoneMatch ? phoneMatch[0] : undefined,
        patient_name: nameMatch || (patientName !== "Patient" ? patientName : undefined),
      };

      toolResult = await confirmFastingReadiness(toolArgs);
      aiResponse = toolResult.speechText;
    }

    // B. User selects a time slot or answers slot question (e.g. "8:30 am", "first one", etc.)
    else if (detectedSlot && (slotContextActive || userMessage.length < 20 || lower.includes("book") || lower.includes("slot"))) {
      detectedIntent = "BOOKING";
      toolCalled = "book_lab_appointment";

      // Identify which test to book
      let testToBook = contextTestName;
      if (!testToBook) {
        // Fallback: search for any test name mentioned in database
        const tests = await prisma.labTest.findMany({ select: { name: true } });
        for (const t of tests) {
          if (lower.includes(t.name.toLowerCase())) {
            testToBook = t.name;
            break;
          }
        }
      }
      if (!testToBook) {
        testToBook = "Fasting Blood Sugar (FBS)";
      }

      toolArgs = {
        patient_name: patientName,
        patient_phone: "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
        test_name: testToBook,
        date: dateStr,
        time_slot: detectedSlot,
      };

      toolResult = await bookLabAppointment(toolArgs);
      aiResponse = toolResult.speechText;
    }

    // C. Affirmation ("yes", "sure", "ok", "confirm", "go ahead")
    else if (
      lower === "yes" ||
      lower.startsWith("yes ") ||
      lower.startsWith("sure") ||
      lower.startsWith("ok") ||
      lower.startsWith("okay") ||
      lower.includes("confirm") ||
      lower.includes("sounds good") ||
      lower.includes("that works")
    ) {
      if (slotContextActive && lastOfferedSlots.length > 0) {
        // Book the first recommended slot
        detectedIntent = "BOOKING";
        toolCalled = "book_lab_appointment";
        const testToBook = contextTestName || "Fasting Blood Sugar (FBS)";
        const slotToBook = lastOfferedSlots[0];

        toolArgs = {
          patient_name: patientName,
          patient_phone: "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
          test_name: testToBook,
          date: dateStr,
          time_slot: slotToBook,
        };

        toolResult = await bookLabAppointment(toolArgs);
        aiResponse = toolResult.speechText;
      } else if (lastAiText.toLowerCase().includes("fasting") || lower.includes("fasting")) {
        detectedIntent = "PREP_QUERY";
        toolCalled = "confirm_fasting_readiness";
        toolArgs = { patient_name: patientName !== "Patient" ? patientName : undefined };
        toolResult = await confirmFastingReadiness(toolArgs);
        aiResponse = toolResult.speechText;
      } else {
        aiResponse = "Certainly! How may I assist you with your booking or diagnostic tests?";
      }
    }

    // D. Explicit Booking Request (e.g., "Book Lipid Profile for tomorrow at 8:30 AM")
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
        } else if (contextTestName) {
          testName = contextTestName;
        }
      }

      if (testName && detectedSlot) {
        toolCalled = "book_lab_appointment";
        toolArgs = {
          patient_name: patientName,
          patient_phone: "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
          test_name: testName,
          date: dateStr,
          time_slot: detectedSlot,
        };
        toolResult = await bookLabAppointment(toolArgs);
        aiResponse = toolResult.speechText;
      } else if (testName && !detectedSlot) {
        toolCalled = "get_available_slots";
        toolArgs = { date: dateStr };
        toolResult = await getAvailableSlots(dateStr);
        aiResponse = `Certainly! For ${testName} on ${dateStr}, we have ${toolResult.data.recommended[0]} or ${toolResult.data.recommended[1]} available. Which suits you better?`;
      } else {
        aiResponse = "I can certainly help you book an appointment. Which diagnostic test would you like to schedule?";
      }
    }

    // E. Slot / Time Inquiry
    else if (
      lower.includes("slot") ||
      lower.includes("time") ||
      lower.includes("available") ||
      lower.includes("when can i") ||
      lower.includes("timing") ||
      lower.includes("morning") ||
      lower.includes("afternoon")
    ) {
      detectedIntent = "BOOKING";
      toolCalled = "get_available_slots";
      toolArgs = { date: dateStr };
      toolResult = await getAvailableSlots(dateStr);
      aiResponse = toolResult.speechText;
    }

    // F. Test Prep / Fasting / Price Inquiry
    else if (
      lower.includes("prep") ||
      lower.includes("fasting") ||
      lower.includes("eat") ||
      lower.includes("drink") ||
      lower.includes("water") ||
      lower.includes("tea") ||
      lower.includes("coffee") ||
      lower.includes("milk") ||
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
        if (lower.includes("sugar") || lower.includes("fbs") || lower.includes("glucose")) searchCandidate = "Fasting Blood Sugar (FBS)";
        else if (lower.includes("lipid") || lower.includes("cholesterol")) searchCandidate = "Lipid Profile";
        else if (lower.includes("thyroid") || lower.includes("tsh")) searchCandidate = "Thyroid Profile (T3, T4, TSH)";
        else if (lower.includes("ultrasound") || lower.includes("abdomen") || lower.includes("sonography")) searchCandidate = "Ultrasound Whole Abdomen";
        else if (lower.includes("cbc") || lower.includes("hemoglobin")) searchCandidate = "Complete Blood Count (CBC)";
        else if (lower.includes("liver") || lower.includes("lft")) searchCandidate = "Liver Function Test (LFT)";
        else if (lower.includes("kidney") || lower.includes("kft")) searchCandidate = "Kidney Function Test (KFT/RFT)";
        else if (lower.includes("vitamin")) searchCandidate = "Vitamin D3 (25-Hydroxy)";
        else if (contextTestName) searchCandidate = contextTestName;
        else searchCandidate = userMessage;
      }

      toolArgs = { test_name: searchCandidate };
      toolResult = await checkTestPrep(searchCandidate);

      if (toolResult.success) {
        if (lower.includes("tea") || lower.includes("coffee") || lower.includes("milk")) {
          if (toolResult.data.fastingRequired) {
            aiResponse = `No, tea, coffee, and milk are strictly prohibited. ${toolResult.data.name} requires ${toolResult.data.fastingHours} hours of fasting with plain water only.`;
          } else {
            aiResponse = `Yes, tea or coffee is acceptable as no fasting is required for ${toolResult.data.name}.`;
          }
        } else if (lower.includes("water")) {
          aiResponse = `Yes, plain water is allowed and encouraged during the fasting period for ${toolResult.data.name}.`;
        } else {
          aiResponse = toolResult.speechText;
        }
      } else {
        aiResponse = toolResult.speechText;
      }
    }

    // G. Polite Gratitude / Closing
    else if (
      lower.includes("thank") ||
      lower.includes("thx") ||
      lower.includes("bye") ||
      lower.includes("good night") ||
      lower.includes("great thank")
    ) {
      aiResponse = "You're very welcome! Please remember your fasting guidelines, and feel free to reach out if you need anything else. Have a healthy day!";
    }

    // H. Greetings
    else if (
      lower === "hi" ||
      lower.startsWith("hi ") ||
      lower.startsWith("hello") ||
      lower.startsWith("hey") ||
      lower.includes("good morning") ||
      lower.includes("good afternoon")
    ) {
      aiResponse = "Hello! This is Ananya from Apex Diagnostic Centre. I can help you check test fasting requirements, check available slots, or book an appointment. How can I assist you today?";
    }

    // I. Middle of conversation fallback
    else if (conversationHistory.length > 0) {
      if (contextTestName) {
        aiResponse = `I'm here to help with your ${contextTestName}. Would you like to check available slots, book an appointment, or ask about preparation rules?`;
      } else {
        aiResponse = "I can help you check test preparation guidelines or book an appointment. Which diagnostic test are you interested in?";
      }
    }

    // J. Initial Fallback
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
