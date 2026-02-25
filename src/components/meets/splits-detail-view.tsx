"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeTimeFormat, formatSwimmerDisplayName, parseTimeToSeconds, formatSecondsToTime } from "@/lib/utils";
import { getRelayConfig, getRelayDistanceLabels, getSegmentsPerLeg, RELAY_NUM_LEGS } from "@/lib/relay-utils";

/** If values look like cumulative (monotonically increasing), return { subs, cumLeg } derived from them; else return null. */
function normalizeLegFromCumulative(
  rawSubs: string[],
  rawCumLeg: string[]
): { subs: string[]; cumLeg: string[] } | null {
  if (rawSubs.length === 0) return null;
  const secs = rawSubs.map((s) => parseTimeToSeconds(s));
  if (secs.some((s) => !Number.isFinite(s))) return null;
  let strictlyIncreasing = true;
  for (let i = 1; i < secs.length; i++) {
    if (secs[i]! <= secs[i - 1]!) {
      strictlyIncreasing = false;
      break;
    }
  }
  if (!strictlyIncreasing) return null;
  const lastSec = secs[secs.length - 1]!;
  if (lastSec < 60) return null;
  const derivedSubs: string[] = [];
  let prev = 0;
  for (let i = 0; i < secs.length; i++) {
    const c = secs[i]!;
    derivedSubs.push(c - prev < 60 ? (c - prev).toFixed(2) : formatSecondsToTime(c - prev));
    prev = c;
  }
  const derivedCum: string[] = [];
  let cum = 0;
  for (const s of derivedSubs) {
    const sec = parseTimeToSeconds(s);
    if (Number.isFinite(sec)) {
      cum += sec;
      derivedCum.push(cum < 60 ? cum.toFixed(2) : formatSecondsToTime(cum));
    }
  }
  return { subs: derivedSubs, cumLeg: derivedCum };
}

export type IndividualSplitsData = {
  reactionTimeSeconds: number | null;
  cumulativeSplits: string[];
  subSplits: string[];
};

export type RelayLegData = {
  reactionTimeSeconds: number | null;
  name: string;
  cumulativeLeg: string[];
  subSplits?: string[];
};

export type RelaySplitsData = {
  legs: RelayLegData[];
  relayCumulativeAt50: string[];
};

function formatReaction(seconds: number | null): string {
  if (seconds == null) return "—";
  const sign = seconds >= 0 ? "+" : "−";
  return `${sign}${Math.abs(seconds).toFixed(2)}`;
}

interface IndividualSplitsTableProps {
  data: IndividualSplitsData;
  compact?: boolean;
}

