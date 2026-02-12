"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Users, ListChecks, UsersRound, LayoutDashboard } from "lucide-react";

export type MeetSetupStep = "roster" | "lineups" | "relays";

interface MeetSetupNavProps {
  meetId: string;
  currentStep: MeetSetupStep;
  meetName?: string;
}

const steps: { step: MeetSetupStep; label: string; href: (id: string) => string; icon: React.ComponentType<{ className?: string }> }[] = [
  { step: "roster", label: "Set Rosters", href: (id) => `/meets/${id}/roster`, icon: Users },
  { step: "lineups", label: "Set Lineups", href: (id) => `/meets/${id}/lineups`, icon: ListChecks },
  { step: "relays", label: "Create Relays", href: (id) => `/meets/${id}/relays`, icon: UsersRound },
];

export function MeetSetupNav({ meetId, currentStep, meetName }: MeetSetupNavProps) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1.5"
      aria-label="Meet setup"
    >
      {steps.map(({ step, label, href, icon: Icon }) => {
        const isActive = currentStep === step;
        return (
          <Link
            key={step}
            href={href(meetId)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
      <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
      <Link
        href={`/meets/${meetId}`}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Meet dashboard
      </Link>
    </nav>
  );
}
