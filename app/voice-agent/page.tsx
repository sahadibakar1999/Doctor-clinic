"use client";

import { useState } from "react";
import {
  Bot,
  Copy,
  Check,
  Code,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Mic,
  PhoneCall,
  Globe,
  Settings,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { VoiceSimulatorModal } from "@/components/VoiceSimulatorModal";

export default function VoiceAgentGuidePage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const SYSTEM_PROMPT = `[ROLE & PERSONA]
You are "Ananya", the inbound medical receptionist for Apex Diagnostic Centre.
Your tone is empathetic, clear, calm, and efficient.
You speak fluent Indian English (with natural polite phrasing like "Certainly", "Sure, give me a moment").

[RULES & BOUNDARIES]
- Maximum 2 sentences per response. Never speak in paragraphs.
- Never diagnose medical conditions or advise on medicines.
- Always highlight fasting guidelines clearly. Fasting errors lead to canceled tests.

[WORKFLOW: TEST INQUIRY & PREP]
1. If the caller asks about a test (e.g., "I need a Lipid Profile test"):
   - Call the check_test_prep tool with the test name.
   - Quote the price and explicitly state the fasting duration (e.g., "A Lipid Profile is ₹650 and requires 10 to 12 hours of overnight fasting. Only plain water is allowed.").

[WORKFLOW: BOOKING]
2. If the caller wants to book:
   - Ask for their Full Name and preferred date (e.g., tomorrow morning).
   - Call get_available_slots.
   - Offer 2 morning slots (e.g., "We have 8:00 AM or 9:00 AM available. Which suits you better?").
   - Once chosen, call book_lab_appointment.
   - Conclude: "Your appointment is confirmed for tomorrow at 8:00 AM. Please ensure you do not eat anything after 10:00 PM tonight. See you tomorrow!"

[WORKFLOW: OUTBOUND PREP REMINDER CALL]
1. Greet: "Hello, am I speaking with {patient_name}?"
2. State purpose: "This is Ananya calling from Apex Diagnostic Centre regarding your {test_name} scheduled for tomorrow at {time_slot}."
3. Deliver prep: "As a reminder, this test requires {fasting_hours} hours of fasting. Please stop eating by {fasting_cutoff_time}. Will you be able to follow this?"
4. If yes: Call confirm_fasting_readiness and thank them.
5. If no/cannot make it: Offer to reschedule.`;

  const TOOL_SCHEMAS = [
    {
      name: "book_lab_appointment",
      description: "Books a lab test appointment and returns confirmation with fasting instructions",
      schema: {
        name: "book_lab_appointment",
        description: "Books a lab test appointment and returns confirmation with fasting instructions",
        parameters: {
          type: "object",
          properties: {
            patient_name: { type: "string", description: "Full name of the patient" },
            patient_phone: { type: "string", description: "10-digit Indian phone number" },
            test_name: { type: "string", description: "Name of the diagnostic test" },
            date: { type: "string", description: "YYYY-MM-DD or 'tomorrow'" },
            time_slot: { type: "string", description: "e.g., 08:30 AM" },
          },
          required: ["patient_name", "patient_phone", "test_name", "date", "time_slot"],
        },
      },
    },
    {
      name: "check_test_prep",
      description: "Searches DB for test, returns exact prep rules, fasting hours, and price in ₹",
      schema: {
        name: "check_test_prep",
        description: "Searches database for exact preparation protocols, fasting hours, and price for a test",
        parameters: {
          type: "object",
          properties: {
            test_name: { type: "string", description: "Name or acronym of the lab test (e.g. Lipid Profile, FBS)" },
          },
          required: ["test_name"],
        },
      },
    },
    {
      name: "get_available_slots",
      description: "Returns available morning and afternoon clinic slots for a given date",
      schema: {
        name: "get_available_slots",
        description: "Returns open appointment slots without double-booking collisions",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Target date (e.g. YYYY-MM-DD, today, tomorrow)" },
          },
          required: ["date"],
        },
      },
    },
    {
      name: "confirm_fasting_readiness",
      description: "Marks fastingAcknowledged: true for patient to prevent sample cancellation",
      schema: {
        name: "confirm_fasting_readiness",
        description: "Records patient verbal agreement that they will adhere to required fasting hours",
        parameters: {
          type: "object",
          properties: {
            appointment_id: { type: "string", description: "CUID of the appointment (optional)" },
            patient_phone: { type: "string", description: "Caller phone number (optional)" },
            patient_name: { type: "string", description: "Patient name (optional)" },
          },
        },
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Navbar onOpenSimulator={() => setIsSimulatorOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Voice Agent Configuration
              </h1>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200">
                Vapi & Retell AI
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              System prompts, tool function schemas, and webhook endpoints ready to copy and paste into your voice telephony provider.
            </p>
          </div>

          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:from-brand-700 hover:to-brand-800 transition-all"
          >
            <Mic className="h-4 w-4" />
            <span>Launch Built-In Simulator</span>
          </button>
        </div>

        {/* Webhook Endpoint Info Card */}
        <div className="mb-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/80 via-white to-clinic-teal/5 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
                  Universal Server Webhook URL
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Configure this URL as the Server URL or Custom Tool Webhook in Vapi / Retell:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-mono font-semibold text-brand-300 border border-slate-800">
                  https://your-domain.com/api/voice/webhook
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${typeof window !== "undefined" ? window.location.origin : ""}/api/voice/webhook`,
                      "webhook"
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  title="Copy Webhook URL"
                >
                  {copiedKey === "webhook" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 border border-slate-200 text-xs space-y-1 sm:max-w-xs">
              <span className="font-semibold text-slate-800">Supported Request Payloads:</span>
              <ul className="text-slate-500 list-disc list-inside space-y-0.5 text-[11px]">
                <li>Vapi standard <code>tool-calls</code></li>
                <li>Retell AI tool invocations</li>
                <li>OpenAI function format</li>
              </ul>
            </div>
          </div>
        </div>

        {/* System Prompt Section */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">
                Voice Agent System Prompt ("Ananya")
              </h2>
            </div>
            <button
              onClick={() => copyToClipboard(SYSTEM_PROMPT, "prompt")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {copiedKey === "prompt" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copy System Prompt</span>
                </>
              )}
            </button>
          </div>

          <pre className="mt-4 rounded-xl bg-slate-900 p-4 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 border border-slate-800">
            {SYSTEM_PROMPT}
          </pre>
        </div>

        {/* Tool Schemas Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">
                Tool Function Schemas (JSON Schema)
              </h2>
            </div>
            <span className="text-xs text-slate-400">4 functions declared</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {TOOL_SCHEMAS.map((tool) => {
              const jsonString = JSON.stringify(tool.schema, null, 2);
              return (
                <div
                  key={tool.name}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-emerald-600" />
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {tool.name}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(jsonString, tool.name)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        title="Copy Tool JSON Schema"
                      >
                        {copiedKey === tool.name ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span>{copiedKey === tool.name ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{tool.description}</p>
                  </div>

                  <pre className="mt-3 rounded-xl bg-slate-950 p-3 text-xs font-mono text-brand-300 overflow-x-auto max-h-56 border border-slate-800">
                    {jsonString}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Simulator Modal */}
      <VoiceSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
}
