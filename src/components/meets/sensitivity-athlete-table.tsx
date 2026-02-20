"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatSecondsToTime } from "@/lib/utils";

export type SensResult = {
  athleteId: string;
  teamTotalBetter: number;
  teamTotalWorse: number;
  athletePtsBaseline: number;
  athletePtsBetter: number;
  athletePtsWorse: number;
  timeBaselineSec?: number | null;
  timeBetterSec?: number | null;
  timeWorseSec?: number | null;
  isRepresentativeDiving?: boolean;
};

export type EventRow = {
  eventName: string;
  eventType: string;
  timeSec: number | null;
  points: number;
};

export type EventBreakdown = {
  better: EventRow[];
  baseline: EventRow[];
  worse: EventRow[];
};

type Scenario = "better" | "baseline" | "worse";

interface SensitivityAthleteTableProps {
  athleteName: string;
  sensPct: number;
  baseline: number;
  result: SensResult;
  eventBreakdown: EventBreakdown;
}

export function SensitivityAthleteTable({
  athleteName: _athleteName,
  sensPct,
  baseline,
  result,
  eventBreakdown,
}: SensitivityAthleteTableProps) {
  const [expanded, setExpanded] = useState<Scenario | null>(null);

  const toggle = (scenario: Scenario) => {
    setExpanded((prev) => (prev === scenario ? null : scenario));
  };

  const rows: { scenario: Scenario; label: string; timeSec: number | null; points: number; teamTotal: number }[] = [
    {
      scenario: "better",
      label: `Better (${sensPct}%)`,
      timeSec: result.timeBetterSec ?? null,
      points: result.athletePtsBetter,
      teamTotal: result.teamTotalBetter,
    },
    {
      scenario: "baseline",
      label: "Baseline",
      timeSec: result.timeBaselineSec ?? null,
      points: result.athletePtsBaseline,
      teamTotal: baseline,
    },
    {
      scenario: "worse",
      label: `Worse (${sensPct}%)`,
      timeSec: result.timeWorseSec ?? null,
      points: result.athletePtsWorse,
      teamTotal: result.teamTotalWorse,
    },
  ];

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-sm border-collapse analysis-table">
        <colgroup>
          <col className="min-w-[8rem]" />
          <col className="min-w-[5rem]" />
          <col className="w-[7rem]" />
          <col className="w-[6rem]" />
        </colgroup>
        <thead>
          <tr className="border-b bg-slate-50 font-medium text-slate-700">
            <th className="text-left py-1.5 pr-3 pl-3">Scenario</th>
            <th className="text-right py-1.5 pr-3">Time</th>
            <th className="text-right py-1.5 pr-3 w-[7rem]">Individual Points</th>
            <th className="text-right py-1.5 pr-3 w-[6rem]">Team Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expanded === row.scenario;
            const events = eventBreakdown[row.scenario];
            return (
              <React.Fragment key={row.scenario}>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 pl-3">
                    <button
                      type="button"
                      onClick={() => toggle(row.scenario)}
                      aria-expanded={isExpanded}
                      className="flex items-center gap-1 text-left hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      )}
                      {row.label}
                    </button>
                  </td>
                  <td className="text-right py-1.5 pr-3 font-mono tabular-nums">
                    {row.timeSec != null
                      ? formatSecondsToTime(row.timeSec, result.isRepresentativeDiving ?? false)
                      : "—"}
                  </td>
                  <td className="text-right py-1.5 pr-3 w-[7rem]">{row.points.toFixed(1)}</td>
                  <td className="text-right py-1.5 pr-3 w-[6rem]">{row.teamTotal.toFixed(1)}</td>
                </tr>
                {isExpanded && events.length > 0 && (
                  <>
                    {events.map((ev, i) => (
                      <tr key={`${row.scenario}-${i}-${ev.eventName}`} className="border-b border-slate-100 bg-slate-50/50">
                        <td className="py-1.5 pr-3 pl-8 text-slate-700">{ev.eventName}</td>
                        <td className="text-right py-1.5 pr-3 font-mono tabular-nums text-slate-700">
                          {ev.timeSec != null
                            ? formatSecondsToTime(ev.timeSec, ev.eventType === "diving")
                            : "—"}
                        </td>
                        <td className={`text-right py-1.5 pr-3 w-[7rem] ${ev.points > 0 ? "font-medium text-green-600" : "text-slate-700"}`}>
                          {ev.points > 0 ? ev.points.toFixed(1) : "—"}
                        </td>
                        <td className="py-1.5 pr-3 w-[6rem]" />
                      </tr>
                    ))}
                    <tr className="border-t border-slate-100 bg-slate-50/50 font-medium text-slate-900">
                      <td className="py-1.5 pr-3 pl-8">Subtotal</td>
                      <td className="text-right py-1.5 pr-3" />
                      <td className="text-right py-1.5 pr-3 w-[7rem]">{row.points.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 w-[6rem]" />
                    </tr>
                  </>
                )}
                {isExpanded && events.length === 0 && (
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <td colSpan={4} className="py-1.5 pr-3 pl-8 text-slate-500 text-sm">
                      No events
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
