"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatName, formatTeamName, formatTeamRelayLabel, normalizeTimeFormat, parseTimeToSeconds, formatSecondsToTime } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Edit2, Save, X, ChevronDown, ChevronRight, BarChart2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SplitsDetailView, type IndividualSplitsData, type RelaySplitsData } from "@/components/meets/splits-detail-view";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface MeetTeamSensitivity {
  teamId: string;
  sensitivityVariantAthleteId?: string | null;
  sensitivityVariant?: string | null;
  sensitivityPercent?: number | null;
  team?: { name?: string; schoolName?: string | null };
}

interface MeetLineup {
  id: string;
  athleteId: string;
  eventId: string;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  overrideTime: string | null;
  overrideTimeSeconds: number | null;
  finalTime: string | null;
  finalTimeSeconds: number | null;
  place: number | null;
  points: number | null;
  sensitivityPlaceBetter?: number | null;
  sensitivityPointsBetter?: number | null;
  sensitivityPlaceWorse?: number | null;
  sensitivityPointsWorse?: number | null;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    year: string | null;
    team: {
      id: string;
      name: string;
      schoolName?: string | null;
      primaryColor: string | null;
    };
  };
  event: {
    id: string;
    name: string;
    eventType: string;
  };
  splitsData?: string | null;
}

interface RelayEntry {
  id: string;
  teamId: string;
  eventId: string;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  overrideTime: string | null;
  overrideTimeSeconds: number | null;
  finalTime: string | null;
  finalTimeSeconds: number | null;
  place: number | null;
  points: number | null;
  members: string | null;
  legTimes: string | null; // JSON array of leg times e.g. ["19.95", "20.10", null, "19.88"]
  splitsData?: string | null;
  team: {
    id: string;
    name: string;
    schoolName?: string | null;
    shortName?: string | null;
    primaryColor: string | null;
  };
  event: {
    id: string;
    name: string;
    eventType: string;
  };
}

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  shortName?: string | null;
  primaryColor: string | null;
}

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface EventDetailViewProps {
  event: Event;
  meetLineups: MeetLineup[];
  relayEntries: RelayEntry[];
  teams: Team[];
  /** Map athlete id -> display name for relay split labels (optional) */
  athleteIdToName?: Record<string, string>;
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
  scoringPlaces: number;
  hasResults: boolean;
  meetId: string;
  /** Athlete IDs in the test spot (show "Test" badge next to name) */
  testSpotAthleteIds?: string[];
  /** Meet teams with sensitivity fields (for variant-specific place/points and scenario toggle) */
  meetTeams?: MeetTeamSensitivity[];
  /** When true, hide edit toolbar and re-run simulation (e.g. public view-only share) */
  readOnly?: boolean;
  /** When true, this event has applied real results; show only entries with finalTime (exclude seed-only) */
  eventHasRealResults?: boolean;
  /** When true, meet is in real/hybrid mode; if event has no applied results, show empty (no seed times) */
  realResultsMode?: boolean;
  /** Projected data per athlete for this event (for vs-projection columns) */
  projectedLineups?: { athleteId: string; simulatedPlace: number | null; simulatedPoints: number | null }[];
  /** Projected data per relay for this event (for vs-projection columns) */
  projectedRelays?: { teamId: string; simulatedPlace: number | null; simulatedPoints: number | null }[];
}

interface TeamEventStats {
  teamId: string;
  teamName: string;
  teamColor: string | null;
  totalPoints: number;
  athleteCount: number;
  aFinalCount: number;
  bFinalCount: number;
  cFinalCount: number;
  nonScorerCount: number;
      entries: Array<{
        athleteId: string;
        athleteName: string;
        /** For individual/diving: the athlete's id (for test-spot badge) */
        realAthleteId?: string;
        place: number | null;
        points: number;
        time: string | null;
        /** When set, show this instead of time (e.g. sensitivity-adjusted time) */
        displayTime?: string | null;
        teamName?: string;
        teamColor?: string | null;
        year?: string | null;
        /** Relay shorthand for Relay column (e.g. "PRIN") */
        teamRelayLabel?: string;
        lineupId?: string;
        hasOverride?: boolean;
      }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function EventDetailView({
  event,
  meetLineups,
  relayEntries,
  teams,
  athleteIdToName = {},
  individualScoring,
  relayScoring,
  scoringPlaces,
  hasResults,
  meetId,
  testSpotAthleteIds = [],
  meetTeams = [],
  readOnly = false,
  eventHasRealResults = false,
  realResultsMode = false,
  projectedLineups,
  projectedRelays,
}: EventDetailViewProps) {
  const showProjection = (projectedLineups != null && projectedLineups.length > 0) || (projectedRelays != null && projectedRelays.length > 0);
  const projByAthleteId = useMemo(() => {
    const m = new Map<string, { simulatedPlace: number | null; simulatedPoints: number | null }>();
    projectedLineups?.forEach((p) => m.set(p.athleteId, p));
    return m;
  }, [projectedLineups]);
  const projByTeamId = useMemo(() => {
    const m = new Map<string, { simulatedPlace: number | null; simulatedPoints: number | null }>();
    projectedRelays?.forEach((p) => m.set(p.teamId, p));
    return m;
  }, [projectedRelays]);
  const totalCols = showProjection ? 8 : 6;
  const testSpotSet = useMemo(() => new Set(testSpotAthleteIds), [testSpotAthleteIds]);
  const meetTeamsByTeamId = useMemo(() => {
    const m = new Map<string, MeetTeamSensitivity>();
    meetTeams.forEach((mt) => m.set(mt.teamId, mt));
    return m;
  }, [meetTeams]);
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTimes, setEditingTimes] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [clearingResults, setClearingResults] = useState(false);
  const [expandedLineupId, setExpandedLineupId] = useState<string | null>(null);

  const hasSplitsData = useCallback(
    (lineupId: string | undefined) => {
      if (!lineupId) return false;
      if (event.eventType === "relay") {
        return relayEntries.some((r) => r.id === lineupId && r.splitsData);
      }
      return meetLineups.some((l) => l.id === lineupId && l.splitsData);
    },
    [event.eventType, meetLineups, relayEntries]
  );

  const getSplitsPayloadForEntry = useCallback(
    (entry: { lineupId?: string; athleteName: string; teamRelayLabel?: string; time: string | null }) => {
      if (!entry.lineupId) return null;
      const isRelay = event.eventType === "relay";
      if (isRelay) {
        const relay = relayEntries.find((r) => r.id === entry.lineupId);
        if (!relay?.splitsData) return null;
        let parsed: RelaySplitsData | null = null;
        try {
          parsed = JSON.parse(relay.splitsData) as RelaySplitsData;
        } catch {
          return null;
        }
        return {
          type: "relay" as const,
          title: entry.teamRelayLabel ?? entry.athleteName,
          eventName: event.name,
          finalTime: relay.finalTime ?? entry.time,
          splitsData: parsed,
        };
      }
      const lineup = meetLineups.find((l) => l.id === entry.lineupId);
      if (!lineup?.splitsData) return null;
      let parsed: IndividualSplitsData | null = null;
      try {
        parsed = JSON.parse(lineup.splitsData) as IndividualSplitsData;
      } catch {
        return null;
      }
      return {
        type: "individual" as const,
        title: entry.athleteName,
        eventName: event.name,
        finalTime: lineup.finalTime ?? entry.time,
        splitsData: parsed,
      };
    },
    [event.eventType, event.name, meetLineups, relayEntries]
  );

