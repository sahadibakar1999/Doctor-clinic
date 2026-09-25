"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Phone,
  PhoneCall,
  Search,
  Filter,
  Plus,
  Mic,
  AlertTriangle,
  CheckCircle2,
  Check,
  ChevronDown,
  RefreshCw,
  FlaskConical,
  XCircle,
  FileText,
  User,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatCards } from "@/components/StatCards";
import { VoiceSimulatorModal } from "@/components/VoiceSimulatorModal";
import { OutboundCallModal } from "@/components/OutboundCallModal";
import { NewAppointmentModal } from "@/components/NewAppointmentModal";
import { formatCurrencyINR, calculateFastingCutoff, cn } from "@/lib/utils";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  timeSlot: string;
  date: string;
  status: string;
  fastingAcknowledged: boolean;
  notes?: string;
  test: {
    id: string;
    name: string;
    category: string;
    price: number;
    fastingRequired: boolean;
    fastingHours: number;
    prepInstructions: string;
    sampleType: string;
  };
}

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    fastingPendingAck: 0,
    callsToday: 0,
    totalCalls: 0,
    noShowRiskRate: "0%",
    noShowRiskLevel: "Low Risk",
  });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("all"); // "all", "today", "tomorrow"
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fastingFilter, setFastingFilter] = useState("all"); // "all", "pending", "acknowledged"
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [selectedCallAppointment, setSelectedCallAppointment] = useState<Appointment | null>(null);
  const [batchReminderLoading, setBatchReminderLoading] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Stats
      const statsRes = await fetch("/api/lab/stats");
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Appointments
      const params = new URLSearchParams();
      if (dateFilter !== "all") params.append("date", dateFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (fastingFilter !== "all") params.append("fasting", fastingFilter);
      if (searchQuery.trim()) params.append("query", searchQuery.trim());

      const appRes = await fetch(`/api/lab/appointments?${params.toString()}`);
      const appData = await appRes.json();
      if (appData.success) {
        setAppointments(appData.appointments);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter, fastingFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick toggle fasting acknowledgment
  const handleToggleFasting = async (appointment: Appointment) => {
    const updatedStatus = !appointment.fastingAcknowledged;
    try {
      await fetch(`/api/lab/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fastingAcknowledged: updatedStatus,
        }),
      });
      fetchData();
    } catch (err) {
      console.error("Fasting toggle error:", err);
    }
  };

  // Change Appointment Status
  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      await fetch(`/api/lab/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  // Batch Trigger Outbound Prep Calls for Tomorrow
  const handleTriggerBatchReminders = async () => {
    setBatchReminderLoading(true);
    setBannerAlert(null);
    try {
      const res = await fetch("/api/lab/reminders/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "tomorrow", markAcknowledged: true }),
      });
      const data = await res.json();
      if (data.success) {
        setBannerAlert(data.message);
        fetchData();
      }
    } catch (err: any) {
      console.error("Batch reminder error:", err);
    } finally {
      setBatchReminderLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Navigation */}
      <Navbar
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        pendingFastingCount={stats.fastingPendingAck}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Banner Alert if triggered */}
        {bannerAlert && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{bannerAlert}</span>
            </div>
            <button
              onClick={() => setBannerAlert(null)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Front-Desk AI Operations
              </h1>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200">
                Live Slot & Fasting Hub
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Real-time diagnostic scheduling, AI voice call handling, and automated fasting protocol reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Batch reminder button */}
            <button
              onClick={handleTriggerBatchReminders}
              disabled={batchReminderLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
              title="Dispatches voice reminders with fasting instructions for all tomorrow's bookings"
            >
              <PhoneCall className={cn("h-4 w-4", batchReminderLoading && "animate-spin")} />
              <span>
                {batchReminderLoading ? "Dispatching AI Calls..." : "Dispatch Tomorrow's Prep Calls"}
              </span>
            </button>

            {/* New Appointment button */}
            <button
              onClick={() => setIsNewAppointmentOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>New Booking</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchData}
              title="Refresh Data"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* 1. Stat Cards */}
        <StatCards
          stats={stats}
          onFilterFastingPending={() => {
            setFastingFilter("pending");
            setDateFilter("all");
          }}
          onTriggerOutboundBatch={handleTriggerBatchReminders}
        />

        {/* Live Simulator Spotlight Card */}
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/30 px-2.5 py-0.5 text-xs font-semibold text-brand-200 backdrop-blur-sm border border-brand-400/30">
                <Sparkles className="h-3.5 w-3.5 text-brand-300" />
                <span>Interactive Voice Experience</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold">
                Test "Ananya" Inbound & Outbound AI Receptionist
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Experience how callers check fasting requirements (e.g. "Can I drink tea before FBS?"), query slot availability, and book appointments via voice with direct SQLite function execution.
              </p>
            </div>
            <button
              onClick={() => setIsSimulatorOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-brand-900 hover:bg-brand-50 active:scale-95 shadow-lg transition-all"
            >
              <Mic className="h-4 w-4 text-brand-600 animate-pulse" />
              <span>Launch Voice Simulator</span>
            </button>
          </div>
          {/* subtle background glow */}
          <div className="absolute -right-12 -bottom-12 h-44 w-44 rounded-full bg-brand-500/20 blur-2xl pointer-events-none"></div>
        </div>

        {/* 2. Filters & Search Toolbar */}
        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Date Filter Tabs */}
          <div className="flex items-center rounded-xl bg-slate-200/80 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setDateFilter("all")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                dateFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              )}
            >
              All Dates
            </button>
            <button
              onClick={() => setDateFilter("today")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                dateFilter === "today" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              )}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter("tomorrow")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                dateFilter === "tomorrow" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              )}
            >
              Tomorrow
            </button>
          </div>

          {/* Search & Fasting Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Fasting Filter Dropdown */}
            <select
              value={fastingFilter}
              onChange={(e) => setFastingFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="all">All Fasting Statuses</option>
              <option value="pending">⚠️ Fasting Pending Ack</option>
              <option value="acknowledged">✅ Fasting Acknowledged</option>
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="REMINDER_SENT">REMINDER_SENT</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="NO_SHOW">NO_SHOW</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, phone, test..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* 3. Appointment Management Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Time & Date
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Patient Details
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Diagnostic Test
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Fasting Protocol Warning
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-medium text-slate-600">No appointments found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Try modifying your filters or use the Voice Simulator to book a slot.
                      </p>
                    </td>
                  </tr>
                ) : (
                  appointments.map((app) => {
                    const test = app.test;
                    const formattedDate = new Date(app.date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    });
                    const cutoff = calculateFastingCutoff(app.timeSlot, test?.fastingHours || 0);

                    return (
                      <tr
                        key={app.id}
                        className={cn(
                          "hover:bg-slate-50/70 transition-colors",
                          test?.fastingRequired && !app.fastingAcknowledged
                            ? "bg-amber-50/20"
                            : ""
                        )}
                      >
                        {/* Time & Date */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-brand-600 shrink-0" />
                            <div>
                              <div className="font-bold text-slate-900">{app.timeSlot}</div>
                              <div className="text-xs text-slate-400">{formattedDate}</div>
                            </div>
                          </div>
                        </td>

                        {/* Patient Details */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-semibold text-slate-900">{app.patientName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{app.patientPhone}</span>
                          </div>
                        </td>

                        {/* Diagnostic Test */}
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{test?.name}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-medium text-slate-700">
                              {formatCurrencyINR(test?.price || 0)}
                            </span>
                            <span>•</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {test?.sampleType}
                            </span>
                          </div>
                        </td>

                        {/* Fasting Warning Badge */}
                        <td className="px-5 py-4">
                          {test?.fastingRequired ? (
                            <div className="space-y-1.5">
                              {app.fastingAcknowledged ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Fasting Acknowledged</span>
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-300 animate-pulse">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                    <span>{test.fastingHours}h Fasting Required</span>
                                  </span>
                                  <div className="text-[11px] font-medium text-amber-800">
                                    Stop food by: <strong>{cutoff}</strong>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              No fasting needed
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.id, e.target.value)}
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-semibold border focus:outline-none cursor-pointer",
                              app.status === "CONFIRMED" && "bg-blue-50 text-blue-800 border-blue-200",
                              app.status === "REMINDER_SENT" && "bg-purple-50 text-purple-800 border-purple-200",
                              app.status === "COMPLETED" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                              app.status === "NO_SHOW" && "bg-rose-50 text-rose-800 border-rose-200",
                              app.status === "CANCELLED" && "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="REMINDER_SENT">REMINDER_SENT</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="NO_SHOW">NO_SHOW</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Fasting Quick Acknowledge Checkbox/Toggle */}
                            {test?.fastingRequired && (
                              <button
                                onClick={() => handleToggleFasting(app)}
                                title={
                                  app.fastingAcknowledged
                                    ? "Mark Fasting Pending"
                                    : "Quick Acknowledge Fasting"
                                }
                                className={cn(
                                  "p-1.5 rounded-lg border text-xs transition-colors",
                                  app.fastingAcknowledged
                                    ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                    : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                )}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}

                            {/* One-click Trigger Outbound Prep Call Button */}
                            <button
                              onClick={() => setSelectedCallAppointment(app)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/70 border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition-all shadow-xs"
                              title="Trigger Ananya Outbound Prep Reminder Voice Call"
                            >
                              <PhoneCall className="h-3.5 w-3.5 text-brand-600" />
                              <span className="hidden sm:inline">Trigger Outbound Prep Call</span>
                              <span className="sm:hidden">Call</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Voice Agent Simulator Modal */}
      <VoiceSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onDataUpdated={fetchData}
      />

      {/* Outbound Voice Call Dispatch Modal */}
      <OutboundCallModal
        isOpen={!!selectedCallAppointment}
        appointment={selectedCallAppointment}
        onClose={() => setSelectedCallAppointment(null)}
        onCallCompleted={() => {
          setSelectedCallAppointment(null);
          fetchData();
        }}
      />

      {/* New Appointment Modal */}
      <NewAppointmentModal
        isOpen={isNewAppointmentOpen}
        onClose={() => setIsNewAppointmentOpen(false)}
        onCreated={fetchData}
      />
    </div>
  );
}
