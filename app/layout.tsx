import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraLab — Diagnostic Lab & Clinic Voice Management System",
  description:
    "End-to-End Voice AI Management for Diagnostic Labs & Clinics. Solves front-desk call overload, prevents broken fasting protocols, and automates patient slot booking with Vapi & Retell AI integration.",
  keywords: [
    "AuraLab",
    "Diagnostic Lab",
    "Voice AI",
    "Medical Receptionist",
    "Fasting Protocols",
    "Vapi",
    "Retell AI",
    "Lab Booking",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