  const toggleExpanded = useCallback((lineupId: string | undefined) => {
    setExpandedLineupId((prev) => (prev === lineupId ? null : lineupId ?? null));
  }, []);

  // Calculate A/B/C final ranges
  const aFinalRange = { min: 1, max: Math.min(8, scoringPlaces) };
  const bFinalRange = { min: 9, max: Math.min(16, scoringPlaces) };
  const cFinalRange = { min: 17, max: Math.min(24, scoringPlaces) };

  // Helper to get effective time: real result (finalTime) if set, else override, else seed
  const getEffectiveTime = useCallback((lineup: MeetLineup | RelayEntry) => {
    if (lineup.finalTime) return lineup.finalTime;
    const overrideTime = 'overrideTime' in lineup ? lineup.overrideTime : null;
    return overrideTime ?? lineup.seedTime;
  }, []);

  const getEffectiveTimeSeconds = useCallback((lineup: MeetLineup | RelayEntry) => {
    if (lineup.finalTimeSeconds != null) return lineup.finalTimeSeconds;
    const overrideTimeSeconds = 'overrideTimeSeconds' in lineup ? lineup.overrideTimeSeconds : null;
    return overrideTimeSeconds ?? lineup.seedTimeSeconds;
  }, []);

  /** Return true if placeA and placeB are in the same final tier (A/B/C/non-scorer). */
  const sameFinalTier = useCallback(
    (placeA: number, placeB: number) => {
      const tier = (p: number) => {
        if (p >= aFinalRange.min && p <= aFinalRange.max) return "A";
        if (p >= bFinalRange.min && p <= bFinalRange.max) return "B";
        if (p >= cFinalRange.min && p <= cFinalRange.max) return "C";
        return "N";
      };
      return tier(placeA) === tier(placeB);
    },
    [aFinalRange, bFinalRange, cFinalRange]
  );

