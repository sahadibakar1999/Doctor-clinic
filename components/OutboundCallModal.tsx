"use client";

import { useState } from "react";
import {
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Sparkles,
  Bot,
  Calendar,
  X,
  RefreshCw,
} from "lucide-react";
import { calculateFastingCutoff } from "@/lib/utils";

interface AppointmentItem {
  id: string;
  patientName: string;
  patientPhone: string;
  timeSlot: string;
  date: string | Date;
  status: string;
  fastingAcknowledged: boolean;
  test: {
    id: string;
    name: string;
    price: number;
    fastingRequired: boolean;
    fastingHours: number;
    prepInstructions: string;
  };
}

interface OutboundCallModalProps {
  isOpen: boolean;
  appointment: AppointmentItem | null;
  onClose: () => void;
  onCallCompleted: () => void;
}

export function OutboundCallModal({
  isOpen,
  appointment,
  onClose,
  onCallCompleted,
}: OutboundCallModalProps) {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "completed">("idle");
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !appointment) return null;

  const test = appointment.test;
  const cutoffTime = calculateFastingCutoff(appointment.timeSlot, test.fastingHours);
  const formattedDate = new Date(appointment.date).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const startSimulatedCall = async () => {
    setCallState("ringing");
    setTranscriptLines(["Connecting to patient carrier... (+91 " + appointment.patientPhone.slice(-10) + ")"]);

    // Ringing delay
    setTimeout(() => {
      setCallState("connected");
      setTranscriptLines([
        `AI (Ananya): Hello, am I speaking with ${appointment.patientName}?`,
        `Patient: Yes, this is ${appointment.patientName.split(" ")[0]}. Who is speaking?`,
        `AI (Ananya): This is Ananya calling from Apex Diagnostic Centre regarding your ${test.name} scheduled for ${formattedDate} at ${appointment.timeSlot}.`,
        test.fastingRequired
          ? `AI (Ananya): As a critical reminder, this test requires ${test.fastingHours} hours of strict fasting. Please stop eating by ${cutoffTime}. Only plain water is permitted. Will you be able to follow this protocol?`
          : `AI (Ananya): As a reminder, please arrive 10 minutes prior to your slot. ${test.prepInstructions}`,
      ]);
    }, 1800);
  };

  const confirmPatientReadiness = async () => {
    setIsProcessing(true);
    setTranscriptLines((prev) => [
      ...prev,
      `Patient: Yes, absolutely. I will finish dinner before ${cutoffTime} and drink only water.`,
      `AI (Ananya): Wonderful! Your fasting protocol readiness is now recorded in our system. We look forward to seeing you at ${appointment.timeSlot}. Have a pleasant evening!`,
      `[System: confirm_fasting_readiness tool executed. Fasting Acknowledged: TRUE]`,
    ]);

    try {
      await fetch("/api/lab/reminders/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          markAcknowledged: true,
        }),
      });

      setCallState("completed");
      setTimeout(() => {
        onCallCompleted();
      }, 1400);
    } catch (err) {
      console.error("Reminder call trigger error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndCall = () => {
    setCallState("idle");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Outbound Voice Reminder Dispatch
              </h3>
              <p className="text-xs text-slate-500">
                Patient Fasting Protocol Verification Call
              </p>
            </div>
          </div>
          <button
            onClick={handleEndCall}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Patient & Test Overview Box */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Patient:</span>
                <p className="text-sm font-semibold text-slate-900">{appointment.patientName}</p>
                <p className="text-slate-500">{appointment.patientPhone}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Scheduled Test:</span>
                <p className="text-sm font-semibold text-brand-700">{test.name}</p>
                <p className="text-slate-500">
                  {formattedDate} at {appointment.timeSlot}
                </p>
              </div>
            </div>

            {/* Fasting Notice */}
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200/80">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  Required Fasting: {test.fastingHours} Hours.
                </span>{" "}
                Food cutoff: <strong className="text-amber-950">{cutoffTime}</strong>. Only plain
                water permitted.
              </div>
            </div>
          </div>

          {/* Call Status & Live Wave */}
          {callState === "idle" && (
            <div className="text-center py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-3">
                <PhoneCall className="h-8 w-8" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Ready to dial {appointment.patientName}?
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Ananya will call the patient, deliver the exact {test.fastingHours}h fasting
                instructions, and prompt for confirmation to protect sample validity.
              </p>

              <button
                onClick={startSimulatedCall}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 hover:from-emerald-700 hover:to-emerald-800 transition-all"
              >
                <PhoneCall className="h-4 w-4" />
                <span>Start Outbound Call</span>
              </button>
            </div>
          )}

          {callState === "ringing" && (
            <div className="text-center py-8">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-3 animate-bounce">
                <PhoneCall className="h-8 w-8" />
              </div>
              <p className="text-sm font-bold text-slate-900">Ringing patient device...</p>
              <p className="text-xs text-slate-500 mt-1">Routing via voice gateway</p>
            </div>
          )}

          {(callState === "connected" || callState === "completed") && (
            <div className="space-y-4">
              {/* Call in progress banner */}
              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <span className="text-xs font-semibold">
                      {callState === "connected" ? "Call Connected • In Progress" : "Call Completed"}
                    </span>
                    <p className="text-[10px] text-slate-400">Agent: Ananya (AI Voice)</p>
                  </div>
                </div>

                {/* Audio Wave Bars */}
                {callState === "connected" && (
                  <div className="flex items-center gap-1">
                    <span className="wave-bar w-1 bg-brand-400 rounded-full" style={{ animationDelay: "0.1s" }}></span>
                    <span className="wave-bar w-1 bg-brand-400 rounded-full" style={{ animationDelay: "0.3s" }}></span>
                    <span className="wave-bar w-1 bg-brand-400 rounded-full" style={{ animationDelay: "0.2s" }}></span>
                    <span className="wave-bar w-1 bg-brand-400 rounded-full" style={{ animationDelay: "0.4s" }}></span>
                  </div>
                )}
              </div>

              {/* Live Transcript Stream */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs font-sans">
                {transcriptLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.startsWith("AI")
                        ? "text-brand-900 font-medium"
                        : line.startsWith("Patient")
                        ? "text-slate-800"
                        : "text-emerald-700 font-semibold"
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>

              {/* Action Buttons for Call */}
              {callState === "connected" && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={confirmPatientReadiness}
                    disabled={isProcessing}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm Patient Fasting Readiness</span>
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <PhoneOff className="h-4 w-4 text-rose-500" />
                    <span>Hang Up</span>
                  </button>
                </div>
              )}

              {callState === "completed" && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs text-emerald-800 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Fasting Acknowledged! Appointment updated successfully.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
