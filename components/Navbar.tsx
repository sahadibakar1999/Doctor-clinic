"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Calendar,
  FlaskConical,
  PhoneCall,
  Mic,
  Bot,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onOpenSimulator?: () => void;
  pendingFastingCount?: number;
}

export function Navbar({ onOpenSimulator, pendingFastingCount = 0 }: NavbarProps) {
  const pathname = usePathname();

  const navLinks = [
    {
      name: "Dashboard",
      href: "/",
      icon: Calendar,
      badge: pendingFastingCount > 0 ? `${pendingFastingCount} Fasting Alerts` : undefined,
    },
    {
      name: "Lab Catalog",
      href: "/tests",
      icon: FlaskConical,
    },
    {
      name: "Call Transcripts",
      href: "/calls",
      icon: PhoneCall,
    },
    {
      name: "Voice Agent Setup",
      href: "/voice-agent",
      icon: Bot,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-clinic-teal text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Aura<span className="text-brand-600">Lab</span>
                </span>
                <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-700/10">
                  Voice AI
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">Diagnostic Clinic Management</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                    isActive
                      ? "bg-brand-50 text-brand-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-brand-600" : "text-slate-500")} />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 animate-pulse">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Agent Status Badge */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Agent "Ananya" Active</span>
          </div>

          {/* Live Voice Simulator Trigger */}
          {onOpenSimulator && (
            <button
              onClick={onOpenSimulator}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand-600/25 hover:from-brand-700 hover:to-brand-800 active:scale-95 transition-all"
            >
              <Mic className="h-4 w-4 animate-pulse" />
              <span className="hidden sm:inline">Voice Agent Simulator</span>
              <span className="sm:hidden">Simulator</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