  // Process individual events
  const teamStats = useMemo(() => {
    const statsMap = new Map<string, TeamEventStats>();

    // Initialize all teams
    teams.forEach((team) => {
      statsMap.set(team.id, {
        teamId: team.id,
        teamName: formatTeamName(team.name, team.schoolName),
        teamColor: team.primaryColor,
        totalPoints: 0,
        athleteCount: 0,
        aFinalCount: 0,
        bFinalCount: 0,
        cFinalCount: 0,
        nonScorerCount: 0,
        entries: [],
      });
    });

    // Only show entries that have some time data (final, override, or seed); hide "ghost" lineups left after clear
    // In real/hybrid mode: only show entries that came from Apply results (realResultApplied), not from simulation.
    const lineupsWithTime =
      realResultsMode
        ? (eventHasRealResults
            ? meetLineups.filter(
                (l) => l.finalTime != null && (l as { realResultApplied?: boolean }).realResultApplied === true
              )
            : [])
        : meetLineups.filter(
            (l) => l.finalTime != null || l.overrideTime != null || l.seedTime != null
          );

    // Sort lineups: when stored place exists, sort by place then time so applied results keep correct order; else by time only
    const sortedLineups = [...lineupsWithTime].sort((a, b) => {
      const aPlace = a.place ?? Infinity;
      const bPlace = b.place ?? Infinity;
      if (aPlace !== bPlace) return aPlace - bPlace;
      const aOverride = 'overrideTimeSeconds' in a ? a.overrideTimeSeconds : null;
      const bOverride = 'overrideTimeSeconds' in b ? b.overrideTimeSeconds : null;
      const aTime = (a.finalTimeSeconds ?? aOverride ?? a.seedTimeSeconds) ?? (event.eventType === "diving" ? -Infinity : Infinity);
      const bTime = (b.finalTimeSeconds ?? bOverride ?? b.seedTimeSeconds) ?? (event.eventType === "diving" ? -Infinity : Infinity);
      if (event.eventType === "diving") return bTime - aTime;
      return aTime - bTime;
    });

    // Group consecutive lineups with the same time (tie); use tolerance 0.01s for float comparison
    const TIME_TIE_TOLERANCE = 0.01;
    const tieGroups: typeof sortedLineups[] = [];
    let i = 0;
    while (i < sortedLineups.length) {
      const first = sortedLineups[i]!;
      const firstSec = getEffectiveTimeSeconds(first) ?? (event.eventType === "diving" ? -Infinity : Infinity);
      const group: typeof sortedLineups = [first];
      i++;
      while (i < sortedLineups.length) {
        const next = sortedLineups[i]!;
        const nextSec = getEffectiveTimeSeconds(next) ?? (event.eventType === "diving" ? -Infinity : Infinity);
        const diff = event.eventType === "diving" ? Math.abs(nextSec - firstSec) : Math.abs(nextSec - firstSec);
        if (diff <= TIME_TIE_TOLERANCE) {
          group.push(next);
          i++;
        } else {
          break;
        }
      }
      tieGroups.push(group);
    }

    // Assign place and points per group; prefer stored place/points when all in group have the same stored place (applied results)
    let nextPlace = 1;
    tieGroups.forEach((group) => {
      const hasStoredPlace = group.every((l) => l.place != null) && new Set(group.map((l) => l.place)).size === 1;
      const storedPlace = hasStoredPlace ? group[0]!.place! : null;
      const placeStart = storedPlace ?? nextPlace;
      const placeEnd = placeStart + group.length - 1;
      const inSameTier = group.length === 1 || sameFinalTier(placeStart, placeEnd);
      const mergeTie = group.length > 1 && inSameTier;

      for (let g = 0; g < group.length; g++) {
        const lineup = group[g]!;
        const teamId = lineup.athlete.team.id;
        const meetTeam = meetTeamsByTeamId.get(teamId);
        const useSensitivityVariant =
          meetTeam?.sensitivityVariantAthleteId &&
          lineup.athleteId === meetTeam.sensitivityVariantAthleteId &&
          (meetTeam.sensitivityVariant === "better" || meetTeam.sensitivityVariant === "worse");
        let place: number;
        let points: number;
        if (useSensitivityVariant && meetTeam?.sensitivityVariant === "better" && lineup.sensitivityPlaceBetter != null && lineup.sensitivityPointsBetter != null) {
          place = lineup.sensitivityPlaceBetter;
          points = lineup.sensitivityPointsBetter;
        } else if (useSensitivityVariant && meetTeam?.sensitivityVariant === "worse" && lineup.sensitivityPlaceWorse != null && lineup.sensitivityPointsWorse != null) {
          place = lineup.sensitivityPlaceWorse;
          points = lineup.sensitivityPointsWorse;
        } else {
          if (mergeTie) {
            place = placeStart;
            const hasStoredPoints = group.every((l) => l.points != null);
            if (hasStoredPoints) {
              const sum = group.reduce((s, l) => s + (l.points ?? 0), 0);
              points = group.length > 0 ? sum / group.length : 0;
            } else {
              const pointSum = Array.from({ length: group.length }, (_, k) => individualScoring[(placeStart + k).toString()] ?? 0).reduce((a, b) => a + b, 0);
              points = group.length > 0 ? pointSum / group.length : 0;
            }
          } else {
            place = placeStart + g;
            points = lineup.points !== null ? lineup.points : (lineup.finalTime != null && place <= scoringPlaces ? (individualScoring[place.toString()] ?? 0) : 0);
          }
        }
        const stats = statsMap.get(teamId);
        if (!stats) continue;

        if (place >= aFinalRange.min && place <= aFinalRange.max) {
          stats.aFinalCount++;
        } else if (place >= bFinalRange.min && place <= bFinalRange.max) {
          stats.bFinalCount++;
        } else if (place >= cFinalRange.min && place <= cFinalRange.max) {
          stats.cFinalCount++;
        } else {
          stats.nonScorerCount++;
        }

        stats.athleteCount++;
        stats.totalPoints += points;
        const baseTimeStr = getEffectiveTime(lineup);
        // If stored time looks like points (e.g. "13.5" with no colon), use first teammate's time in tie group so display is correct
        let timeToShow = baseTimeStr;
        if (mergeTie && baseTimeStr != null && !String(baseTimeStr).includes(":") && parseFloat(String(baseTimeStr)) < 100) {
          const canonical = group.find((l) => {
            const t = getEffectiveTime(l);
            return t != null && String(t).includes(":");
          });
          if (canonical) timeToShow = getEffectiveTime(canonical);
        }
        let displayTime: string | null | undefined = undefined;
        if (useSensitivityVariant && meetTeam && (meetTeam.sensitivityVariant === "better" || meetTeam.sensitivityVariant === "worse")) {
          const baseSeconds = lineup.overrideTimeSeconds ?? lineup.seedTimeSeconds ?? (timeToShow ? parseTimeToSeconds(timeToShow) : null);
          if (baseSeconds != null) {
            const pct = (meetTeam.sensitivityPercent ?? 1) / 100;
            const isDiving = event.eventType === "diving";
            let adjustedSeconds: number;
            if (meetTeam.sensitivityVariant === "better") {
              adjustedSeconds = isDiving ? baseSeconds * (1 + pct) : baseSeconds * (1 - pct);
            } else {
              adjustedSeconds = isDiving ? baseSeconds * (1 - pct) : baseSeconds * (1 + pct);
            }
            displayTime = formatSecondsToTime(Math.round(adjustedSeconds * 100) / 100, isDiving);
          }
        }
        stats.entries.push({
          athleteId: lineup.id,
          athleteName: formatName(lineup.athlete.firstName, lineup.athlete.lastName),
          realAthleteId: lineup.athlete.id,
          year: lineup.athlete.year ?? null,
          place,
          points,
          time: timeToShow ?? baseTimeStr,
          displayTime: displayTime ?? undefined,
          teamName: stats.teamName,
          teamColor: stats.teamColor,
          lineupId: lineup.id,
          hasOverride: !!('overrideTime' in lineup && lineup.overrideTime),
        });
      }
      nextPlace = placeEnd + 1;
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [meetLineups, teams, individualScoring, scoringPlaces, event.eventType, event.id, event.name, aFinalRange, bFinalRange, cFinalRange, getEffectiveTime, getEffectiveTimeSeconds, sameFinalTier, meetTeamsByTeamId, eventHasRealResults, realResultsMode]);

  // Process relay entries if this is a relay event
  const relayTeamStats = useMemo(() => {
    if (event.eventType !== "relay") return [];

    const statsMap = new Map<string, TeamEventStats>();

    teams.forEach((team) => {
      statsMap.set(team.id, {
        teamId: team.id,
        teamName: formatTeamName(team.name, team.schoolName),
        teamColor: team.primaryColor,
        totalPoints: 0,
        athleteCount: 0,
        aFinalCount: 0,
        bFinalCount: 0,
        cFinalCount: 0,
        nonScorerCount: 0,
        entries: [],
      });
    });

    const relaysWithTime =
      realResultsMode
        ? (eventHasRealResults
            ? relayEntries.filter(
                (r) => r.finalTime != null && (r as { realResultApplied?: boolean }).realResultApplied === true
              )
            : [])
        : relayEntries.filter(
            (r) => r.finalTime != null || r.overrideTime != null || r.seedTime != null
          );

    // Sort: by place (non-null first so DQ go last), then by time
    const sortedRelays = [...relaysWithTime].sort((a, b) => {
      const aHasPlace = a.place != null ? 0 : 1;
      const bHasPlace = b.place != null ? 0 : 1;
      if (aHasPlace !== bHasPlace) return aHasPlace - bHasPlace;
      const aOverride = 'overrideTimeSeconds' in a ? a.overrideTimeSeconds : null;
      const bOverride = 'overrideTimeSeconds' in b ? b.overrideTimeSeconds : null;
      const aTime = (a.finalTimeSeconds ?? aOverride ?? a.seedTimeSeconds) ?? Infinity;
      const bTime = (b.finalTimeSeconds ?? bOverride ?? b.seedTimeSeconds) ?? Infinity;
      return aTime - bTime;
    });

    const RELAY_TIME_TIE_TOLERANCE = 0.01;
    const relayTieGroups: typeof sortedRelays[] = [];
    let ri = 0;
    while (ri < sortedRelays.length) {
      const first = sortedRelays[ri]!;
      const firstSec = first.finalTimeSeconds ?? first.overrideTimeSeconds ?? first.seedTimeSeconds ?? Infinity;
      const group: typeof sortedRelays = [first];
      ri++;
      // DQ (place null) stay as single-entry groups; others group by time tie
      if (first.place == null) {
        relayTieGroups.push(group);
        continue;
      }
      while (ri < sortedRelays.length) {
        const next = sortedRelays[ri]!;
        if (next.place == null) break;
        const nextSec = next.finalTimeSeconds ?? next.overrideTimeSeconds ?? next.seedTimeSeconds ?? Infinity;
        if (Math.abs((nextSec ?? Infinity) - (firstSec ?? Infinity)) <= RELAY_TIME_TIE_TOLERANCE) {
          group.push(next);
          ri++;
        } else break;
      }
      relayTieGroups.push(group);
    }

    let relayNextPlace = 1;
    relayTieGroups.forEach((group) => {
      const isDQGroup = group.length > 0 && group[0]!.place == null;
      const placeStart = isDQGroup ? null : relayNextPlace;
      const placeEnd = isDQGroup ? null : relayNextPlace + group.length - 1;

      group.forEach((relay, g) => {
        const place = isDQGroup ? null : (group.length > 1 && sameFinalTier(placeStart!, placeEnd!) ? placeStart! : placeStart! + g);
        let points = 0;
        if (relay.points !== null && !isDQGroup) {
          points = relay.points;
        } else if (!isDQGroup && group.length > 1 && sameFinalTier(placeStart!, placeEnd!)) {
          const pointSum = Array.from({ length: group.length }, (_, k) => relayScoring[(placeStart! + k).toString()] ?? 0).reduce((a, b) => a + b, 0);
          points = group.length > 0 ? pointSum / group.length : 0;
        } else if (!isDQGroup && relay.finalTime != null && place != null && place <= scoringPlaces) {
          points = relayScoring[place.toString()] || 0;
        }

        const stats = statsMap.get(relay.teamId);
        if (!stats) return;

        if (place != null) {
          if (place >= aFinalRange.min && place <= aFinalRange.max) {
            stats.aFinalCount++;
          } else if (place >= bFinalRange.min && place <= bFinalRange.max) {
            stats.bFinalCount++;
          } else if (place >= cFinalRange.min && place <= cFinalRange.max) {
            stats.cFinalCount++;
          } else {
            stats.nonScorerCount++;
          }
        } else {
          stats.nonScorerCount++;
        }

        stats.athleteCount++;
        stats.totalPoints += points;
        const displayTime = relay.finalTime === "DQ" || relay.finalTime === "XDQ" ? "DQ" : getEffectiveTime(relay);
        stats.entries.push({
          athleteId: relay.id,
          athleteName: formatTeamName(relay.team.name, relay.team.schoolName),
          place,
          points,
          time: displayTime,
          teamName: stats.teamName,
          teamColor: stats.teamColor,
          teamRelayLabel: formatTeamRelayLabel(relay.team),
          lineupId: relay.id,
          hasOverride: !!('overrideTime' in relay && relay.overrideTime),
        });
      });
      if (!isDQGroup && placeEnd != null) relayNextPlace = placeEnd + 1;
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [relayEntries, teams, relayScoring, scoringPlaces, event.eventType, aFinalRange, bFinalRange, cFinalRange, getEffectiveTime, sameFinalTier, eventHasRealResults, realResultsMode]);

  const displayStats = event.eventType === "relay" ? relayTeamStats : teamStats;

  // Chart view state
  const [chartView, setChartView] = useState<"points" | "depth">("points");

  // Prepare chart data with team colors
  const chartData = useMemo(() => {
    return displayStats.map((s) => ({
      name: s.teamName,
      teamColor: s.teamColor || "#3b82f6",
      points: s.totalPoints,
      athleteCount: s.athleteCount,
    }));
  }, [displayStats]);


  // Save time overrides
  const handleSaveOverrides = useCallback(async () => {
    if (!meetId) return;
    
    setSaving(true);
    try {
      const updates = Array.from(editingTimes.entries()).map(async ([lineupId, time]) => {
        const isRelay = relayEntries.some(r => r.id === lineupId);
        const endpoint = isRelay
          ? `/api/meets/${meetId}/overrides/relays/${lineupId}`
          : `/api/meets/${meetId}/overrides/lineups/${lineupId}`;

        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ time: time || null }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update ${lineupId}`);
        }
      });

      await Promise.all(updates);
      setEditingTimes(new Map());
      setIsEditMode(false);
      router.refresh();
    } catch (error) {
      console.error("Error saving overrides:", error);
      alert("Failed to save time overrides. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [editingTimes, meetId, relayEntries, router]);

  const handleTimeChange = useCallback((lineupId: string, time: string) => {
    setEditingTimes((prev) => {
      const next = new Map(prev);
      if (time.trim() === "") {
        next.delete(lineupId);
      } else {
        next.set(lineupId, time.trim());
      }
      return next;
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTimes(new Map());
    setIsEditMode(false);
  }, []);

  const handleClearResults = useCallback(async () => {
    if (!meetId || !event?.id) return;
    if (!confirm("Clear all results (times, places, points, splits) for this event? This cannot be undone.")) return;
    setClearingResults(true);
    try {
      const res = await fetch(`/api/meets/${meetId}/events/${event.id}/results`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to clear results");
      toast.success("Results cleared");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear results");
    } finally {
      setClearingResults(false);
    }
  }, [meetId, event?.id, router]);

  // Check if there are any overridden times
  const hasOverrides = useMemo(() => {
    const allEntries = displayStats.flatMap((stats) => stats.entries);
    return allEntries.some((entry) => entry.hasOverride);
  }, [displayStats]);

  // Re-run simulation
  const [simulating, setSimulating] = useState(false);
  const handleRerunSimulation = useCallback(async () => {
    if (!meetId) return;
    
    setSimulating(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/simulate`, {
        method: "POST",
        cache: "no-store", // Ensure we don't use cached responses
      });

      if (!response.ok) {
        throw new Error("Failed to run simulation");
      }

      // Wait a moment for database writes to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Refresh the router to get fresh data
      router.refresh();
      
      // Give router.refresh time to complete, then force a re-fetch
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Failed to run simulation. Please try again.");
    } finally {
      setSimulating(false);
    }
  }, [meetId, router]);

  // Parse relay members and leg times for split display
  const getRelaySplits = useCallback(
    (relay: RelayEntry): { name: string; time: string | null }[] => {
      let memberIds: string[] = [];
      try {
        if (relay.members) memberIds = JSON.parse(relay.members) as string[];
      } catch {
        /* ignore */
      }
      let times: (string | null)[] = [];
      try {
        if (relay.legTimes) times = JSON.parse(relay.legTimes) as (string | null)[];
      } catch {
        /* ignore */
      }
      return memberIds.map((id, i) => ({
        name: athleteIdToName[id] || `Leg ${i + 1}`,
        time: times[i] ?? null,
      }));
    },
    [athleteIdToName]
  );

  // Helper to render time cell (editable in edit mode)
  const renderTimeCell = useCallback((entry: { lineupId?: string; time: string | null; displayTime?: string | null; hasOverride?: boolean }) => {
    const timeToShow = entry.displayTime ?? entry.time;
    if (!isEditMode || !entry.lineupId) {
      return (
        <div className="text-right font-mono tabular-nums">
          {timeToShow ? (
            <span className={entry.hasOverride ? "text-red-600" : ""}>
              {normalizeTimeFormat(timeToShow)}
            </span>
          ) : (
            "N/A"
          )}
        </div>
      );
    }

    const currentValue = editingTimes.get(entry.lineupId) ?? entry.time ?? "";
    return (
      <Input
        type="text"
        value={currentValue}
        onChange={(e) => handleTimeChange(entry.lineupId!, e.target.value)}
        placeholder="Enter time"
        className="font-mono text-right w-32 ml-auto"
      />
    );
  }, [isEditMode, editingTimes, handleTimeChange]);

  const renderProjectionCells = (entry: { realAthleteId?: string | null; lineupId?: string | null; points: number }) => {
    if (!showProjection) return null;
    let proj: { simulatedPlace: number | null; simulatedPoints: number | null } | undefined;
    if (event.eventType === "relay") {
      const relay = relayEntries.find((r) => r.id === entry.lineupId);
      if (relay) proj = projByTeamId.get(relay.teamId);
    } else if (entry.realAthleteId) {
      proj = projByAthleteId.get(entry.realAthleteId);
    }
    const projPlace = proj?.simulatedPlace;
    const projPoints = proj?.simulatedPoints ?? 0;
    const delta = proj != null ? entry.points - projPoints : null;
    return (
      <>
        <TableCell className="w-[4.5rem] text-right text-xs text-slate-500">
          {projPlace != null ? ordinal(projPlace) : "--"}
        </TableCell>
        <TableCell className={`w-[5rem] text-right text-xs font-semibold ${delta != null && delta > 0 ? "text-green-600" : delta != null && delta < 0 ? "text-red-600" : "text-slate-400"}`}>
          {delta == null ? "--" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
        </TableCell>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="results" className="w-full">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Results Tab - Default View */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Event Results</CardTitle>
                  <CardDescription>
                    Complete list of all entries in this event, sorted by place
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {meetTeams
                      .filter((mt) => mt.sensitivityVariantAthleteId)
                      .map((mt) => {
                        const sensVariant = mt.sensitivityVariant ?? "baseline";
                        const sensPercent = mt.sensitivityPercent ?? 1;
                        const teamName = mt.team ? formatTeamName(mt.team.name ?? "", mt.team.schoolName) : mt.teamId;
                        return (
                          <div key={mt.teamId} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 whitespace-nowrap">{teamName}:</span>
                            <Select
                              value={sensVariant}
                              onValueChange={async (val: "baseline" | "better" | "worse") => {
                                try {
                                  const res = await fetch(`/api/meets/${meetId}/rosters/${mt.teamId}/sensitivity-variant`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ variant: val }),
                                  });
                                  if (!res.ok) throw new Error((await res.json()).error);
                                  toast.success("Sensitivity variant updated");
                                  router.refresh();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed to update");
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="baseline">Baseline</SelectItem>
                                <SelectItem value="better">Better ({sensPercent}%)</SelectItem>
                                <SelectItem value="worse">Worse ({sensPercent}%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                </div>
                {!readOnly && !isEditMode ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditMode(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Times
                    </Button>
                    {hasResults || meetLineups.length > 0 || relayEntries.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearResults}
                        disabled={clearingResults}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {clearingResults ? "Clearing..." : "Clear results"}
                      </Button>
                    ) : null}
                  </div>
                ) : !readOnly ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveOverrides}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {displayStats.length === 0 || displayStats.every((s) => s.entries.length === 0) ? (
                <div className="text-center py-8 text-slate-500">
                  No entries in this event.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table className="table-fixed w-full">
                    <colgroup>
                      <col className="w-[4rem]" />
                      <col className="w-[16rem]" />
                      <col className="w-[4rem]" />
                      <col />
                      <col className="w-[7.5rem]" />
                      <col className="w-[6rem]" />
                      {showProjection && <col className="w-[4.5rem]" />}
                      {showProjection && <col className="w-[5rem]" />}
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[4rem] pr-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Place</TableHead>
                        <TableHead className="w-[16rem] pl-3 pr-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">{event.eventType === "relay" ? "Relay" : "Athlete"}</TableHead>
                        <TableHead className="w-[4rem] pl-1 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{event.eventType !== "relay" ? "Year" : ""}</TableHead>
                        <TableHead className="pr-8 text-xs font-semibold text-slate-600 uppercase tracking-wide">Team</TableHead>
                        <TableHead className="w-[7.5rem] text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">{event.eventType === "diving" ? "Score" : "Time"}</TableHead>
                        <TableHead className="w-[6rem] pl-5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Points</TableHead>
                        {showProjection && <TableHead className="w-[4.5rem] text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Proj.</TableHead>}
                        {showProjection && <TableHead className="w-[5rem] text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">+/−</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const allEntries = displayStats
                          .flatMap((stats) => stats.entries)
                          .sort((a, b) => (a.place || 999) - (b.place || 999));

                        const aFinalEntries = allEntries.filter(
                          (e) => e.place && e.place >= aFinalRange.min && e.place <= aFinalRange.max
                        );
                        const bFinalEntries = allEntries.filter(
                          (e) => e.place && e.place >= bFinalRange.min && e.place <= bFinalRange.max
                        );
                        const cFinalEntries = allEntries.filter(
                          (e) => e.place && e.place >= cFinalRange.min && e.place <= cFinalRange.max
                        );
                        const nonScorerEntries = allEntries.filter(
                          (e) => !e.place || e.place > cFinalRange.max
                        );

                        return (
                          <>
                            {/* A Final Section */}
                            {aFinalEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-700 hover:bg-slate-700">
                                  <TableCell colSpan={totalCols} className="text-white font-semibold py-2">
                                    A Final (Places {aFinalRange.min}-{aFinalRange.max})
                                  </TableCell>
                                </TableRow>
                                {aFinalEntries.map((entry, idx) => {
                                  const relay = event.eventType === "relay" ? relayEntries.find((r) => r.id === entry.lineupId) : null;
                                  const splits = relay ? getRelaySplits(relay) : [];
                                  const isExpanded = expandedLineupId === entry.lineupId;
                                  const canExpand = !isEditMode && (event.eventType === "relay" || hasSplitsData(entry.lineupId));
                                  const hasSplits = hasSplitsData(entry.lineupId);
                                  const onRowClick = canExpand ? () => toggleExpanded(entry.lineupId ?? undefined) : undefined;
                                  const splitsPayload = getSplitsPayloadForEntry(entry);
                                  const expansionId = `splits-expand-${entry.lineupId ?? idx}`;
                                  return (
                                    <Fragment key={entry.lineupId ?? `a-${idx}`}>
                                      <TableRow
                                        key={`a-${entry.athleteId}-${idx}`}
                                        className={`${idx % 2 === 0 ? "bg-slate-50" : "bg-white"} ${canExpand ? "cursor-pointer hover:bg-slate-100/80" : ""}`}
                                        onClick={onRowClick}
                                        role={onRowClick ? "button" : undefined}
                                        tabIndex={onRowClick ? 0 : undefined}
                                        aria-expanded={onRowClick ? isExpanded : undefined}
                                        aria-controls={onRowClick ? expansionId : undefined}
                                        onKeyDown={
                                          onRowClick
                                            ? (e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  toggleExpanded(entry.lineupId ?? undefined);
                                                }
                                              }
                                            : undefined
                                        }
                                      >
                                        <TableCell className="w-[4rem] font-bold pr-2">
                                          <span className="flex items-center gap-2">
                                            <span className="inline-flex w-5 shrink-0 items-center justify-center">
                                              {event.eventType === "relay" || hasSplits ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                                            </span>
                                            {entry.place ?? "—"}
                                            {entry.place === 1 && " 🥇"}
                                            {entry.place === 2 && " 🥈"}
                                            {entry.place === 3 && " 🥉"}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[16rem] font-medium pl-3 pr-4">
                                          {event.eventType === "relay" ? (entry.teamRelayLabel ?? entry.teamName) : (
                                            <span className="inline-flex items-center gap-1.5">
                                              {entry.athleteName}
                                              {entry.realAthleteId && testSpotSet.has(entry.realAthleteId) && (
                                                <Badge variant="secondary" className="text-xs font-normal">Test</Badge>
                                              )}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="w-[4rem] pl-1 text-left text-sm text-slate-500">
                                          {event.eventType !== "relay" ? (entry.year ?? "—") : ""}
                                        </TableCell>
                                        <TableCell className="pr-8">
                                          <span
                                            style={
                                              entry.teamColor
                                                ? { color: entry.teamColor, fontWeight: 600 }
                                                : {}
                                            }
                                          >
                                            {entry.teamName}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[7.5rem] text-right">
                                          <span className="inline-flex items-center justify-end gap-1 w-full">
                                            {renderTimeCell(entry)}
                                            {hasSplits && <BarChart2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[6rem] text-right font-semibold text-green-600 pl-5">
                                          {entry.points > 0 ? entry.points.toFixed(1) : "-"}
                                        </TableCell>
                                        {renderProjectionCells(entry)}
                                      </TableRow>
                                      {isExpanded && hasSplits && splitsPayload && (
                                        <TableRow key={`a-expand-${entry.lineupId}`} className={idx % 2 === 0 ? "bg-slate-50/90" : "bg-white/90"}>
                                          <TableCell colSpan={totalCols} className="p-4 align-top border-l-4 border-slate-200" id={expansionId}>
                                            <SplitsDetailView
                                              type={splitsPayload.type}
                                              title={splitsPayload.title}
                                              eventName={splitsPayload.eventName}
                                              finalTime={splitsPayload.finalTime}
                                              splitsData={splitsPayload.splitsData}
                                              athleteIdToName={athleteIdToName}
                                              compact
                                            />
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {isExpanded && !hasSplits && event.eventType === "relay" && splits.length > 0 &&
                                        splits.map((split, i) => (
                                          <TableRow
                                            key={`a-${entry.athleteId}-${idx}-split-${i}`}
                                            className={idx % 2 === 0 ? "bg-slate-50/80" : "bg-white/80"}
                                          >
                                            <TableCell className="w-[4rem] pr-2" />
                                            <TableCell className="pl-2 text-sm italic text-slate-500 py-1.5">
                                              {split.name}
                                            </TableCell>
                                            <TableCell />
                                            <TableCell />
                                            <TableCell className="w-[7.5rem] text-right text-sm italic font-mono text-slate-500 tabular-nums py-1.5">
                                              {split.time ? normalizeTimeFormat(split.time) : "—"}
                                            </TableCell>
                                            <TableCell className="w-[6rem] pl-5" />
                                            {showProjection && <TableCell />}
                                            {showProjection && <TableCell />}
                                          </TableRow>
                                        ))}
                                    </Fragment>
                                  );
                                })}
                              </>
                            )}

                            {/* B Final Section */}
                            {bFinalEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-600 hover:bg-slate-600">
                                  <TableCell colSpan={totalCols} className="text-white font-semibold py-2">
                                    B Final (Places {bFinalRange.min}-{bFinalRange.max})
                                  </TableCell>
                                </TableRow>
                                {bFinalEntries.map((entry, idx) => {
                                  const relay = event.eventType === "relay" ? relayEntries.find((r) => r.id === entry.lineupId) : null;
                                  const splits = relay ? getRelaySplits(relay) : [];
                                  const isExpanded = expandedLineupId === entry.lineupId;
                                  const canExpandB = !isEditMode && (event.eventType === "relay" || hasSplitsData(entry.lineupId));
                                  const hasSplitsB = hasSplitsData(entry.lineupId);
                                  const onRowClickB = canExpandB ? () => toggleExpanded(entry.lineupId ?? undefined) : undefined;
                                  const splitsPayloadB = getSplitsPayloadForEntry(entry);
                                  const expansionIdB = `splits-expand-b-${entry.lineupId ?? idx}`;
                                  return (
                                    <Fragment key={entry.lineupId ?? `b-${idx}`}>
                                      <TableRow
                                        key={`b-${entry.athleteId}-${idx}`}
                                        className={`${idx % 2 === 0 ? "bg-slate-50" : "bg-white"} ${canExpandB ? "cursor-pointer hover:bg-slate-100/80" : ""}`}
                                        onClick={onRowClickB}
                                        role={onRowClickB ? "button" : undefined}
                                        tabIndex={onRowClickB ? 0 : undefined}
                                        aria-expanded={onRowClickB ? isExpanded : undefined}
                                        aria-controls={onRowClickB ? expansionIdB : undefined}
                                        onKeyDown={onRowClickB ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpanded(entry.lineupId ?? undefined); } } : undefined}
                                      >
                                        <TableCell className="w-[4rem] font-bold pr-2">
                                          <span className="flex items-center gap-2">
                                            <span className="inline-flex w-5 shrink-0 items-center justify-center">
                                              {event.eventType === "relay" || hasSplitsB ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                                            </span>
                                            {entry.place ?? "—"}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[16rem] font-medium pl-3 pr-4">
                                          {event.eventType === "relay" ? (entry.teamRelayLabel ?? entry.teamName) : (
                                            <span className="inline-flex items-center gap-1.5">
                                              {entry.athleteName}
                                              {entry.realAthleteId && testSpotSet.has(entry.realAthleteId) && (
                                                <Badge variant="secondary" className="text-xs font-normal">Test</Badge>
                                              )}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="w-[4rem] pl-1 text-left text-sm text-slate-500">
                                          {event.eventType !== "relay" ? (entry.year ?? "—") : ""}
                                        </TableCell>
                                        <TableCell className="pr-8">
                                          <span style={entry.teamColor ? { color: entry.teamColor, fontWeight: 600 } : {}}>{entry.teamName}</span>
                                        </TableCell>
                                        <TableCell className="w-[7.5rem] text-right">
                                          <span className="inline-flex items-center justify-end gap-1 w-full">
                                            {renderTimeCell(entry)}
                                            {hasSplitsB && <BarChart2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[6rem] text-right font-semibold text-green-600 pl-5">{entry.points > 0 ? entry.points.toFixed(1) : "-"}</TableCell>
                                        {renderProjectionCells(entry)}
                                      </TableRow>
                                      {isExpanded && hasSplitsB && splitsPayloadB && (
                                        <TableRow key={`b-expand-${entry.lineupId}`} className={idx % 2 === 0 ? "bg-slate-50/90" : "bg-white/90"}>
                                          <TableCell colSpan={totalCols} className="p-4 align-top border-l-4 border-slate-200" id={expansionIdB}>
                                            <SplitsDetailView
                                              type={splitsPayloadB.type}
                                              title={splitsPayloadB.title}
                                              eventName={splitsPayloadB.eventName}
                                              finalTime={splitsPayloadB.finalTime}
                                              splitsData={splitsPayloadB.splitsData}
                                              athleteIdToName={athleteIdToName}
                                              compact
                                            />
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {isExpanded && !hasSplitsB && event.eventType === "relay" && splits.length > 0 && splits.map((split, i) => (
                                        <TableRow key={`b-${entry.athleteId}-${idx}-split-${i}`} className={idx % 2 === 0 ? "bg-slate-50/80" : "bg-white/80"}>
                                          <TableCell className="w-[4rem] pr-2" />
                                          <TableCell className="text-sm italic text-slate-500 py-1.5">{split.name}</TableCell>
                                          <TableCell />
                                          <TableCell />
                                          <TableCell className="w-[7.5rem] text-right text-sm italic font-mono text-slate-500 tabular-nums py-1.5">{split.time ? normalizeTimeFormat(split.time) : "—"}</TableCell>
                                          <TableCell className="w-[6rem] pl-5" />
                                          {showProjection && <TableCell />}
                                          {showProjection && <TableCell />}
                                        </TableRow>
                                      ))}
                                    </Fragment>
                                  );
                                })}
                              </>
                            )}

                            {/* C Final Section */}
                            {cFinalEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-500 hover:bg-slate-500">
                                  <TableCell colSpan={totalCols} className="text-white font-semibold py-2">
                                    C Final (Places {cFinalRange.min}-{cFinalRange.max})
                                  </TableCell>
                                </TableRow>
                                {cFinalEntries.map((entry, idx) => {
                                  const relay = event.eventType === "relay" ? relayEntries.find((r) => r.id === entry.lineupId) : null;
                                  const splits = relay ? getRelaySplits(relay) : [];
                                  const isExpanded = expandedLineupId === entry.lineupId;
                                  const canExpandC = !isEditMode && (event.eventType === "relay" || hasSplitsData(entry.lineupId));
                                  const hasSplitsC = hasSplitsData(entry.lineupId);
                                  const onRowClickC = canExpandC ? () => toggleExpanded(entry.lineupId ?? undefined) : undefined;
                                  const splitsPayloadC = getSplitsPayloadForEntry(entry);
                                  const expansionIdC = `splits-expand-c-${entry.lineupId ?? idx}`;
                                  return (
                                    <Fragment key={entry.lineupId ?? `c-${idx}`}>
                                      <TableRow
                                        key={`c-${entry.athleteId}-${idx}`}
                                        className={`${idx % 2 === 0 ? "bg-slate-50" : "bg-white"} ${canExpandC ? "cursor-pointer hover:bg-slate-100/80" : ""}`}
                                        onClick={onRowClickC}
                                        role={onRowClickC ? "button" : undefined}
                                        tabIndex={onRowClickC ? 0 : undefined}
                                        aria-expanded={onRowClickC ? isExpanded : undefined}
                                        aria-controls={onRowClickC ? expansionIdC : undefined}
                                        onKeyDown={onRowClickC ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpanded(entry.lineupId ?? undefined); } } : undefined}
                                      >
                                        <TableCell className="w-[4rem] font-bold pr-2">
                                          <span className="flex items-center gap-2">
                                            <span className="inline-flex w-5 shrink-0 items-center justify-center">
                                              {event.eventType === "relay" || hasSplitsC ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                                            </span>
                                            {entry.place ?? "—"}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[16rem] font-medium pl-3 pr-4">
                                          {event.eventType === "relay" ? (entry.teamRelayLabel ?? entry.teamName) : (
                                            <span className="inline-flex items-center gap-1.5">
                                              {entry.athleteName}
                                              {entry.realAthleteId && testSpotSet.has(entry.realAthleteId) && (
                                                <Badge variant="secondary" className="text-xs font-normal">Test</Badge>
                                              )}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="w-[4rem] pl-1 text-left text-sm text-slate-500">
                                          {event.eventType !== "relay" ? (entry.year ?? "—") : ""}
                                        </TableCell>
                                        <TableCell className="pr-8">
                                          <span style={entry.teamColor ? { color: entry.teamColor, fontWeight: 600 } : {}}>{entry.teamName}</span>
                                        </TableCell>
                                        <TableCell className="w-[7.5rem] text-right">
                                          <span className="inline-flex items-center justify-end gap-1 w-full">
                                            {renderTimeCell(entry)}
                                            {hasSplitsC && <BarChart2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[6rem] text-right font-semibold text-green-600 pl-5">{entry.points > 0 ? entry.points.toFixed(1) : "-"}</TableCell>
                                        {renderProjectionCells(entry)}
                                      </TableRow>
                                      {isExpanded && hasSplitsC && splitsPayloadC && (
                                        <TableRow key={`c-expand-${entry.lineupId}`} className={idx % 2 === 0 ? "bg-slate-50/90" : "bg-white/90"}>
                                          <TableCell colSpan={totalCols} className="p-4 align-top border-l-4 border-slate-200" id={expansionIdC}>
                                            <SplitsDetailView
                                              type={splitsPayloadC.type}
                                              title={splitsPayloadC.title}
                                              eventName={splitsPayloadC.eventName}
                                              finalTime={splitsPayloadC.finalTime}
                                              splitsData={splitsPayloadC.splitsData}
                                              athleteIdToName={athleteIdToName}
                                              compact
                                            />
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {isExpanded && !hasSplitsC && event.eventType === "relay" && splits.length > 0 && splits.map((split, i) => (
                                        <TableRow key={`c-${entry.athleteId}-${idx}-split-${i}`} className={idx % 2 === 0 ? "bg-slate-50/80" : "bg-white/80"}>
                                          <TableCell className="w-[4rem] pr-2" />
                                          <TableCell className="text-sm italic text-slate-500 py-1.5">{split.name}</TableCell>
                                          <TableCell />
                                          <TableCell />
                                          <TableCell className="w-[7.5rem] text-right text-sm italic font-mono text-slate-500 tabular-nums py-1.5">{split.time ? normalizeTimeFormat(split.time) : "—"}</TableCell>
                                          <TableCell className="w-[6rem] pl-5" />
                                          {showProjection && <TableCell />}
                                          {showProjection && <TableCell />}
                                        </TableRow>
                                      ))}
                                    </Fragment>
                                  );
                                })}
                              </>
                            )}

                            {/* Non-Scorers Section */}
                            {nonScorerEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-400 hover:bg-slate-400">
                                  <TableCell colSpan={totalCols} className="text-white font-semibold py-2">
                                    Non-Scorers (Places {cFinalRange.max + 1}+)
                                  </TableCell>
                                </TableRow>
                                {nonScorerEntries.map((entry, idx) => {
                                  const relay = event.eventType === "relay" ? relayEntries.find((r) => r.id === entry.lineupId) : null;
                                  const splits = relay ? getRelaySplits(relay) : [];
                                  const isExpanded = expandedLineupId === entry.lineupId;
                                  const canExpandN = !isEditMode && (event.eventType === "relay" || hasSplitsData(entry.lineupId));
                                  const hasSplitsN = hasSplitsData(entry.lineupId);
                                  const onRowClickN = canExpandN ? () => toggleExpanded(entry.lineupId ?? undefined) : undefined;
                                  const splitsPayloadN = getSplitsPayloadForEntry(entry);
                                  const expansionIdN = `splits-expand-n-${entry.lineupId ?? idx}`;
                                  return (
                                    <Fragment key={entry.lineupId ?? `n-${idx}`}>
                                      <TableRow
                                        key={`nonscorer-${entry.athleteId}-${idx}`}
                                        className={`${idx % 2 === 0 ? "bg-slate-50" : "bg-white"} ${canExpandN ? "cursor-pointer hover:bg-slate-100/80" : ""}`}
                                        onClick={onRowClickN}
                                        role={onRowClickN ? "button" : undefined}
                                        tabIndex={onRowClickN ? 0 : undefined}
                                        aria-expanded={onRowClickN ? isExpanded : undefined}
                                        aria-controls={onRowClickN ? expansionIdN : undefined}
                                        onKeyDown={onRowClickN ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpanded(entry.lineupId ?? undefined); } } : undefined}
                                      >
                                        <TableCell className="w-[4rem] font-bold pr-2">
                                          <span className="flex items-center gap-2">
                                            <span className="inline-flex w-5 shrink-0 items-center justify-center">
                                              {event.eventType === "relay" || hasSplitsN ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                                            </span>
                                            {entry.place ?? "—"}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[16rem] font-medium pl-3 pr-4">
                                          {event.eventType === "relay" ? (entry.teamRelayLabel ?? entry.teamName) : (
                                            <span className="inline-flex items-center gap-1.5">
                                              {entry.athleteName}
                                              {entry.realAthleteId && testSpotSet.has(entry.realAthleteId) && (
                                                <Badge variant="secondary" className="text-xs font-normal">Test</Badge>
                                              )}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="w-[4rem] pl-1 text-left text-sm text-slate-500">
                                          {event.eventType !== "relay" ? (entry.year ?? "—") : ""}
                                        </TableCell>
                                        <TableCell className="pr-8">
                                          <span style={entry.teamColor ? { color: entry.teamColor, fontWeight: 600 } : {}}>{entry.teamName}</span>
                                        </TableCell>
                                        <TableCell className="w-[7.5rem] text-right">
                                          <span className="inline-flex items-center justify-end gap-1 w-full">
                                            {renderTimeCell(entry)}
                                            {hasSplitsN && <BarChart2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
                                          </span>
                                        </TableCell>
                                        <TableCell className="w-[6rem] text-right font-semibold text-slate-400 pl-5">-</TableCell>
                                        {renderProjectionCells(entry)}
                                      </TableRow>
                                      {isExpanded && hasSplitsN && splitsPayloadN && (
                                        <TableRow key={`nonscorer-expand-${entry.lineupId}`} className={idx % 2 === 0 ? "bg-slate-50/90" : "bg-white/90"}>
                                          <TableCell colSpan={totalCols} className="p-4 align-top border-l-4 border-slate-200" id={expansionIdN}>
                                            <SplitsDetailView
                                              type={splitsPayloadN.type}
                                              title={splitsPayloadN.title}
                                              eventName={splitsPayloadN.eventName}
                                              finalTime={splitsPayloadN.finalTime}
                                              splitsData={splitsPayloadN.splitsData}
                                              athleteIdToName={athleteIdToName}
                                              compact
                                            />
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {isExpanded && !hasSplitsN && event.eventType === "relay" && splits.length > 0 && splits.map((split, i) => (
                                        <TableRow key={`nonscorer-${entry.athleteId}-${idx}-split-${i}`} className={idx % 2 === 0 ? "bg-slate-50/80" : "bg-white/80"}>
                                          <TableCell className="w-[4rem] pr-2" />
                                          <TableCell className="text-sm italic text-slate-500 py-1.5">{split.name}</TableCell>
                                          <TableCell />
                                          <TableCell />
                                          <TableCell className="w-[7.5rem] text-right text-sm italic font-mono text-slate-500 tabular-nums py-1.5">{split.time ? normalizeTimeFormat(split.time) : "—"}</TableCell>
                                          <TableCell className="w-[6rem] pl-5" />
                                          {showProjection && <TableCell />}
                                          {showProjection && <TableCell />}
                                        </TableRow>
                                      ))}
                                    </Fragment>
                                  );
                                })}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
              {/* Override note and re-run button */}
              {!readOnly && !isEditMode && (
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  {hasOverrides && (
                    <p className="text-sm text-slate-500">
                      Times in <span className="text-red-600">red</span> have been manually overridden
                    </p>
                  )}
                  {hasOverrides && (
                    <Button
                      onClick={handleRerunSimulation}
                      disabled={simulating}
                      variant="default"
                    >
                      {simulating ? "Running..." : "Re-run Simulation"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          {/* Analytics Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {chartView === "points" ? "Point Distribution by Team" : "Team Depth Analysis"}
                  </CardTitle>
                  <CardDescription>
                    {chartView === "points"
                      ? "Total points scored by each team in this event"
                      : "Number of athletes/entries per team"}
                  </CardDescription>
                </div>
                <Select value={chartView} onValueChange={(value: "points" | "depth") => setChartView(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Point Distribution</SelectItem>
                    <SelectItem value="depth">Team Depth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No data available for this event.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb" }}
                      formatter={(value) => {
                        return [value ?? 0, chartView === "points" ? "Points" : "Entries"];
                      }}
                      labelFormatter={(label) => label}
                    />
                    <Bar 
                      dataKey={chartView === "points" ? "points" : "athleteCount"}
                      name={chartView === "points" ? "Points" : "Entries"}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.teamColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Detailed Team Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Team Performance Breakdown</CardTitle>
              <CardDescription>
                Detailed breakdown of each team's performance in this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Total Points</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                      <TableHead className="text-center">A Final</TableHead>
                      <TableHead className="text-center">B Final</TableHead>
                      <TableHead className="text-center">C Final</TableHead>
                      <TableHead className="text-center">Non-Scorer</TableHead>
                      <TableHead className="text-center">ROI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayStats.length === 0 || displayStats.every((s) => s.entries.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={totalCols} className="text-center py-8 text-slate-500">
                          No entries in this event.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayStats.map((stats) => {
                        const roi = stats.athleteCount > 0 
                          ? ((stats.aFinalCount / stats.athleteCount) * 100).toFixed(1)
                          : "0.0";

                        return (
                          <TableRow key={stats.teamId}>
                            <TableCell className="font-semibold">
                              <span
                                style={
                                  stats.teamColor
                                    ? { color: stats.teamColor, fontWeight: 600 }
                                    : {}
                                }
                              >
                                {stats.teamName}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {stats.totalPoints.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center">
                              {stats.athleteCount}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={stats.aFinalCount > 0 ? "default" : "outline"}>
                                {stats.aFinalCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={stats.bFinalCount > 0 ? "secondary" : "outline"}>
                                {stats.bFinalCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={stats.cFinalCount > 0 ? "outline" : "outline"}>
                                {stats.cFinalCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={stats.nonScorerCount > 0 ? "outline" : "outline"}>
                                {stats.nonScorerCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-medium">{roi}%</span>
                              <div className="text-xs text-slate-500">A Final %</div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
