"use client";

import { Calendar, AlertTriangle, PhoneForwarded, ShieldAlert, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsData {
  todayAppointments: number;
  fastingPendingAck: number;
  callsToday: number;
  totalCalls: number;
  noShowRiskRate: string;
  noShowRiskLevel: string;
  totalTestsCount?: number;
}

interface StatCardsProps {
  stats: StatsData;
  onFilterFastingPending?: () => void;
  onTriggerOutboundBatch?: () => void;
}

export function StatCards({ stats, onFilterFastingPending, onTriggerOutboundBatch }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Today's Appointments */}
      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Today's Appointments
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {stats.todayAppointments}
          </span>
          <span className="text-xs font-medium text-slate-500">slots scheduled</span>
        </div>
        <div className="mt-3 flex items-center text-xs text-emerald-600 font-medium">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Real-time slot manager active
        </div>
      </div>

      {/* 2. Fasting Pending Ack (High Priority Alert Card) */}
      <div
        onClick={onFilterFastingPending}
        className={cn(
          "relative overflow-hidden rounded-2xl p-5 shadow-sm border transition-all cursor-pointer group",
          stats.fastingPendingAck > 0
            ? "bg-gradient-to-br from-amber-50/90 via-amber-50/40 to-white border-amber-300 ring-1 ring-amber-400/30 hover:border-amber-400"
            : "bg-white border-slate-200/80"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Fasting Pending Ack
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 group-hover:scale-110 transition-transform">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-amber-950">
            {stats.fastingPendingAck}
          </span>
          <span className="text-xs font-semibold text-amber-700">patients unverified</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-amber-800 font-medium">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
            Requires protocol verification
          </span>
          <span className="underline group-hover:text-amber-900 font-semibold flex items-center">
            Filter <ArrowUpRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>
      </div>

      {/* 3. Calls Handled by AI Today */}
      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Calls Handled by AI
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinic-teal/10 text-clinic-teal">
            <PhoneForwarded className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {stats.callsToday}
          </span>
          <span className="text-xs font-medium text-slate-500">calls today</span>
        </div>
        <div className="mt-3 flex items-center text-xs text-slate-600 font-medium">
          <span className="text-brand-600 font-semibold mr-1">{stats.totalCalls} total</span>
          front-desk calls automated
        </div>
      </div>

      {/* 4. No-Show Risk Metric */}
      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            No-Show Risk Rate
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-rose-700">
            {stats.noShowRiskRate}
          </span>
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
            {stats.noShowRiskLevel}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">Fast-prep breach prevention</p>
          {onTriggerOutboundBatch && (
            <button
              onClick={onTriggerOutboundBatch}
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 underline"
            >
              Trigger Calls
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
