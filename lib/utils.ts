import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateFastingCutoff(timeSlot: string, fastingHours: number): string {
  if (!fastingHours || fastingHours <= 0) return "No fasting required";

  // Parse timeSlot e.g. "08:30 AM" or "08:00 AM"
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return `${fastingHours} hours prior to slot`;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3].toUpperCase();

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  // Subtract fastingHours
  let cutoffHour = hours - fastingHours;
  let dayOffset = 0;
  while (cutoffHour < 0) {
    cutoffHour += 24;
    dayOffset += 1;
  }

  const cutoffMod = cutoffHour >= 12 ? "PM" : "AM";
  const displayHour = cutoffHour % 12 === 0 ? 12 : cutoffHour % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");

  const timeStr = `${displayHour}:${displayMinutes} ${cutoffMod}`;
  if (dayOffset === 1) {
    return `${timeStr} (Previous Evening)`;
  }
  return timeStr;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
