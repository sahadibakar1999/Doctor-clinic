import { NextRequest, NextResponse } from "next/server";
import {
  checkTestPrep,
  getAvailableSlots,
  bookLabAppointment,
  confirmFastingReadiness,
  ToolResult,
} from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

// Core dispatcher for tool execution
async function executeTool(name: string, args: any): Promise<ToolResult> {
  const cleanName = (name || "").toLowerCase().replace(/-/g, "_");
  const params = typeof args === "string" ? JSON.parse(args || "{}") : (args || {});

  switch (cleanName) {
    case "check_test_prep":
    case "checktestprep":
    case "check_prep": {
      const testName = params.test_name || params.testName || params.name || params.query || "";
      return await checkTestPrep(testName);
    }

    case "get_available_slots":
    case "getavailableslots":
    case "get_slots": {
      const date = params.date || params.day || "tomorrow";
      return await getAvailableSlots(date);
    }

    case "book_lab_appointment":
    case "booklabappointment":
    case "book_appointment": {
      return await bookLabAppointment({
        patient_name: params.patient_name || params.patientName || params.name || "Patient",
        patient_phone: params.patient_phone || params.patientPhone || params.phone || "+91 98000 00000",
        test_name: params.test_name || params.testName || params.test || "",
        date: params.date || params.appointment_date || "tomorrow",
        time_slot: params.time_slot || params.timeSlot || params.slot || "08:00 AM",
      });
    }

    case "confirm_fasting_readiness":
    case "confirmfastingreadiness":
    case "confirm_fasting": {
      return await confirmFastingReadiness({
        appointment_id: params.appointment_id || params.appointmentId,
        patient_phone: params.patient_phone || params.patientPhone || params.phone,
        patient_name: params.patient_name || params.patientName || params.name,
      });
    }

    default: {
      return {
        success: false,
        tool: name,
        data: null,
        speechText: `Tool "${name}" is not recognized by the AuraLab voice system.`,
        error: `Unknown tool "${name}". Available tools: check_test_prep, get_available_slots, book_lab_appointment, confirm_fasting_readiness.`,
      };
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    // 1. Detect Vapi Tool Call format:
    // { message: { type: "tool-calls", toolCalls: [ { id, function: { name, arguments } } ] } }
    if (body?.message?.type === "tool-calls" && Array.isArray(body.message.toolCalls)) {
      const results = [];
      for (const call of body.message.toolCalls) {
        const fnName = call.function?.name;
        let fnArgs = call.function?.arguments;
        if (typeof fnArgs === "string") {
          try {
            fnArgs = JSON.parse(fnArgs);
          } catch {
            // fallback
          }
        }
        const outcome = await executeTool(fnName, fnArgs);
        results.push({
          toolCallId: call.id,
          result: {
            success: outcome.success,
            data: outcome.data,
            speechText: outcome.speechText,
            message: outcome.speechText,
          },
        });
      }
      return NextResponse.json({ results });
    }

    // 2. Detect Vapi Legacy Function Call format:
    // { message: { type: "function-call", functionCall: { name, parameters } } }
    if (body?.message?.type === "function-call" && body.message.functionCall) {
      const { name, parameters } = body.message.functionCall;
      const outcome = await executeTool(name, parameters);
      return NextResponse.json({
        result: outcome.speechText,
        data: outcome.data,
      });
    }

    // 3. Detect Retell AI Tool Call format:
    // { name: "check_test_prep", args: { ... }, call: { ... } }
    if (body?.name && body?.args !== undefined) {
      const outcome = await executeTool(body.name, body.args);
      return NextResponse.json({
        result: outcome.speechText,
        data: outcome.data,
        success: outcome.success,
      });
    }

    // 4. Detect Direct invocation:
    // { tool: "...", args: { ... } } OR { function: "...", parameters: { ... } }
    const toolName = body.tool || body.function || body.name || body.action;
    const toolArgs = body.args || body.parameters || body.params || body;

    if (toolName) {
      const outcome = await executeTool(toolName, toolArgs);
      return NextResponse.json(outcome);
    }

    return NextResponse.json(
      {
        error: "Unrecognized payload format",
        supportedFormats: ["Vapi tool-calls", "Vapi function-call", "Retell AI tool call", "Direct { tool, args }"],
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error in voice webhook",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "AuraLab Voice Webhook API",
    version: "1.0.0",
    compatibleWith: ["Vapi.ai", "Retell AI", "OpenAI Assistant Function Calling"],
    availableTools: [
      {
        name: "check_test_prep",
        description: "Searches DB for test, returns exact prep rules, fasting hours, and price.",
        parameters: { test_name: "string" },
      },
      {
        name: "get_available_slots",
        description: "Returns available morning/afternoon slots for given date.",
        parameters: { date: "string (e.g. YYYY-MM-DD or tomorrow)" },
      },
      {
        name: "book_lab_appointment",
        description: "Validates slot availability and books a diagnostic appointment with fasting instructions.",
        parameters: {
          patient_name: "string",
          patient_phone: "string",
          test_name: "string",
          date: "string",
          time_slot: "string",
        },
      },
      {
        name: "confirm_fasting_readiness",
        description: "Confirms that patient has started fasting and acknowledges preparation instructions.",
        parameters: { appointment_id: "string (optional)", patient_phone: "string (optional)" },
      },
    ],
  });
}
