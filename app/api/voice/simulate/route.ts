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

// Helper to extract patient name from dialogue
function extractPatientName(text: string): string | null {
  const patterns = [
    /(?:book for|appointment for|patient is|patient name is|patient:?\s*)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /(?:my name is|i am|this is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /(?:for\s+)([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const lowerCandidate = candidate.toLowerCase();
      if (
        ![
          "tomorrow",
          "today",
          "a test",
          "the test",
          "kidney",
          "blood",
          "morning",
          "afternoon",
          "fbs",
          "fasting",
          "lipid",
        ].includes(lowerCandidate)
      ) {
        return candidate
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      }
    }
  }
  return null;
}

// Helper to extract 10-digit mobile number
function extractPhoneNumber(text: string): string | null {
  const match = text.match(/(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5}|\b\d{10}\b)/);
  if (match && match[1]) {
    const clean = match[1].replace(/\D/g, "");
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    }
  }
  return null;
}

// Gemini Tool Definitions
const geminiTools = [
  {
    name: "check_test_prep",
    description:
      "Look up preparation guidelines, price, fasting hours, and requirements for a medical lab test (e.g. Kidney Function Test, Vitamin D, Lipid Profile, Fasting Blood Sugar, Thyroid, CBC, Ultrasound, LFT). Call this whenever a patient asks about or mentions any diagnostic test.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        test_name: {
          type: Type.STRING,
          description: "The name of the medical test, e.g. 'Kidney Function Test', 'Lipid Profile', 'Fasting Blood Sugar', etc.",
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
      "Book an appointment for a patient. CRITICAL: You MUST only call this function when you have collected ALL 4 required fields: test_name, time_slot, patient_name, and patient_phone. If the patient's phone number or name is missing, you must ask the patient for it instead of calling this function.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        test_name: {
          type: Type.STRING,
          description: "Name of the diagnostic test to book (e.g. 'Kidney Function Test (KFT/RFT)', 'Lipid Profile', etc.)",
        },
        time_slot: {
          type: Type.STRING,
          description: "The chosen time slot, e.g. '09:00 AM', '08:30 AM', '07:30 AM'",
        },
        date: {
          type: Type.STRING,
          description: "The date for the appointment, e.g. 'tomorrow' or 'today'",
        },
        patient_name: {
          type: Type.STRING,
          description: "The patient's actual full name as given in the conversation (e.g. 'Govind Pandey'). NEVER use 'Patient' if the patient provided their name.",
        },
        patient_phone: {
          type: Type.STRING,
          description: "The patient's 10-digit mobile number.",
        },
      },
      required: ["test_name", "time_slot", "patient_name", "patient_phone"],
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

    // Extract any existing patient name & phone from all history + current message
    let collectedPatientName = "";
    let collectedPatientPhone = "";

    // Check current message first
    collectedPatientName = extractPatientName(userMessage) || "";
    collectedPatientPhone = extractPhoneNumber(userMessage) || "";

    // Then search through conversation history
    for (const turn of conversationHistory) {
      if (!collectedPatientName && turn.text) {
        collectedPatientName = extractPatientName(turn.text) || "";
      }
      if (!collectedPatientPhone && turn.text) {
        collectedPatientPhone = extractPhoneNumber(turn.text) || "";
      }
      if (turn.toolCall?.args?.patient_name && turn.toolCall.args.patient_name !== "Patient") {
        collectedPatientName = turn.toolCall.args.patient_name;
      }
      if (turn.toolCall?.args?.patient_phone) {
        collectedPatientPhone = turn.toolCall.args.patient_phone;
      }
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // -------------------------------------------------------------
    // OPTION A: If GEMINI_API_KEY is configured, use Gemini Agent!
    // -------------------------------------------------------------
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents: any[] = [];

        for (const turn of conversationHistory) {
          if (turn.text) {
            contents.push({
              role: turn.sender === "ai" ? "model" : "user",
              parts: [{ text: turn.text }],
            });
          }
        }

        contents.push({
          role: "user",
          parts: [{ text: userMessage }],
        });

        const systemInstruction =
          "You are Ananya, an empathetic, highly professional medical receptionist at Apex Diagnostic Centre.\n" +
          "Clinical Booking Protocol:\n" +
          "1. Test Inquiries: Answer questions about tests, pricing, and fasting instructions (plain water allowed, tea/coffee prohibited for fasting tests) using check_test_prep.\n" +
          "2. Available Times: When a patient asks about available times or wants to book, call get_available_slots to offer 2 available slots.\n" +
          "3. Mandatory Patient Details Collection:\n" +
          "   - Remember the patient's full name throughout the conversation (e.g. if caller said 'i want to book for govind pandey', their name is 'Govind Pandey').\n" +
          "   - When a slot is selected, check if you have their 10-digit mobile number.\n" +
          "   - If you know their name (e.g. Govind Pandey) but NOT their phone number, ask: 'Great! Could you please share your 10-digit mobile number so I can confirm the booking and send reminder details?'\n" +
          "   - If you do not have their name either, ask: 'Could you please share your full name and 10-digit mobile number to complete the booking?'\n" +
          "   - DO NOT call book_lab_appointment without the patient's mobile number and name. Ask for them first!\n" +
          "4. Booking Execution: ONLY call book_lab_appointment once you have the test_name, time_slot, patient_name, and patient_phone.\n" +
          "5. Keep responses concise, polite, and reassuring (1 to 2 short sentences max) suitable for voice delivery." +
          (collectedPatientName ? `\nNote: The patient's name already identified in this conversation is: ${collectedPatientName}.` : "");

        const geminiResponse = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: geminiTools as any }],
          },
        });

        if (geminiResponse.functionCalls && geminiResponse.functionCalls.length > 0) {
          const fnCall = geminiResponse.functionCalls[0];
          const fnName = fnCall.name;
          const fnArgs = (fnCall.args || {}) as any;

          // Override name/phone if collected from history and missing in tool args
          if (collectedPatientName && (!fnArgs.patient_name || fnArgs.patient_name === "Patient")) {
            fnArgs.patient_name = collectedPatientName;
          }
          if (collectedPatientPhone && !fnArgs.patient_phone) {
            fnArgs.patient_phone = collectedPatientPhone;
          }

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
              patient_name: fnArgs.patient_name || collectedPatientName || "Patient",
              patient_phone: fnArgs.patient_phone || collectedPatientPhone || "+91 98000 00000",
              test_name: fnArgs.test_name || "Kidney Function Test (KFT/RFT)",
              date: fnArgs.date || "tomorrow",
              time_slot: fnArgs.time_slot || "09:00 AM",
            });
            detectedIntent = "BOOKING";
          } else if (fnName === "confirm_fasting_readiness") {
            toolResult = await confirmFastingReadiness({
              patient_name: fnArgs.patient_name || collectedPatientName,
              patient_phone: fnArgs.patient_phone || collectedPatientPhone,
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
      }
    }

    // -------------------------------------------------------------
    // OPTION B: Intelligent Local Fallback Engine
    // -------------------------------------------------------------
    const lower = userMessage.toLowerCase();

    let contextTestName = "";
    let contextDate = "tomorrow";
    let lastOfferedSlots: string[] = [];
    let lastAiText = "";
    let lastToolName = "";

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
    }

    if (lastOfferedSlots.length === 0 && lastAiText) {
      const matches = lastAiText.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi);
      if (matches && matches.length > 0) {
        lastOfferedSlots = matches;
      }
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
      if (lower.includes("kidney") || lower.includes("kft") || lower.includes("rft")) {
        testDetectedInMessage = "Kidney Function Test (KFT/RFT)";
      } else if (lower.includes("vitamin d") || lower.includes("vit d") || lower.includes("vitamin")) {
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

    // 1. Phone number provided
    if (collectedPatientPhone && (lastAiText.toLowerCase().includes("mobile number") || lastAiText.toLowerCase().includes("phone"))) {
      detectedIntent = "BOOKING";
      toolCalled = "book_lab_appointment";
      const targetTest = contextTestName || "Kidney Function Test (KFT/RFT)";
      const targetSlot = lastOfferedSlots[0] || "09:00 AM";

      toolArgs = {
        patient_name: collectedPatientName || "Patient",
        patient_phone: collectedPatientPhone,
        test_name: targetTest,
        date: dateStr,
        time_slot: targetSlot,
      };
      toolResult = await bookLabAppointment(toolArgs);
      aiResponse = toolResult.speechText;
    }

    // 2. User chose a slot
    else if (detectedSlot && (slotContextActive || userMessage.length < 20 || lower.includes("book") || lower.includes("slot"))) {
      detectedIntent = "BOOKING";

      if (!collectedPatientPhone) {
        // Ask for phone number
        if (collectedPatientName) {
          aiResponse = `I have reserved ${detectedSlot} on ${dateStr} for your ${contextTestName || "test"}, ${collectedPatientName}. Could you please share your 10-digit mobile number so we can confirm the booking and send reminders?`;
        } else {
          aiResponse = `I have reserved ${detectedSlot} on ${dateStr}. Could you please share your full name and 10-digit mobile number to complete the booking?`;
        }
      } else {
        toolCalled = "book_lab_appointment";
        const testToBook = testDetectedInMessage || contextTestName || "Kidney Function Test (KFT/RFT)";
        toolArgs = {
          patient_name: collectedPatientName || "Patient",
          patient_phone: collectedPatientPhone,
          test_name: testToBook,
          date: dateStr,
          time_slot: detectedSlot,
        };
        toolResult = await bookLabAppointment(toolArgs);
        aiResponse = toolResult.speechText;
      }
    }

    // 3. User mentioned a specific test (e.g. "ki want a test for kidney", "vitamin D")
    else if (testDetectedInMessage && !lower.includes("book") && !lower.includes("slot")) {
      detectedIntent = "PREP_QUERY";
      toolCalled = "check_test_prep";
      toolArgs = { test_name: testDetectedInMessage };
      toolResult = await checkTestPrep(testDetectedInMessage);
      aiResponse = toolResult.speechText;
    }

    // 4. Booking intent
    else if (
      lower.includes("book") ||
      lower.includes("schedule") ||
      lower.includes("appointment") ||
      lower.includes("reserve")
    ) {
      detectedIntent = "BOOKING";
      const targetTest = testDetectedInMessage || contextTestName;

      if (targetTest && detectedSlot && collectedPatientPhone) {
        toolCalled = "book_lab_appointment";
        toolArgs = {
          patient_name: collectedPatientName || "Patient",
          patient_phone: collectedPatientPhone,
          test_name: targetTest,
          date: dateStr,
          time_slot: detectedSlot,
        };
        toolResult = await bookLabAppointment(toolArgs);
        aiResponse = toolResult.speechText;
      } else if (targetTest) {
        toolCalled = "get_available_slots";
        toolArgs = { date: dateStr };
        toolResult = await getAvailableSlots(dateStr);
        aiResponse = `We have ${toolResult.data.recommended[0]} or ${toolResult.data.recommended[1]} available on ${toolResult.data.displayDate}. Which suits you better?`;
      } else {
        aiResponse = "I can certainly help you book an appointment. Which diagnostic test would you like to schedule?";
      }
    }

    // 5. Fallback
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