export function IndividualSplitsTable({ data, compact }: IndividualSplitsTableProps) {
  let { reactionTimeSeconds, cumulativeSplits, subSplits } = data;
  // If the first "split" is actually the reaction time (common parse bug), drop it so we don't show it as 50m
  if (
    reactionTimeSeconds != null &&
    cumulativeSplits.length > 0 &&
    subSplits.length > 0
  ) {
    const firstCumSec = parseTimeToSeconds(cumulativeSplits[0]);
    if (
      firstCumSec !== null &&
      Math.abs(firstCumSec - reactionTimeSeconds) < 0.02
    ) {
      cumulativeSplits = cumulativeSplits.slice(1);
      subSplits = subSplits.slice(1);
      // First segment's split should equal first cumulative; if we dropped reaction we may have misaligned subs, so fix first sub
      if (cumulativeSplits.length > 0 && subSplits.length > 0 && cumulativeSplits[0] !== subSplits[0]) {
        subSplits = [cumulativeSplits[0], ...subSplits.slice(1)];
      }
    }
  }
  // If we have more cumulatives than subs (e.g. last sub missing), derive last split from cum difference for display
  if (cumulativeSplits.length > 1 && cumulativeSplits.length === subSplits.length + 1) {
    const prevSec = parseTimeToSeconds(cumulativeSplits[cumulativeSplits.length - 2]);
    const lastSec = parseTimeToSeconds(cumulativeSplits[cumulativeSplits.length - 1]);
    if (prevSec != null && lastSec != null && lastSec >= prevSec) {
      const derived = lastSec - prevSec;
      subSplits = [...subSplits, derived < 60 ? derived.toFixed(2) : formatSecondsToTime(derived)];
    }
  }
  const distances = cumulativeSplits.map((_, i) => (i + 1) * 50);
  const hasData = cumulativeSplits.length > 0 || subSplits.length > 0;

  if (!hasData) {
    return (
      <p className={`text-muted-foreground ${compact ? "text-xs py-2" : "text-sm py-4"}`}>
        No split data available.
      </p>
    );
  }

  const tableCls = compact ? "text-xs" : "";
  const thCls = compact ? "py-1.5 px-2" : "";
  const tdCls = compact ? "py-1.5 px-2" : "";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {reactionTimeSeconds != null && (
        <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
          Reaction:{" "}
          <span
            className={
              reactionTimeSeconds < 0
                ? "text-red-600 font-medium"
                : "font-mono tabular-nums"
            }
          >
            {formatReaction(reactionTimeSeconds)}
          </span>
        </p>
      )}
      <div className="ml-auto w-max">
        <Table className={`${tableCls} table-fixed w-max`}>
          <TableHeader>
          <TableRow>
            <TableHead className={`text-right w-[4.5rem] ${thCls}`}>Distance</TableHead>
            <TableHead className={`text-right w-[5rem] ${thCls}`}>Split</TableHead>
            <TableHead className={`text-right w-[5.5rem] ${thCls}`}>Cumulative</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {distances.map((dist, i) => (
            <TableRow key={dist}>
              <TableCell className={`text-right font-medium font-mono tabular-nums ${tdCls}`}>{dist}</TableCell>
              <TableCell className={`text-right font-mono tabular-nums ${tdCls}`}>
                {subSplits[i] != null
                  ? normalizeTimeFormat(subSplits[i])
                  : cumulativeSplits[i] != null
                    ? normalizeTimeFormat(cumulativeSplits[i])
                    : "—"}
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums ${tdCls}`}>
                {cumulativeSplits[i] != null
                  ? normalizeTimeFormat(cumulativeSplits[i])
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

interface RelaySplitsTableProps {
  data: RelaySplitsData;
  athleteIdToName?: Record<string, string>;
  compact?: boolean;
  /** Event name (e.g. "200 Medley Relay") to derive 4 legs, distance columns, and medley stroke labels. */
  eventName?: string;
}

export function RelaySplitsTable({ data, compact, eventName }: RelaySplitsTableProps) {
  const { legs, relayCumulativeAt50 } = data;
  const hasData =
    (legs?.length ?? 0) > 0 || (relayCumulativeAt50?.length ?? 0) > 0;

  if (!hasData) {
    return (
      <p className={`text-muted-foreground ${compact ? "text-xs py-2" : "text-sm py-4"}`}>
        No split data available.
      </p>
    );
  }

  const config = getRelayConfig(eventName ?? "");
  const distanceLabels = getRelayDistanceLabels(config.distancePerLeg);
  const segmentsPerLeg = getSegmentsPerLeg(config.distancePerLeg);
  const strokes = config.strokes;
  const displayLegs = (legs ?? []).length >= RELAY_NUM_LEGS
    ? (legs ?? []).slice(0, RELAY_NUM_LEGS)
    : [
        ...(legs ?? []),
        ...Array.from({ length: RELAY_NUM_LEGS - (legs ?? []).length }, () => ({
          reactionTimeSeconds: null as number | null,
          name: "",
          cumulativeLeg: [] as string[],
          subSplits: [] as string[],
        })),
      ];

  const tableCls = compact ? "text-xs" : "";
  const thCls = compact ? "py-1.5 px-2" : "";
  const tdCls = compact ? "py-1.5 px-2" : "";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <Table className={tableCls}>
        <TableHeader>
          <TableRow>
            <TableHead className={`w-[3rem] ${thCls}`}>Leg</TableHead>
            <TableHead className={thCls}>Swimmer</TableHead>
            <TableHead className={`text-right w-[4rem] ${thCls}`}>Reaction</TableHead>
            {distanceLabels.map((d) => (
              <TableHead key={d} className={`text-right w-[4rem] ${thCls}`}>
                {d}
              </TableHead>
            ))}
            <TableHead className={`text-right w-[5rem] font-medium ${thCls}`} title="Cumulative relay time at end of this leg">
              Relay @ leg
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayLegs.map((leg, legIdx) => {
            const rawSubs = leg.subSplits ?? [];
            const rawCumLeg = leg.cumulativeLeg ?? [];
            const normalized = normalizeLegFromCumulative(rawSubs, rawCumLeg);
            const subs = normalized ? normalized.subs : rawSubs;
            const cumLeg = normalized ? normalized.cumLeg : rawCumLeg;
            const relayCumulativeAtEndOfLeg =
              relayCumulativeAt50 != null && relayCumulativeAt50.length > 0
                ? (() => {
                    const idx = (legIdx + 1) * segmentsPerLeg - 1;
                    return idx >= 0 && idx < relayCumulativeAt50.length ? relayCumulativeAt50[idx] : null;
                  })()
                : null;
            const legLabel = strokes ? `${legIdx + 1} ${strokes[legIdx] ?? ""}` : String(legIdx + 1);
            return (
              <TableRow key={legIdx}>
                <TableCell className={`font-medium ${tdCls}`}>{legLabel}</TableCell>
                <TableCell className={tdCls}>{leg.name ? formatSwimmerDisplayName(leg.name) : "—"}</TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums ${tdCls} ${
                    leg.reactionTimeSeconds != null && leg.reactionTimeSeconds < 0
                      ? "text-red-600"
                      : ""
                  }`}
                >
                  {leg.reactionTimeSeconds != null
                    ? `r ${formatReaction(leg.reactionTimeSeconds)}`
                    : "—"}
                </TableCell>
                {distanceLabels.map((_, i) => {
                  const subVal = subs[i];
                  const cumVal = cumLeg[i];
                  const isFirstSegment = i === 0;
                  return (
                    <TableCell key={i} className={`text-right font-mono tabular-nums ${tdCls}`}>
                      {subVal != null || cumVal != null ? (
                        <span className="whitespace-nowrap">
                          {isFirstSegment ? (
                            // First 50: sub and cum are the same, show one time only
                            normalizeTimeFormat(cumVal ?? subVal ?? "")
                          ) : (
                            // Later segments: (sub) cumulative
                            <>
                              {subVal != null && (
                                <span className="text-muted-foreground" title="Split">
                                  ({normalizeTimeFormat(subVal)})
                                </span>
                              )}
                              {cumVal != null && (
                                <span className={subVal != null ? "ml-0.5" : ""}>{normalizeTimeFormat(cumVal)}</span>
                              )}
                            </>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className={`text-right font-mono tabular-nums text-muted-foreground ${tdCls}`}>
                  {relayCumulativeAtEndOfLeg != null
                    ? normalizeTimeFormat(relayCumulativeAtEndOfLeg)
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {relayCumulativeAt50 != null && relayCumulativeAt50.length > 0 && (
        <div className={`font-mono tabular-nums text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
          Total: {normalizeTimeFormat(relayCumulativeAt50[relayCumulativeAt50.length - 1] ?? "")}
        </div>
      )}
    </div>
  );
}

interface SplitsDetailViewProps {
  type: "individual" | "relay";
  title: string;
  eventName: string;
  finalTime: string | null;
  splitsData: IndividualSplitsData | RelaySplitsData | null;
  athleteIdToName?: Record<string, string>;
  compact?: boolean;
}

export function SplitsDetailView({
  type,
  title,
  eventName,
  finalTime,
  splitsData,
  athleteIdToName,
  compact,
}: SplitsDetailViewProps) {
  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div>
        <h3 className={compact ? "font-semibold text-sm" : "font-semibold text-lg"}>{title}</h3>
        <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
          {eventName}
        </p>
        {finalTime && (
          <p className={`font-mono tabular-nums ${compact ? "text-xs mt-0.5" : "text-sm mt-1"}`}>
            Final time: {normalizeTimeFormat(finalTime)}
          </p>
        )}
      </div>
      {splitsData == null ? (
        <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
          No split data available.
        </p>
      ) : type === "individual" ? (
        <IndividualSplitsTable data={splitsData as IndividualSplitsData} compact={compact} />
      ) : (
        <RelaySplitsTable
          data={splitsData as RelaySplitsData}
          athleteIdToName={athleteIdToName}
          compact={compact}
          eventName={eventName}
        />
      )}
    </div>
  );
}
