"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { formatCurrencyINR, getTomorrowDateString } from "@/lib/utils";

interface LabTest {
  id: string;
  name: string;
  category: string;
  price: number;
  fastingRequired: boolean;
  fastingHours: number;
  prepInstructions: string;
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const TIME_SLOTS = [
  "07:30 AM",
  "08:00 AM",
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
];

export function NewAppointmentModal({ isOpen, onClose, onCreated }: NewAppointmentModalProps) {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("+91 ");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [date, setDate] = useState(getTomorrowDateString());
  const [timeSlot, setTimeSlot] = useState("08:00 AM");
  const [notes, setNotes] = useState("");
  const [fastingAcknowledged, setFastingAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetch("/api/lab/tests")
        .then((res) => res.json())
        .then((data) => {
          if (data.tests) {
            setTests(data.tests);
            if (!selectedTestId && data.tests.length > 0) {
              setSelectedTestId(data.tests[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedTest = tests.find((t) => t.id === selectedTestId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !selectedTestId || !date || !timeSlot) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/lab/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone,
          testId: selectedTestId,
          date,
          timeSlot,
          notes,
          fastingAcknowledged,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onCreated();
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to schedule appointment.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New Lab Appointment</h3>
              <p className="text-xs text-slate-500">Manual Front-Desk Entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Patient Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Patient Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Patient Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Patient Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+91 98201 00000"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Select Lab Test */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Diagnostic Test *
            </label>
            <div className="relative">
              <FlaskConical className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatCurrencyINR(t.price)}
                    {t.fastingRequired ? ` (${t.fastingHours}h fasting)` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fasting Warning Notice */}
          {selectedTest && selectedTest.fastingRequired && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Critical Fasting Protocol ({selectedTest.fastingHours} Hours):</span>
              </div>
              <p className="mt-1 text-slate-700">{selectedTest.prepInstructions}</p>
              <label className="mt-2 flex items-center gap-2 cursor-pointer font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={fastingAcknowledged}
                  onChange={(e) => setFastingAcknowledged(e.target.checked)}
                  className="rounded border-amber-400 text-brand-600 focus:ring-brand-500"
                />
                <span>Patient verified & acknowledged fasting guidelines</span>
              </label>
            </div>
          )}

          {/* Date & Time Slot */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot *</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clinical Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Needs wheelchair assistance, water bottle reminder"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
