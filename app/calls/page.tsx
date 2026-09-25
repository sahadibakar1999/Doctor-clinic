"use client";

import { useState, useEffect } from "react";
import {
  PhoneCall,
  Search,
  Filter,
  Bot,
  User,
  Clock,
  Sparkles,
  FileText,
  Calendar,
  Volume2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { VoiceSimulatorModal } from "@/components/VoiceSimulatorModal";
import { cn } from "@/lib/utils";

interface CallLog {
  id: string;
  callId: string;
  callerPhone: string;
  transcript: string | null;
  summary: string;
  intent: string;
  durationSeconds?: number;
  timestamp: string;
}

export default function CallLogsPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [intentFilter, setIntentFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (intentFilter !== "ALL") params.append("intent", intentFilter);
      if (searchQuery.trim()) params.append("query", searchQuery.trim());

      const res = await fetch(`/api/lab/calls?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCalls(data.calls);
        if (data.calls.length > 0 && !selectedCall) {
          setSelectedCall(data.calls[0]);
        }
      }
    } catch (err) {
      console.error("Fetch calls error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [intentFilter, searchQuery]);

  const intents = ["ALL", "BOOKING", "PREP_QUERY", "RESCHEDULE", "OTHER"];

  // Helper to parse transcript lines
  const parseTranscript = (raw?: string | null) => {
    if (!raw) return [];
    return raw.split("\n").filter((l) => l.trim().length > 0);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Navbar onOpenSimulator={() => setIsSimulatorOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Voice Agent Call Transcripts
              </h1>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200">
                {calls.length} Handled Calls
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Live recordings, transcripts, detected caller intents, and AI summaries from Vapi and Retell voice sessions.
            </p>
          </div>

          <button
            onClick={fetchCalls}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh Logs</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          {/* Intent Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {intents.map((intent) => (
              <button
                key={intent}
                onClick={() => setIntentFilter(intent)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  intentFilter === intent
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                {intent}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search phone, summary, or transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none shadow-xs"
            />
          </div>
        </div>

        {/* Two-Column Layout: Call List (Left) and Detailed Transcript (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Call List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {calls.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                <PhoneCall className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No calls recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Use the Voice Simulator or trigger outbound prep reminders to generate call logs.
                </p>
              </div>
            ) : (
              calls.map((call) => {
                const isSelected = selectedCall?.id === call.id;
                const formattedTime = new Date(call.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const formattedDate = new Date(call.timestamp).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={cn(
                      "rounded-2xl border p-4 cursor-pointer transition-all bg-white hover:border-brand-300 hover:shadow-sm",
                      isSelected
                        ? "border-brand-500 ring-2 ring-brand-500/20 shadow-xs"
                        : "border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 font-bold text-[10px]",
                            call.intent === "BOOKING" && "bg-blue-100 text-blue-800",
                            call.intent === "PREP_QUERY" && "bg-amber-100 text-amber-800",
                            call.intent === "RESCHEDULE" && "bg-purple-100 text-purple-800",
                            call.intent === "OTHER" && "bg-slate-100 text-slate-700"
                          )}
                        >
                          {call.intent}
                        </span>
                        <span className="font-mono text-slate-400 text-[10px]">
                          {call.callId.slice(-10)}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        {formattedDate}, {formattedTime}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>{call.callerPhone}</span>
                      <span className="text-xs font-medium text-slate-400">
                        {call.durationSeconds}s duration
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {call.summary}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Transcript & AI Summary Panel (7 cols) */}
          <div className="lg:col-span-7">
            {selectedCall ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sticky top-24">
                {/* Panel Header */}
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{selectedCall.callId}</span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-bold text-[10px]",
                          selectedCall.intent === "BOOKING" && "bg-blue-100 text-blue-800",
                          selectedCall.intent === "PREP_QUERY" && "bg-amber-100 text-amber-800",
                          selectedCall.intent === "RESCHEDULE" && "bg-purple-100 text-purple-800",
                          selectedCall.intent === "OTHER" && "bg-slate-100 text-slate-700"
                        )}
                      >
                        {selectedCall.intent}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {selectedCall.callerPhone}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {selectedCall.durationSeconds} seconds
                    </span>
                    <span>•</span>
                    <span>{new Date(selectedCall.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* AI Executive Summary Box */}
                <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-900 mb-1">
                    <Sparkles className="h-4 w-4 text-brand-600" />
                    <span>AI Call Summary</span>
                  </div>
                  <p className="text-xs text-brand-950 leading-relaxed font-medium">
                    {selectedCall.summary}
                  </p>
                </div>

                {/* Full Conversation Bubble Transcript */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Full Audio Transcript
                  </h4>

                  <div className="max-h-[460px] overflow-y-auto space-y-3.5 pr-2">
                    {parseTranscript(selectedCall.transcript).map((line, idx) => {
                      const isAi = line.toLowerCase().startsWith("ai") || line.toLowerCase().startsWith("ananya");
                      const cleanText = line.replace(/^(AI \(Ananya\):|Patient:)/i, "").trim();

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex flex-col max-w-[90%]",
                            isAi ? "mr-auto items-start" : "ml-auto items-end"
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-semibold">
                            {isAi ? (
                              <>
                                <Bot className="h-3.5 w-3.5 text-brand-600" />
                                <span className="text-brand-700">Ananya (AI Voice)</span>
                              </>
                            ) : (
                              <>
                                <span className="text-slate-600">Patient</span>
                                <User className="h-3.5 w-3.5 text-slate-500" />
                              </>
                            )}
                          </div>

                          <div
                            className={cn(
                              "p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs",
                              isAi
                                ? "bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200"
                                : "bg-brand-600 text-white rounded-tr-xs"
                            )}
                          >
                            {cleanText || line}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">Select a call to view transcript</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Simulator Modal */}
      <VoiceSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onDataUpdated={fetchCalls}
      />
    </div>
  );
}
