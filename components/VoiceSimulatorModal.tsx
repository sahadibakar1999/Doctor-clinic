"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Code,
  Terminal,
  Activity,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SimulatorMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    args: any;
    result: any;
  };
  fastingNote?: string;
}

interface VoiceSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated?: () => void;
}

const SAMPLE_PROMPTS = [
  "I need to check price and prep for a Lipid Profile test",
  "Can I drink tea or milk before Fasting Blood Sugar (FBS)?",
  "What slots are available tomorrow morning?",
  "Book Lipid Profile for Vikram Malhotra tomorrow at 08:00 AM",
  "Confirm fasting readiness for Vikram Malhotra",
  "What is the prep instruction for Ultrasound Whole Abdomen?",
];

export function VoiceSimulatorModal({ isOpen, onClose, onDataUpdated }: VoiceSimulatorModalProps) {
  const [messages, setMessages] = useState<SimulatorMessage[]>([
    {
      id: "initial",
      sender: "ai",
      text: "Namaste! I am Ananya, your medical receptionist at Apex Diagnostic Centre. How may I assist you with lab test inquiries or slot bookings today?",
      timestamp: "Just now",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<any>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition if supported in browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-IN";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputText(transcript);
            handleSendMessage(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition error:", e);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Speech synthesis for Ananya Voice
  const speakText = (text: string) => {
    if (!audioEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.05; // Slightly warmer pitch for Ananya

      // Find female or Indian English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.includes("en-IN") || v.name.includes("India")) ||
        voices.find((v) => v.name.includes("Female") || v.name.includes("Google UK English Female")) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Microphone voice recognition is not supported in this browser. You can type in the chat input below!");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch (err) {
        console.error("Mic start error:", err);
        setIsListening(false);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    setInputText("");

    // Add user message to state
    const userMsg: SimulatorMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/voice/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-4),
        }),
      });

      const data = await res.json();

      if (data.success) {
        const aiMsg: SimulatorMessage = {
          id: `ai_${Date.now()}`,
          sender: "ai",
          text: data.aiResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          toolCall: data.toolCalled
            ? {
                name: data.toolCalled,
                args: data.toolArgs,
                result: data.toolResult?.data || data.toolResult,
              }
            : undefined,
        };

        if (data.toolCalled) {
          setActiveTool({
            name: data.toolCalled,
            args: data.toolArgs,
            result: data.toolResult?.data || data.toolResult,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        setMessages((prev) => [...prev, aiMsg]);
        speakText(data.aiResponse);

        // Notify parent if booking or fasting updated
        if (
          data.toolCalled === "book_lab_appointment" ||
          data.toolCalled === "confirm_fasting_readiness"
        ) {
          onDataUpdated?.();
        }
      } else {
        const errMsg: SimulatorMessage = {
          id: `err_${Date.now()}`,
          sender: "ai",
          text: "I encountered an error processing that request. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (err: any) {
      console.error("Simulation error:", err);
      const errMsg: SimulatorMessage = {
        id: `err_${Date.now()}`,
        sender: "ai",
        text: "Could not connect to the voice engine. Please check system status.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col h-[90vh] max-h-[820px] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-clinic-teal text-white shadow-md shadow-brand-500/20">
              <Bot className="h-6 w-6" />
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Ananya — Voice Agent Simulator</h3>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                  Apex Diagnostic Inbound AI
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Testing Vapi / Retell Tool Calling & Fasting Safeguards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                if (isSpeaking) window.speechSynthesis?.cancel();
                setAudioEnabled(!audioEnabled);
              }}
              title={audioEnabled ? "Mute Voice Speech" : "Enable Voice Speech"}
              className={cn(
                "p-2 rounded-xl border text-sm transition-colors",
                audioEnabled
                  ? "bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
              )}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Split View (Chat on left, Live Tool Inspector on right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left: Chat & Voice Flow (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full border-r border-slate-200 overflow-hidden bg-slate-50/30">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[88%]",
                    msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {msg.sender === "user" ? (
                      <>
                        <span className="text-[11px] font-medium text-slate-400">Caller (Patient)</span>
                        <User className="h-3 w-3 text-slate-400" />
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3 text-brand-600" />
                        <span className="text-[11px] font-semibold text-brand-700">Ananya (AI Receptionist)</span>
                      </>
                    )}
                    <span className="text-[10px] text-slate-400">· {msg.timestamp}</span>
                  </div>

                  <div
                    className={cn(
                      "p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.sender === "user"
                        ? "bg-brand-600 text-white rounded-tr-xs"
                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs"
                    )}
                  >
                    {msg.text}
                  </div>

                  {/* Tool Call pill if triggered */}
                  {msg.toolCall && (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                      <Terminal className="h-3 w-3 text-emerald-600" />
                      <span>Tool Executed:</span>
                      <code className="font-mono font-semibold">{msg.toolCall.name}()</code>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 p-3 text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl max-w-xs">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce"></span>
                    <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span>Ananya is verifying clinic database...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Test Prompt Pills */}
            <div className="border-t border-slate-200/70 bg-white/70 px-4 py-2.5 overflow-x-auto">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5">
                <Sparkles className="h-3 w-3 text-brand-500" />
                <span>Test Fasting & Booking Scenarios:</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {SAMPLE_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 transition-colors shadow-xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar with Mic button */}
            <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* Mic Speech Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl transition-all shadow-sm",
                    isListening
                      ? "bg-rose-500 text-white animate-pulse ring-4 ring-rose-200"
                      : "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-600"
                  )}
                  title={isListening ? "Listening... click to stop" : "Speak to Voice Agent"}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isListening
                      ? "Listening to your voice..."
                      : "Type a message as a patient (e.g. 'Can I drink tea before FBS?')..."
                  }
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-600/20 transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Microphone status: {speechSupported ? "Supported (en-IN)" : "Text Mode fallback"}</span>
                <span>Ananya replies with max 2 concise sentences</span>
              </div>
            </div>
          </div>

          {/* Right: Real-Time Tool Inspector & Fasting Rules (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-slate-900 text-slate-100 p-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-brand-400" />
                <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
                  Tool Function Inspector
                </h4>
              </div>
              <span className="text-[10px] font-mono rounded bg-slate-800 px-2 py-0.5 text-brand-300">
                Vapi / Retell Engine
              </span>
            </div>

            {/* Active Tool State */}
            {activeTool ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Function Triggered: <code className="font-mono text-white">{activeTool.name}</code>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300/80">{activeTool.timestamp}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    Executed cleanly in SQLite & returns structured payload to speech model.
                  </p>
                </div>

                {/* Function Arguments JSON */}
                <div>
                  <span className="text-xs font-mono text-slate-400">INPUT PARAMETERS:</span>
                  <pre className="mt-1 rounded-xl bg-slate-950 p-3 text-xs font-mono text-brand-300 overflow-x-auto border border-slate-800">
                    {JSON.stringify(activeTool.args, null, 2)}
                  </pre>
                </div>

                {/* Database Execution Result */}
                <div>
                  <span className="text-xs font-mono text-slate-400">DATABASE EXECUTION OUTPUT:</span>
                  <pre className="mt-1 rounded-xl bg-slate-950 p-3 text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800 max-h-56">
                    {JSON.stringify(activeTool.result, null, 2)}
                  </pre>
                </div>

                {/* Fasting Safeguard Rule Display */}
                {activeTool.result?.fastingRequired && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-400 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Fasting Safeguard Activated:</span>
                    </div>
                    <p className="text-amber-200">
                      Requires <strong>{activeTool.result.fastingHours} hours</strong> of strict overnight fasting.
                      {activeTool.result.fastingCutoff && (
                        <span> Cutoff: <strong>{activeTool.result.fastingCutoff}</strong></span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Terminal className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-sm font-medium text-slate-400">No Tool Call Triggered Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Ask Ananya about test prep, available slots, or request a booking to see live JSON tool arguments and DB executions.
                </p>
              </div>
            )}

            {/* Quick Webhook Endpoint Specs */}
            <div className="mt-auto pt-4 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span>Webhook URL:</span>
                <span className="font-mono text-brand-400">/api/voice/webhook</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Registered tools: check_test_prep, get_available_slots, book_lab_appointment, confirm_fasting_readiness
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
