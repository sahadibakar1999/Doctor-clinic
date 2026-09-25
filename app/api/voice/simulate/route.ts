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
import { GoogleGenAI, Type } from "@google/genai";

export const dynamic = "force-dynamic";

// Gemini Tool Definitions
const geminiTools = [
  {
    name: "check_test_prep",
    description:
      "Look up preparation guidelines, price, fasting hours, and requirements for a medical lab test (e.g. Vitamin D, Lipid Profile, Fasting Blood Sugar, Thyroid, CBC, Ultrasound, LFT, KFT). Call this whenever a patient asks about or mentions any diagnostic test.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        test_name: {
          type: Type.STRING,
          description: "The name of the medical test, e.g. 'Vitamin D', 'Lipid Profile', 'Fasting Blood Sugar', etc.",
        },
      },
      required: ["test_name"],
    },
  },
  {
    name: "get_available_slots",
    description:
      "Get available morning or afternoon appointment slots for diagnostic lab tests for a specified date (e.g. 'tomorrow' or 'today' or 'YYYY-MM-DD').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: "The target date for the appointment, e.g. 'tomorrow' or 'today'",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "book_lab_appointment",
    description:
      "Book an appointment for a patient for a specific diagnostic test and time slot. Calculates and reports fasting cutoff times automatically.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        test_name: {
          type: Type.STRING,
          description: "Name of the diagnostic test to book (e.g. 'Lipid Profile', 'Fasting Blood Sugar (FBS)', 'Vitamin D3', etc.)",
        },
        time_slot: {
          type: Type.STRING,
          description: "The chosen time slot, e.g. '08:30 AM', '07:30 AM', '09:00 AM'",
        },
        date: {
          type: Type.STRING,
          description: "The date for the appointment, e.g. 'tomorrow' or 'today'",
        },
        patient_name: {
          type: Type.STRING,
          description: "Patient's full name, default to 'Patient' if not specified",
        },
        patient_phone: {
          type: Type.STRING,
          description: "Patient's phone number, default to '+91 98200 45678' if not specified",
        },
      },
      required: ["test_name", "time_slot"],
    },
  },
  {
    name: "confirm_fasting_readiness",
    description:
      "Confirm that a patient has started fasting and acknowledges fasting preparation rules for their upcoming appointment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        patient_name: {
          type: Type.STRING,
          description: "Name of the patient",
        },
        patient_phone: {
          type: Type.STRING,
          description: "Phone number of the patient",
        },
      },
    },
  },
];

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

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // -------------------------------------------------------------
    // OPTION A: If GEMINI_API_KEY is configured, use Gemini Agent!
    // -------------------------------------------------------------
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents: any[] = [];

        // Add history turns (excluding any initial greetings if empty)
        for (const turn of conversationHistory) {
          if (turn.text) {
            contents.push({
              role: turn.sender === "ai" ? "model" : "user",
              parts: [{ text: turn.text }],
            });
          }
        }

        // Add latest user message
        contents.push({
          role: "user",
          parts: [{ text: userMessage }],
        });

        const geminiResponse = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction:
              "You are Ananya, an empathetic, highly professional medical receptionist at Apex Diagnostic Centre.\n" +
              "Your primary role is patient assistance:\n" +
              "1. Answer questions about diagnostic lab tests and preparation (especially fasting requirements, water/tea rules, price).\n" +
              "2. Check available appointment time slots when asked.\n" +
              "3. When a patient chooses a time slot (like '8:30 am' or 'the first one') or asks to book, call book_lab_appointment immediately with the test discussed.\n" +
              "4. When a patient mentions a test (like 'vitamin D', 'lipid profile', 'FBS'), call check_test_prep to look up their prep instructions.\n" +
              "5. Keep responses concise, polite, and reassuring (1 to 2 short sentences max) suitable for clear voice delivery.\n" +
              "Always use the provided tools to fetch real data and book appointments.",
            tools: [{ functionDeclarations: geminiTools as any }],
          },
        });

        // Check if Gemini invoked a function call
        if (geminiResponse.functionCalls && geminiResponse.functionCalls.length > 0) {
          const fnCall = geminiResponse.functionCalls[0];
          const fnName = fnCall.name;
          const fnArgs = (fnCall.args || {}) as any;

          let toolResult: any = null;
          let detectedIntent = "OTHER";

          if (fnName === "check_test_prep") {
            toolResult = await checkTestPrep(fnArgs.test_name || userMessage);
            detectedIntent = "PREP_QUERY";
          } else if (fnName === "get_available_slots") {
            toolResult = await getAvailableSlots(fnArgs.date || "tomorrow");
            detectedIntent = "BOOKING";
          } else if (fnName === "book_lab_appointment") {
            toolResult = await bookLabAppointment({
              patient_name: fnArgs.patient_name || "Patient",
              patient_phone: fnArgs.patient_phone || "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
              test_name: fnArgs.test_name || "Fasting Blood Sugar (FBS)",
              date: fnArgs.date || "tomorrow",
              time_slot: fnArgs.time_slot || "08:30 AM",
            });
            detectedIntent = "BOOKING";
          } else if (fnName === "confirm_fasting_readiness") {
            toolResult = await confirmFastingReadiness({
              patient_name: fnArgs.patient_name,
              patient_phone: fnArgs.patient_phone,
            });
            detectedIntent = "PREP_QUERY";
          }

          return NextResponse.json({
            success: true,
            userMessage,
            aiResponse: toolResult?.speechText || "I've processed your request with Apex Diagnostics.",
            detectedIntent,
            toolCalled: fnName,
            toolArgs: fnArgs,
            toolResult,
            engine: "Gemini",
            timestamp: new Date().toISOString(),
          });
        }

        // Pure text response from Gemini (greetings, general chat, clarifying questions)
        const textResponse = geminiResponse.text?.trim() || "";
        if (textResponse) {
          return NextResponse.json({
            success: true,
            userMessage,
            aiResponse: textResponse,
            detectedIntent: "OTHER",
            toolCalled: null,
            toolArgs: null,
            toolResult: null,
            engine: "Gemini",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiError: any) {
        console.error("Gemini API error, falling back to local engine:", geminiError);
        // Continue to local fallback below
      }
    }

    // -------------------------------------------------------------
    // OPTION B: Intelligent Local Fallback Engine
    // -------------------------------------------------------------
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

    if (lastOfferedSlots.length === 0 && lastAiText) {
      const matches = lastAiText.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi);
      if (matches && matches.length > 0) {
        lastOfferedSlots = matches;
      }
    }

    let patientName = contextPatientName || "Patient";
    const currentNameMatch = userMessage.match(/(?:my name is|i am|for\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (currentNameMatch && currentNameMatch[1]) {
      patientName = currentNameMatch[1].trim();
    }

    let dateStr = contextDate;
    if (lower.includes("today")) dateStr = "today";
    else if (lower.includes("tomorrow")) dateStr = "tomorrow";

    // Detect slot choice
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

    // Direct test name detection in current user message
    let testDetectedInMessage = "";
    const allDbTests = await prisma.labTest.findMany({ select: { name: true } });
    for (const t of allDbTests) {
      const tLower = t.name.toLowerCase();
      const shortName = tLower.split("(")[0].trim();
      if (lower.includes(tLower) || lower.includes(shortName)) {
        testDetectedInMessage = t.name;
        break;
      }
    }
    if (!testDetectedInMessage) {
      if (lower.includes("vitamin d") || lower.includes("vit d") || lower.includes("vitamin")) {
        testDetectedInMessage = "Vitamin D3 (25-Hydroxy)";
      } else if (lower.includes("lipid") || lower.includes("cholesterol")) {
        testDetectedInMessage = "Lipid Profile";
      } else if (lower.includes("fbs") || lower.includes("fasting sugar") || lower.includes("sugar") || lower.includes("glucose")) {
        testDetectedInMessage = "Fasting Blood Sugar (FBS)";
      } else if (lower.includes("thyroid") || lower.includes("tsh")) {
        testDetectedInMessage = "Thyroid Profile (T3, T4, TSH)";
      } else if (lower.includes("ultrasound") || lower.includes("abdomen") || lower.includes("sonography") || lower.includes("scan")) {
        testDetectedInMessage = "Ultrasound Whole Abdomen";
      } else if (lower.includes("cbc") || lower.includes("blood count")) {
        testDetectedInMessage = "Complete Blood Count (CBC)";
      } else if (lower.includes("liver") || lower.includes("lft")) {
        testDetectedInMessage = "Liver Function Test (LFT)";
      } else if (lower.includes("kidney") || lower.includes("kft")) {
        testDetectedInMessage = "Kidney Function Test (KFT/RFT)";
      }
    }

    let toolCalled: string | null = null;
    let toolArgs: any = null;
    let toolResult: any = null;
    let aiResponse = "";
    let detectedIntent = "OTHER";

    const slotContextActive =
      lastToolName === "get_available_slots" ||
      lastAiText.toLowerCase().includes("which suits you better") ||
      lastAiText.toLowerCase().includes("available on") ||
      lastOfferedSlots.length > 0;

    // 1. Fasting confirmation
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
      toolArgs = {
        patient_phone: phoneMatch ? phoneMatch[0] : undefined,
        patient_name: patientName !== "Patient" ? patientName : undefined,
      };
      toolResult = await confirmFastingReadiness(toolArgs);
      aiResponse = toolResult.speechText;
    }

    // 2. User chose a slot
    else if (detectedSlot && (slotContextActive || userMessage.length < 20 || lower.includes("book") || lower.includes("slot"))) {
      detectedIntent = "BOOKING";
      toolCalled = "book_lab_appointment";
      const testToBook = testDetectedInMessage || contextTestName || "Fasting Blood Sugar (FBS)";
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

    // 3. User mentioned a specific test (e.g., "vitamin D", "lipid profile test") without booking
    else if (testDetectedInMessage && !lower.includes("book") && !lower.includes("slot")) {
      detectedIntent = "PREP_QUERY";
      toolCalled = "check_test_prep";
      toolArgs = { test_name: testDetectedInMessage };
      toolResult = await checkTestPrep(testDetectedInMessage);
      aiResponse = toolResult.speechText;
    }

    // 4. Affirmation ("yes", "sure", "ok", "confirm")
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
        detectedIntent = "BOOKING";
        toolCalled = "book_lab_appointment";
        toolArgs = {
          patient_name: patientName,
          patient_phone: "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
          test_name: testDetectedInMessage || contextTestName || "Fasting Blood Sugar (FBS)",
          date: dateStr,
          time_slot: lastOfferedSlots[0],
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
        aiResponse = "Certainly! Would you like to check test guidelines or book an appointment?";
      }
    }

    // 5. Explicit Booking Request
    else if (
      lower.includes("book") ||
      lower.includes("schedule") ||
      lower.includes("appointment") ||
      lower.includes("reserve") ||
      (lower.includes("want") && (lower.includes("test") || lower.includes("slot")))
    ) {
      detectedIntent = "BOOKING";
      const targetTest = testDetectedInMessage || contextTestName;

      if (targetTest && detectedSlot) {
        toolCalled = "book_lab_appointment";
        toolArgs = {
          patient_name: patientName,
          patient_phone: "+91 98200 " + Math.floor(10000 + Math.random() * 90000),
          test_name: targetTest,
          date: dateStr,
          time_slot: detectedSlot,
        };
        toolResult = await bookLabAppointment(toolArgs);
        aiResponse = toolResult.speechText;
      } else if (targetTest && !detectedSlot) {
        toolCalled = "get_available_slots";
        toolArgs = { date: dateStr };
        toolResult = await getAvailableSlots(dateStr);
        aiResponse = `Certainly! For ${targetTest} on ${dateStr}, we have ${toolResult.data.recommended[0]} or ${toolResult.data.recommended[1]} available. Which suits you better?`;
      } else {
        aiResponse = "I can certainly help you book an appointment. Which diagnostic test would you like to schedule?";
      }
    }

    // 6. Slot / Timing inquiry
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

    // 7. General Prep / Fasting / Price Inquiry
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
      const targetTest = testDetectedInMessage || contextTestName || "Lipid Profile";
      toolArgs = { test_name: targetTest };
      toolResult = await checkTestPrep(targetTest);

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

    // 8. Polite Gratitude / Closing
    else if (
      lower.includes("thank") ||
      lower.includes("thx") ||
      lower.includes("bye") ||
      lower.includes("good night")
    ) {
      aiResponse = "You're very welcome! Please remember your fasting guidelines, and feel free to reach out if you need anything else. Have a healthy day!";
    }

    // 9. Negative response ("no", "cancel")
    else if (lower === "no" || lower.startsWith("no ") || lower.includes("not now")) {
      aiResponse = "No problem! Feel free to ask whenever you need test preparation details or wish to schedule an appointment.";
    }

    // 10. Greetings
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

    // 11. Contextual fallback
    else if (conversationHistory.length > 0) {
      const active = testDetectedInMessage || contextTestName;
      if (active) {
        aiResponse = `I'm here to assist with your ${active}. Would you like to check test instructions, view available slots, or book an appointment?`;
      } else {
        aiResponse = "I can help you check test preparation guidelines or book an appointment. Which diagnostic test are you interested in?";
      }
    }

    // 12. Initial fallback
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
      engine: "Local",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("POST /api/voice/simulate error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
