"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTeamName, formatName, formatTeamRelayLabel } from "@/lib/utils";
import { formatTableForSlack, buildSlackCopyString } from "@/lib/slack-copy";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor: string | null;
  shortName?: string | null;
}

interface MeetLineup {
  id: string;
  athleteId: string;
  eventId: string;
  points: number | null;
  place?: number | null;
  athlete: {
    id: string;
    firstName?: string;
    lastName?: string;
    team: {
      id: string;
    };
  };
  event: {
    id: string;
    eventType: string;
  };
}

interface MeetTeam {
  id: string;
  teamId: string;
  individualScore: number;
  divingScore: number;
  relayScore: number;
  totalScore: number;
  team: Team;
  testSpotAthleteIds?: string | null;
  testSpotScoringAthleteId?: string | null;
  exhibitionAthleteIds?: string | null;
  sensitivityAthleteIds?: string | null;
  sensitivityPercent?: number | null;
  sensitivityVariant?: string | null;
  sensitivityVariantAthleteId?: string | null;
  sensitivityResults?: string | null;
}

interface RelayEntry {
  id: string;
  teamId: string;
  eventId: string;
  points: number | null;
  place?: number | null;
  team: Team;
}

interface TeamStandingsProps {
  meetId?: string;
  meetName?: string;
  meetTeams: MeetTeam[];
  meetLineups: MeetLineup[];
  relayEntries?: RelayEntry[];
  durationDays?: number;
  eventDays?: Record<string, number> | null;
  projectedMeetTeams?: MeetTeam[];
  scoringMode?: string | null;
  scoringPlaces?: number;
}

type SortColumn = 
  | "team" 
  | "individual" 
  | "relays" 
  | "diving" 
  | "total"
  | "delta"
  | "swimmers"
  | "divers"
  | "ptsPerSwim"
  | "ptsPerDive"
  | "ptsPerSplash"
  | "day-1" | "day-2" | "day-3" | "day-4" | "day-5"
  | "finalsEntries"
  | "finalsA" | "finalsB" | "finalsC" | "finalsNon"
  | "finalsAFinalPct"
  | "finalsPtsPerEntry"
  | "day-1-pte" | "day-2-pte" | "day-3-pte" | "day-4-pte" | "day-5-pte";

type SortDirection = "asc" | "desc";

type ViewMode = "standard" | "advanced" | "dailyGrid" | "finalsBreakdown";
type DailyGridSubView = "subScore" | "cumulative";

export function TeamStandings({ meetId, meetName, meetTeams, meetLineups, relayEntries = [], durationDays = 1, eventDays = null, projectedMeetTeams, scoringMode, scoringPlaces = 24 }: TeamStandingsProps) {
  const router = useRouter();
  const showDelta = (scoringMode === "real" || scoringMode === "hybrid") && projectedMeetTeams != null && projectedMeetTeams.length > 0;
  const projectedByTeamId = useMemo(() => {
    const map = new Map<string, number>();
    projectedMeetTeams?.forEach((mt) => map.set(mt.teamId, mt.totalScore));
    return map;
  }, [projectedMeetTeams]);
  const getDelta = (teamId: string, currentTotal: number): number | null => {
    const projected = projectedByTeamId.get(teamId);
    if (projected == null) return null;
    return currentTotal - projected;
  };
  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  const [sortColumn, setSortColumn] = useState<SortColumn>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dailyGridSubView, setDailyGridSubView] = useState<DailyGridSubView>("subScore");

  const athleteIdToName = useMemo(() => {
    const map = new Map<string, string>();
    meetLineups.forEach((l) => {
      const a = l.athlete;
      if (a?.id && (a.firstName != null || a.lastName != null)) {
        map.set(a.id, formatName(a.firstName ?? "", a.lastName ?? ""));
      }
    });
    return map;
  }, [meetLineups]);

  const pointsByAthleteId = useMemo(() => {
    const map = new Map<string, number>();
    meetLineups.forEach((l) => {
      const current = map.get(l.athleteId) ?? 0;
      map.set(l.athleteId, current + (l.points ?? 0));
    });
    return map;
  }, [meetLineups]);

  // Reset sort to total when switching views
  useEffect(() => {
    setSortColumn("total");
    setSortDirection("desc");
  }, [viewMode]);

  // Per-team exhibition athlete IDs (excluded from all metrics)
  const exhibitionByTeamId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    meetTeams.forEach((mt) => {
      const ids = mt.exhibitionAthleteIds
        ? (typeof mt.exhibitionAthleteIds === "string" ? (JSON.parse(mt.exhibitionAthleteIds) as string[]) : mt.exhibitionAthleteIds)
        : [];
      map.set(mt.teamId, new Set(ids));
    });
    return map;
  }, [meetTeams]);

  // All event IDs that have entries in this meet (from lineups + relays)
  const allEventIdsInMeet = useMemo(
    () => new Set([...meetLineups.map((l) => l.eventId), ...relayEntries.map((r) => r.eventId)]),
    [meetLineups, relayEntries]
  );

  // Per-team, per-day total points (day index 0 = Day 1, etc.). Events not in eventDays default to Day 1.
  const pointsByTeamByDay = useMemo(() => {
    const days = durationDays < 1 ? 1 : durationDays;
    const map = new Map<string, number[]>();
    meetTeams.forEach((mt) => map.set(mt.teamId, Array.from({ length: days }, () => 0)));

    const eventToDay = (eid: string) => Number(eventDays?.[eid] ?? 1) - 1; // 0-based index

    meetLineups.forEach((lineup) => {
      const teamId = lineup.athlete.team.id;
      if (exhibitionByTeamId.get(teamId)?.has(lineup.athleteId)) return;
      const arr = map.get(teamId);
      if (!arr) return;
      const d = eventToDay(lineup.eventId);
      if (d >= 0 && d < arr.length) arr[d] += lineup.points ?? 0;
    });
    relayEntries.forEach((entry) => {
      const arr = map.get(entry.teamId);
      if (!arr) return;
      const d = eventToDay(entry.eventId);
      if (d >= 0 && d < arr.length) arr[d] += entry.points ?? 0;
    });

    return map;
  }, [meetTeams, meetLineups, relayEntries, durationDays, eventDays, exhibitionByTeamId]);

  // When filtering by day: compute standings from lineups/relays for events on that day only.
  // Events not in eventDays default to Day 1 (same as edit UI).
  const displayTeams = useMemo(() => {
    if (selectedDay == null || durationDays < 2) {
      return meetTeams;
    }
    const day = selectedDay;
    const eventIdSet = new Set<string>();
    allEventIdsInMeet.forEach((eid) => {
      const assignedDay = Number(eventDays?.[eid] ?? 1);
      if (assignedDay === day) eventIdSet.add(eid);
    });

    return meetTeams.map((mt) => {
      let individualScore = 0;
      let divingScore = 0;
      let relayScore = 0;
      meetLineups.forEach((lineup) => {
        if (!eventIdSet.has(lineup.eventId)) return;
        if (lineup.athlete.team.id !== mt.teamId) return;
        if (exhibitionByTeamId.get(mt.teamId)?.has(lineup.athleteId)) return;
        const pts = lineup.points ?? 0;
        if (lineup.event.eventType === "diving") divingScore += pts;
        else if (lineup.event.eventType === "individual") individualScore += pts;
      });
      relayEntries.forEach((entry) => {
        if (!eventIdSet.has(entry.eventId) || entry.teamId !== mt.teamId) return;
        relayScore += entry.points ?? 0;
      });
      const totalScore = individualScore + divingScore + relayScore;
      return {
        ...mt,
        individualScore,
        divingScore,
        relayScore,
        totalScore,
      };
    });
  }, [meetTeams, meetLineups, relayEntries, selectedDay, eventDays, durationDays, allEventIdsInMeet, exhibitionByTeamId]);

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to descending for numeric columns, ascending for team name
      setSortColumn(column);
      setSortDirection(column === "team" ? "asc" : "desc");
    }
  };

  // Event IDs on selected day (for filtering lineups in advanced stats). Events not in eventDays default to Day 1.
  const eventIdsOnSelectedDay = useMemo(() => {
    if (selectedDay == null) return null;
    const set = new Set<string>();
    allEventIdsInMeet.forEach((eid) => {
      if (Number(eventDays?.[eid] ?? 1) === selectedDay) set.add(eid);
    });
    return set;
  }, [selectedDay, eventDays, allEventIdsInMeet]);

  // Finals breakdown: A/B/C ranges and per-team (and per-day) aggregates. Only entries with numeric place count.
  const scoringPlacesNum = scoringPlaces ?? 24;
  const aFinalRange = { min: 1, max: Math.min(8, scoringPlacesNum) };
  const bFinalRange = { min: 9, max: Math.min(16, scoringPlacesNum) };
  const cFinalRange = { min: 17, max: Math.min(24, scoringPlacesNum) };

  type FinalsTeamStats = {
    teamId: string;
    totalPoints: number;
    entries: number;
    aFinalCount: number;
    bFinalCount: number;
    cFinalCount: number;
    nonScorerCount: number;
    dayPoints: number[];
    dayEntries: number[];
  };

  const finalsBreakdownStats = useMemo(() => {
    const days = durationDays < 1 ? 1 : durationDays;
    const map = new Map<string, FinalsTeamStats>();
    meetTeams.forEach((mt) => {
      map.set(mt.teamId, {
        teamId: mt.teamId,
        totalPoints: 0,
        entries: 0,
        aFinalCount: 0,
        bFinalCount: 0,
        cFinalCount: 0,
        nonScorerCount: 0,
        dayPoints: Array.from({ length: days }, () => 0),
        dayEntries: Array.from({ length: days }, () => 0),
      });
    });

    const eventToDayIndex = (eid: string) => Math.max(0, Math.min(days - 1, Number(eventDays?.[eid] ?? 1) - 1));

    const processEntry = (teamId: string, eventId: string, place: number, points: number, isExhibition: boolean) => {
      if (isExhibition) return;
      const stats = map.get(teamId);
      if (!stats) return;
      if (selectedDay != null) {
        const assignedDay = Number(eventDays?.[eventId] ?? 1);
        if (assignedDay !== selectedDay) return;
      }
      stats.entries++;
      stats.totalPoints += points;
      const d = eventToDayIndex(eventId);
      stats.dayPoints[d] += points;
      stats.dayEntries[d] += 1;

      if (place >= aFinalRange.min && place <= aFinalRange.max) stats.aFinalCount++;
      else if (place >= bFinalRange.min && place <= bFinalRange.max) stats.bFinalCount++;
      else if (place >= cFinalRange.min && place <= cFinalRange.max) stats.cFinalCount++;
      else stats.nonScorerCount++;
    };

    meetLineups.forEach((lineup) => {
      const place = lineup.place;
      if (place == null || typeof place !== "number") return;
      const teamId = lineup.athlete.team.id;
      const isExhibition = exhibitionByTeamId.get(teamId)?.has(lineup.athleteId) ?? false;
      processEntry(teamId, lineup.eventId, place, lineup.points ?? 0, isExhibition);
    });
    relayEntries.forEach((relay) => {
      const place = relay.place;
      if (place == null || typeof place !== "number") return;
      processEntry(relay.teamId, relay.eventId, place, relay.points ?? 0, false);
    });

    return map;
  }, [meetTeams, meetLineups, relayEntries, selectedDay, eventDays, durationDays, scoringPlacesNum, exhibitionByTeamId]);

  // Calculate advanced stats for each team (filter by selected day when set)
  const teamStats = useMemo(() => {
    const statsMap = new Map<string, {
      swimmers: Set<string>;
      divers: Set<string>;
      swims: number;
      dives: number;
      swimmingPoints: number;
      divingPoints: number;
    }>();

    meetTeams.forEach((meetTeam) => {
      statsMap.set(meetTeam.teamId, {
        swimmers: new Set(),
        divers: new Set(),
        swims: 0,
        dives: 0,
        swimmingPoints: 0,
        divingPoints: 0,
      });
    });

    meetLineups.forEach((lineup) => {
      if (eventIdsOnSelectedDay != null && !eventIdsOnSelectedDay.has(lineup.eventId)) return;
      const teamId = lineup.athlete.team.id;
      if (exhibitionByTeamId.get(teamId)?.has(lineup.athleteId)) return;
      const stats = statsMap.get(teamId);
      if (!stats) return;

      const points = lineup.points || 0;

      if (lineup.event.eventType === "diving") {
        stats.divers.add(lineup.athleteId);
        stats.dives++;
        stats.divingPoints += points;
      } else if (lineup.event.eventType === "individual") {
        stats.swimmers.add(lineup.athleteId);
        stats.swims++;
        stats.swimmingPoints += points;
      }
    });

    return statsMap;
  }, [meetTeams, meetLineups, eventIdsOnSelectedDay, exhibitionByTeamId]);

  // Sort teams based on selected column and direction (use displayTeams so day filter applies)
  const sortedTeams = useMemo(() => {
    const teams = [...displayTeams];
    
    return teams.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortColumn === "team") {
        aValue = a.team.name.toLowerCase();
        bValue = b.team.name.toLowerCase();
      } else if (sortColumn === "individual") {
        aValue = a.individualScore;
        bValue = b.individualScore;
      } else if (sortColumn === "relays") {
        aValue = a.relayScore;
        bValue = b.relayScore;
      } else if (sortColumn === "diving") {
        aValue = a.divingScore;
        bValue = b.divingScore;
      } else if (sortColumn === "total") {
        aValue = a.totalScore;
        bValue = b.totalScore;
      } else if (sortColumn === "delta") {
        aValue = getDelta(a.teamId, a.totalScore) ?? 0;
        bValue = getDelta(b.teamId, b.totalScore) ?? 0;
      } else if (
        sortColumn === "day-1" ||
        sortColumn === "day-2" ||
        sortColumn === "day-3" ||
        sortColumn === "day-4" ||
        sortColumn === "day-5"
      ) {
        const dayIndex = parseInt(sortColumn.split("-")[1], 10) - 1;
        const aDayPoints = pointsByTeamByDay.get(a.teamId) ?? [];
        const bDayPoints = pointsByTeamByDay.get(b.teamId) ?? [];
        if (dailyGridSubView === "subScore") {
          aValue = aDayPoints[dayIndex] ?? 0;
          bValue = bDayPoints[dayIndex] ?? 0;
        } else {
          aValue = aDayPoints.slice(0, dayIndex + 1).reduce((s, n) => s + n, 0);
          bValue = bDayPoints.slice(0, dayIndex + 1).reduce((s, n) => s + n, 0);
        }
      } else {
        // Advanced stats columns
        const aStats = teamStats.get(a.teamId);
        const bStats = teamStats.get(b.teamId);
        
        if (!aStats || !bStats) return 0;

        if (sortColumn === "swimmers") {
          aValue = aStats.swimmers.size;
          bValue = bStats.swimmers.size;
        } else if (sortColumn === "divers") {
          aValue = aStats.divers.size;
          bValue = bStats.divers.size;
        } else if (sortColumn === "ptsPerSwim") {
          aValue = aStats.swims > 0 ? aStats.swimmingPoints / aStats.swims : 0;
          bValue = bStats.swims > 0 ? bStats.swimmingPoints / bStats.swims : 0;
        } else if (sortColumn === "ptsPerDive") {
          aValue = aStats.dives > 0 ? aStats.divingPoints / aStats.dives : 0;
          bValue = bStats.dives > 0 ? bStats.divingPoints / bStats.dives : 0;
        } else if (sortColumn === "ptsPerSplash") {
          const aSplashes = aStats.swims + aStats.dives;
          const bSplashes = bStats.swims + bStats.dives;
          aValue = aSplashes > 0 ? (aStats.swimmingPoints + aStats.divingPoints) / aSplashes : 0;
          bValue = bSplashes > 0 ? (bStats.swimmingPoints + bStats.divingPoints) / bSplashes : 0;
        } else {
          return 0;
        }
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  }, [displayTeams, sortColumn, sortDirection, teamStats, pointsByTeamByDay, dailyGridSubView]);

  // Sorted teams for Finals Breakdown view (sort by finals stats)
  const sortedFinalsTeams = useMemo(() => {
    const teams = [...meetTeams];
    return teams.sort((a, b) => {
      const aStats = finalsBreakdownStats.get(a.teamId);
      const bStats = finalsBreakdownStats.get(b.teamId);
      if (!aStats || !bStats) return 0;
      let aValue: number | string;
      let bValue: number | string;
      if (sortColumn === "team") {
        aValue = a.team.name.toLowerCase();
        bValue = b.team.name.toLowerCase();
      } else if (sortColumn === "total") {
        aValue = aStats.totalPoints;
        bValue = bStats.totalPoints;
      } else if (sortColumn === "finalsEntries") {
        aValue = aStats.entries;
        bValue = bStats.entries;
      } else if (sortColumn === "finalsA") {
        aValue = aStats.aFinalCount;
        bValue = bStats.aFinalCount;
      } else if (sortColumn === "finalsB") {
        aValue = aStats.bFinalCount;
        bValue = bStats.bFinalCount;
      } else if (sortColumn === "finalsC") {
        aValue = aStats.cFinalCount;
        bValue = bStats.cFinalCount;
      } else if (sortColumn === "finalsNon") {
        aValue = aStats.nonScorerCount;
        bValue = bStats.nonScorerCount;
      } else if (sortColumn === "finalsAFinalPct") {
        aValue = aStats.entries > 0 ? (aStats.aFinalCount / aStats.entries) * 100 : 0;
        bValue = bStats.entries > 0 ? (bStats.aFinalCount / bStats.entries) * 100 : 0;
      } else if (sortColumn === "finalsPtsPerEntry") {
        aValue = aStats.entries > 0 ? aStats.totalPoints / aStats.entries : 0;
        bValue = bStats.entries > 0 ? bStats.totalPoints / bStats.entries : 0;
      } else if (
        sortColumn === "day-1" || sortColumn === "day-2" || sortColumn === "day-3" ||
        sortColumn === "day-4" || sortColumn === "day-5"
      ) {
        const dayIndex = parseInt(sortColumn.split("-")[1], 10) - 1;
        aValue = aStats.dayPoints[dayIndex] ?? 0;
        bValue = bStats.dayPoints[dayIndex] ?? 0;
      } else if (
        sortColumn === "day-1-pte" || sortColumn === "day-2-pte" || sortColumn === "day-3-pte" ||
        sortColumn === "day-4-pte" || sortColumn === "day-5-pte"
      ) {
        const dayIndex = parseInt(sortColumn.split("-")[1], 10) - 1;
        const aEnt = aStats.dayEntries[dayIndex] ?? 0;
        const bEnt = bStats.dayEntries[dayIndex] ?? 0;
        aValue = aEnt > 0 ? (aStats.dayPoints[dayIndex] ?? 0) / aEnt : 0;
        bValue = bEnt > 0 ? (bStats.dayPoints[dayIndex] ?? 0) / bEnt : 0;
      } else {
        return 0;
      }
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [meetTeams, finalsBreakdownStats, sortColumn, sortDirection]);

  // Helper to render sortable header
  const renderSortableHeader = (
    label: string,
    column: SortColumn,
    align: "left" | "right" = "left"
  ) => {
    const isActive = sortColumn === column;
    const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
    
    return (
      <button
        onClick={() => handleSort(column)}
        className={`group flex items-center gap-1 font-semibold text-xs text-slate-600 hover:text-slate-900 transition-colors ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          <Icon className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />
        )}
      </button>
    );
  };

  const handleCopyForSlack = () => {
    const daySuffix = selectedDay != null ? ` – Day ${selectedDay}` : "";
    const baseTitle = meetName ? `${meetName} – ` : "";

    let title: string;
    let table: string;

    if (viewMode === "standard") {
      title = `${baseTitle}Team Standings (Standard View)${daySuffix}`;
      const headers = ["Rank", "Team", "Individual", "Relays", "Diving", "Total"];
      if (showDelta) headers.push("vs Proj.", "Pts Behind");
      const firstTotal = sortedTeams[0]?.totalScore ?? 0;
      const rows = sortedTeams.map((mt, i) => {
        const r: string[] = [
          String(i + 1),
          formatTeamRelayLabel(mt.team),
          mt.individualScore.toFixed(1),
          mt.relayScore.toFixed(1),
          mt.divingScore.toFixed(1),
          mt.totalScore.toFixed(1),
        ];
        if (showDelta) {
          const delta = getDelta(mt.teamId, mt.totalScore);
          r.push(delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "--");
          r.push(i === 0 ? "-" : (firstTotal - mt.totalScore).toFixed(1));
        }
        return r;
      });
      const numCols = headers.length;
      const alignStandard: ("left" | "right")[] = ["left", "left", ...Array.from({ length: numCols - 2 }, () => "right")];
      table = formatTableForSlack({ headers, rows, align: alignStandard, maxColWidths: [5, 10, 10, 10, 10, 10, 10, 10] });
    } else if (viewMode === "advanced") {
      title = `${baseTitle}Team Standings (Advanced Stats)${daySuffix}`;
      const headers = ["Rank", "Team", "Swimmers", "Divers", "Pts/Swim", "Pts/Dive", "Pts/Splash", "Total"];
      const rows = sortedTeams.map((mt, i) => {
        const stats = teamStats.get(mt.teamId);
        if (!stats) return [String(i + 1), formatTeamRelayLabel(mt.team), "-", "-", "-", "-", "-", "-"];
        const ptsPerSwim = stats.swims > 0 ? (stats.swimmingPoints / stats.swims).toFixed(2) : "-";
        const ptsPerDive = stats.dives > 0 ? (stats.divingPoints / stats.dives).toFixed(2) : "-";
        const totalSplashes = stats.swims + stats.dives;
        const ptsPerSplash = totalSplashes > 0 ? ((stats.swimmingPoints + stats.divingPoints) / totalSplashes).toFixed(2) : "-";
        return [
          String(i + 1),
          formatTeamRelayLabel(mt.team),
          String(stats.swimmers.size),
          String(stats.divers.size),
          ptsPerSwim,
          ptsPerDive,
          ptsPerSplash,
          mt.totalScore.toFixed(1),
        ];
      });
      const alignAdvanced: ("left" | "right")[] = ["left", "left", "right", "right", "right", "right", "right", "right"];
      table = formatTableForSlack({ headers, rows, align: alignAdvanced, maxColWidths: [5, 10, 10, 8, 10, 10, 12, 10] });
    } else if (viewMode === "dailyGrid") {
      title = `${baseTitle}Team Standings (Daily Grid${dailyGridSubView === "cumulative" ? ", Cumulative" : ""})${daySuffix}`;
      const days = durationDays < 1 ? 1 : durationDays;
      const headers = ["Rank", "Team", ...Array.from({ length: days }, (_, i) => `Day ${i + 1}`), "Total"];
      const rows = sortedTeams.map((mt, i) => {
        const dayPoints = pointsByTeamByDay.get(mt.teamId) ?? [];
        let sum = 0;
        const cells: string[] = [String(i + 1), formatTeamRelayLabel(mt.team)];
        for (let d = 0; d < days; d++) {
          sum += dayPoints[d] ?? 0;
          cells.push((dailyGridSubView === "subScore" ? (dayPoints[d] ?? 0) : sum).toFixed(1));
        }
        cells.push(mt.totalScore.toFixed(1));
        return cells;
      });
      const alignDaily: ("left" | "right")[] = ["left", "left", ...Array.from({ length: days }, () => "right"), "right"];
      table = formatTableForSlack({ headers, rows, align: alignDaily, maxColWidths: [5, 10, ...Array(days).fill(8), 10] });
    } else if (viewMode === "finalsBreakdown") {
      title = `${baseTitle}Team Standings (Finals Breakdown)${daySuffix}`;
      const days = durationDays < 1 ? 1 : durationDays;
      const showDayCols = selectedDay == null && days > 1;
      const headers = ["Rank", "Team"];
      if (showDayCols) {
        for (let d = 0; d < days; d++) headers.push(`D${d + 1}`);
      }
      headers.push("Total", "Entries", "A", "B", "C", "Non", "A%");
      if (showDayCols) {
        for (let d = 0; d < days; d++) headers.push(`D${d + 1} P/E`);
      }
      headers.push("Pts/Entry");
      const rows = sortedFinalsTeams.map((mt, i) => {
        const stats = finalsBreakdownStats.get(mt.teamId)!;
        const roi = stats.entries > 0 ? ((stats.aFinalCount / stats.entries) * 100).toFixed(1) : "0.0";
        const ptsPerEntry = stats.entries > 0 ? (stats.totalPoints / stats.entries).toFixed(2) : "-";
        const r: string[] = [
          String(i + 1),
          formatTeamRelayLabel(mt.team),
        ];
        if (showDayCols) {
          for (let d = 0; d < days; d++) r.push((stats.dayPoints[d] ?? 0).toFixed(1));
        }
        r.push(stats.totalPoints.toFixed(1), String(stats.entries), String(stats.aFinalCount), String(stats.bFinalCount), String(stats.cFinalCount), String(stats.nonScorerCount), `${roi}%`);
        if (showDayCols) {
          for (let d = 0; d < days; d++) {
            const ent = stats.dayEntries[d] ?? 0;
            r.push(ent > 0 ? ((stats.dayPoints[d] ?? 0) / ent).toFixed(2) : "-");
          }
        }
        r.push(ptsPerEntry);
        return r;
      });
      const nCols = headers.length;
      const alignFinals: ("left" | "right")[] = ["left", "left", ...Array.from({ length: nCols - 2 }, () => "right")];
      table = formatTableForSlack({ headers, rows, align: alignFinals });
    } else {
      return;
    }

    const full = buildSlackCopyString(table, title);
    navigator.clipboard.writeText(full).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy")
    );
  };

  if (meetTeams.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Team Standings</CardTitle>
              <CardDescription className="text-sm">
                Current standings for all participating teams
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6 text-slate-500 text-sm">
            <p>No teams added yet. Add teams to start scoring.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Team Standings</CardTitle>
            <CardDescription className="text-sm">
              {viewMode === "advanced"
                ? "Advanced statistics for all participating teams"
                : viewMode === "dailyGrid"
                  ? dailyGridSubView === "cumulative"
                    ? "Cumulative points through each day"
                    : "Points scored each day"
                  : viewMode === "finalsBreakdown"
                    ? "A/B/C final and non-scorer counts, points per day, and points per entry"
                    : selectedDay != null
                      ? `Points scored on Day ${selectedDay} only`
                      : "Current standings for all participating teams"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {durationDays > 1 && (
              <Select
                key="day-filter"
                value={selectedDay == null ? "all" : String(selectedDay)}
                onValueChange={(v) => setSelectedDay(v === "all" ? null : parseInt(v, 10))}
              >
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue placeholder="Filter by day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" key="all">All days</SelectItem>
                  {Array.from({ length: durationDays }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {viewMode === "dailyGrid" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Show:</span>
                <Button
                  variant={dailyGridSubView === "subScore" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setDailyGridSubView("subScore")}
                >
                  Daily Points
                </Button>
                <Button
                  variant={dailyGridSubView === "cumulative" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setDailyGridSubView("cumulative")}
                >
                  Cumulative Points
                </Button>
              </div>
            )}
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <SelectTrigger className="w-[160px]" size="sm">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard" key="standard">Standard View</SelectItem>
                <SelectItem value="advanced" key="advanced">Advanced Stats</SelectItem>
                {durationDays > 1 && (
                  <SelectItem value="dailyGrid" key="dailyGrid">Daily Grid</SelectItem>
                )}
                {scoringPlaces != null && (
                  <SelectItem value="finalsBreakdown" key="finalsBreakdown">Finals Breakdown</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={handleCopyForSlack} aria-label="Copy table for Slack">
              <Copy className="h-4 w-4 mr-2" />
              Copy for Slack
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {viewMode === "dailyGrid" ? (
          // Daily Grid View - table starts immediately for consistent positioning
          <div className="space-y-0 overflow-x-auto">
              <div
                className="grid gap-2 border-b pb-1.5 min-w-[400px]"
                style={{
                  gridTemplateColumns: `40px repeat(${durationDays + 2}, minmax(0, 1fr))`,
                }}
              >
                <div className="font-semibold text-xs text-slate-600">Rank</div>
                {renderSortableHeader("Team", "team", "left")}
                {Array.from({ length: durationDays }, (_, i) => {
                  const dayCol = `day-${i + 1}` as SortColumn;
                  return (
                    <div key={i} className="flex justify-end">
                      {renderSortableHeader(`Day ${i + 1}`, dayCol, "right")}
                    </div>
                  );
                })}
                <div className="flex justify-end">
                  {renderSortableHeader("Total", "total", "right")}
                </div>
              </div>
              {sortedTeams.map((meetTeam, index) => {
                const dayPoints = pointsByTeamByDay.get(meetTeam.teamId) ?? [];
                const cumulative: number[] = [];
                let sum = 0;
                for (let d = 0; d < dayPoints.length; d++) {
                  sum += dayPoints[d];
                  cumulative[d] = sum;
                }
                return (
                  <div
                    key={meetTeam.id}
                    className="grid gap-2 items-center py-2 border-b last:border-0 hover:bg-slate-50 transition-colors min-w-[400px]"
                    style={{
                      gridTemplateColumns: `40px repeat(${durationDays + 2}, minmax(0, 1fr))`,
                    }}
                  >
                    <div className="font-bold text-sm">{index + 1}</div>
                    <div
                      className="font-semibold text-sm"
                      style={
                        meetTeam.team.primaryColor
                          ? { color: meetTeam.team.primaryColor, fontWeight: 600 }
                          : {}
                      }
                    >
                      {formatTeamName(meetTeam.team.name, meetTeam.team.schoolName)}
                    </div>
                    {Array.from({ length: durationDays }, (_, i) => (
                      <div key={i} className="text-right font-medium text-sm">
                        {(dailyGridSubView === "subScore" ? dayPoints[i] : cumulative[i] ?? 0).toFixed(1)}
                      </div>
                    ))}
                    <div className="text-right font-bold text-sm">
                      {meetTeam.totalScore.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
        ) : viewMode === "finalsBreakdown" ? (
          // Finals Breakdown View
          <div className="space-y-0 overflow-x-auto">
            {scoringPlaces == null ? (
              <div className="py-6 text-center text-slate-500 text-sm">
                Finals breakdown requires meet scoring places.
              </div>
            ) : (() => {
              const days = durationDays < 1 ? 1 : durationDays;
              const showDayColumns = selectedDay == null && days > 1;
              const gridCols = `40px 1fr ${showDayColumns ? Array.from({ length: days }, () => "minmax(0,1fr)").join(" ") + " " : ""}minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)${showDayColumns ? " " + Array.from({ length: days }, () => "minmax(0,1fr)").join(" ") : ""} minmax(0,1fr)`;
              return (
                <>
                  <div
                    className="grid gap-2 border-b pb-1.5 min-w-[500px]"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <div className="font-semibold text-xs text-slate-600">Rank</div>
                    {renderSortableHeader("Team", "team", "left")}
                    {showDayColumns && Array.from({ length: days }, (_, i) => (
                      <div key={`d${i}`} className="flex justify-end">
                        {renderSortableHeader(`Day ${i + 1}`, `day-${i + 1}` as SortColumn, "right")}
                      </div>
                    ))}
                    {renderSortableHeader("Total", "total", "right")}
                    {renderSortableHeader("Entries", "finalsEntries", "right")}
                    {renderSortableHeader("A Final", "finalsA", "right")}
                    {renderSortableHeader("B Final", "finalsB", "right")}
                    {renderSortableHeader("C Final", "finalsC", "right")}
                    {renderSortableHeader("Non-Scorer", "finalsNon", "right")}
                    {renderSortableHeader("A Final %", "finalsAFinalPct", "right")}
                    {showDayColumns && Array.from({ length: days }, (_, i) => (
                      <div key={`pte${i}`} className="flex justify-end">
                        {renderSortableHeader(`Day ${i + 1} Pts/Entry`, `day-${i + 1}-pte` as SortColumn, "right")}
                      </div>
                    ))}
                    {renderSortableHeader("Pts/Entry", "finalsPtsPerEntry", "right")}
                  </div>
                  {sortedFinalsTeams.map((meetTeam, index) => {
                    const stats = finalsBreakdownStats.get(meetTeam.teamId)!;
                    const roi = stats.entries > 0 ? ((stats.aFinalCount / stats.entries) * 100).toFixed(1) : "0.0";
                    const ptsPerEntry = stats.entries > 0 ? stats.totalPoints / stats.entries : null;
                    return (
                      <div
                        key={meetTeam.id}
                        className="grid gap-2 items-center py-2 border-b last:border-0 hover:bg-slate-50 transition-colors min-w-[500px]"
                        style={{ gridTemplateColumns: gridCols }}
                      >
                        <div className="font-bold text-sm">{index + 1}</div>
                        <div
                          className="font-semibold text-sm"
                          style={meetTeam.team.primaryColor ? { color: meetTeam.team.primaryColor, fontWeight: 600 } : {}}
                        >
                          {formatTeamName(meetTeam.team.name, meetTeam.team.schoolName)}
                        </div>
                        {showDayColumns && stats.dayPoints.map((pts, i) => (
                          <div key={i} className="text-right font-medium text-sm">{pts.toFixed(1)}</div>
                        ))}
                        <div className="text-right font-bold text-sm">{stats.totalPoints.toFixed(1)}</div>
                        <div className="text-right font-medium text-sm">{stats.entries}</div>
                        <div className="text-right font-medium text-sm">{stats.aFinalCount}</div>
                        <div className="text-right">
                          <Badge variant={stats.bFinalCount > 0 ? "secondary" : "outline"}>{stats.bFinalCount}</Badge>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{stats.cFinalCount}</Badge>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{stats.nonScorerCount}</Badge>
                        </div>
                        <div className="text-right font-medium text-sm">{roi}%</div>
                        {showDayColumns && Array.from({ length: days }, (_, i) => {
                          const ent = stats.dayEntries[i] ?? 0;
                          const val = ent > 0 ? (stats.dayPoints[i] ?? 0) / ent : null;
                          return (
                            <div key={i} className="text-right font-medium text-sm">
                              {val != null ? val.toFixed(2) : "-"}
                            </div>
                          );
                        })}
                        <div className="text-right font-medium text-sm">
                          {ptsPerEntry != null ? ptsPerEntry.toFixed(2) : "-"}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        ) : viewMode === "standard" ? (
          // Standard View
          <div className="space-y-0">
            <div className="grid gap-2 border-b pb-1.5" style={{ gridTemplateColumns: `40px 1fr repeat(${showDelta ? 6 : 5}, minmax(0, 1fr))` }}>
              <div className="font-semibold text-xs text-slate-600">Rank</div>
              {renderSortableHeader("Team", "team", "left")}
              {renderSortableHeader("Individual", "individual", "right")}
              {renderSortableHeader("Relays", "relays", "right")}
              {renderSortableHeader("Diving", "diving", "right")}
              {renderSortableHeader("Total", "total", "right")}
              {showDelta && renderSortableHeader("vs Proj.", "delta", "right")}
              <div className="font-semibold text-xs text-slate-600 text-right">Points Behind</div>
            </div>
            {sortedTeams.map((meetTeam, index) => {
              type SensResult = { athleteId: string; teamTotalBetter: number; teamTotalWorse: number; athletePtsBaseline: number; athletePtsBetter: number; athletePtsWorse: number };
              const getSensResults = (mt: MeetTeam): SensResult[] => {
                const raw = mt.sensitivityResults;
                if (!raw) return [];
                try {
                  return JSON.parse(raw) as SensResult[];
                } catch {
                  return [];
                }
              };
              const getActiveSensResult = (mt: MeetTeam): SensResult | null => {
                const results = getSensResults(mt);
                const ids: string[] = mt.sensitivityAthleteIds
                  ? (typeof mt.sensitivityAthleteIds === "string" ? (JSON.parse(mt.sensitivityAthleteIds) as string[]) : mt.sensitivityAthleteIds)
                  : [];
                const aid = mt.sensitivityVariantAthleteId ?? ids[0] ?? null;
                if (!aid || results.length === 0) return null;
                return results.find((r) => r.athleteId === aid) ?? results[0] ?? null;
              };
              const getDisplayedTotal = (mt: MeetTeam) => {
                const v = mt.sensitivityVariant ?? "baseline";
                const active = getActiveSensResult(mt);
                if (v === "better" && active != null) return active.teamTotalBetter;
                if (v === "worse" && active != null) return active.teamTotalWorse;
                return mt.totalScore;
              };
              const displayedTotal = getDisplayedTotal(meetTeam);
              const firstPlaceScore = Math.max(...sortedTeams.map((t) => getDisplayedTotal(t)), 0);
              const pointsBehind = index === 0 ? null : firstPlaceScore - displayedTotal;
              const testSpotIds: string[] = meetTeam.testSpotAthleteIds
                ? (typeof meetTeam.testSpotAthleteIds === "string"
                    ? (JSON.parse(meetTeam.testSpotAthleteIds) as string[])
                    : meetTeam.testSpotAthleteIds)
                : [];
              const hasTestSpot = testSpotIds.length > 0;
              const scoringId = meetTeam.testSpotScoringAthleteId ?? testSpotIds[0];
              const sensResults = getSensResults(meetTeam);
              const sensAthleteIds: string[] = meetTeam.sensitivityAthleteIds
                ? (typeof meetTeam.sensitivityAthleteIds === "string" ? (JSON.parse(meetTeam.sensitivityAthleteIds) as string[]) : meetTeam.sensitivityAthleteIds)
                : [];
              const hasSensitivity = sensAthleteIds.length > 0 && sensResults.length > 0;
              const sensPercent = meetTeam.sensitivityPercent ?? 1;
              const sensVariant = meetTeam.sensitivityVariant ?? "baseline";
              const sensVariantAthleteId = meetTeam.sensitivityVariantAthleteId ?? sensAthleteIds[0] ?? null;
              const activeSensResult = getActiveSensResult(meetTeam);

              const delta = showDelta ? getDelta(meetTeam.teamId, displayedTotal) : null;

              return (
                <div
                  key={meetTeam.id}
                  className="grid gap-2 items-center py-2 border-b last:border-0 hover:bg-slate-50 transition-colors"
                  style={{ gridTemplateColumns: `40px 1fr repeat(${showDelta ? 6 : 5}, minmax(0, 1fr))` }}
                >
                  <div className="font-bold text-sm">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm" style={meetTeam.team.primaryColor ? { color: meetTeam.team.primaryColor, fontWeight: 600 } : {}}>
                      {formatTeamName(meetTeam.team.name, meetTeam.team.schoolName)}
                    </div>
                    {hasTestSpot && meetId && (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Test spot:</span>
                          {testSpotIds.length > 1 ? (
                            <Select
                              value={scoringId ?? ""}
                              onValueChange={async (val) => {
                                try {
                                  const res = await fetch(
                                    `/api/meets/${meetId}/rosters/${meetTeam.teamId}/scoring-athlete`,
                                    {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ scoringAthleteId: val }),
                                    }
                                  );
                                  if (!res.ok) throw new Error((await res.json()).error);
                                  toast.success("Scoring athlete updated");
                                  router.refresh();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed to update");
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {testSpotIds.map((id) => (
                                  <SelectItem key={id} value={id}>
                                    {athleteIdToName.get(id) ?? id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-slate-600">
                              {scoringId ? athleteIdToName.get(scoringId) ?? scoringId : "—"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          Projected pts:{" "}
                          {[...testSpotIds]
                            .sort((a, b) => (pointsByAthleteId.get(b) ?? 0) - (pointsByAthleteId.get(a) ?? 0))
                            .map((id) => {
                              const name = athleteIdToName.get(id) ?? id;
                              const pts = pointsByAthleteId.get(id) ?? 0;
                              return `${name} ${pts.toFixed(1)}`;
                            })
                            .join(", ")}
                        </div>
                      </div>
                    )}
                    {hasSensitivity && meetId && (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">Sensitivity:</span>
                          {sensAthleteIds.length > 1 && (
                            <Select
                              value={sensVariantAthleteId ?? ""}
                              onValueChange={async (athleteId: string) => {
                                try {
                                  const res = await fetch(
                                    `/api/meets/${meetId}/rosters/${meetTeam.teamId}/sensitivity-variant`,
                                    {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ variant: sensVariant, athleteId }),
                                    }
                                  );
                                  if (!res.ok) throw new Error((await res.json()).error);
                                  toast.success("Sensitivity athlete updated");
                                  router.refresh();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed to update");
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue placeholder="Athlete" />
                              </SelectTrigger>
                              <SelectContent>
                                {sensAthleteIds.map((id) => (
                                  <SelectItem key={id} value={id}>
                                    {athleteIdToName.get(id) ?? id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Select
                            value={sensVariant}
                            onValueChange={async (val: "baseline" | "better" | "worse") => {
                              try {
                                const res = await fetch(
                                  `/api/meets/${meetId}/rosters/${meetTeam.teamId}/sensitivity-variant`,
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ variant: val, athleteId: sensVariantAthleteId ?? undefined }),
                                  }
                                );
                                if (!res.ok) throw new Error((await res.json()).error);
                                toast.success("Sensitivity variant updated");
                                router.refresh();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed to update");
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="baseline">Baseline</SelectItem>
                              <SelectItem value="better">Better ({sensPercent}%)</SelectItem>
                              <SelectItem value="worse">Worse ({sensPercent}%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {activeSensResult && (
                          <div className="text-xs text-slate-500">
                            {athleteIdToName.get(activeSensResult.athleteId) ?? activeSensResult.athleteId}
                            {" · "}
                            Baseline {activeSensResult.athletePtsBaseline.toFixed(1)} pts
                            {" · "}
                            Better ({sensPercent}%) {activeSensResult.athletePtsBetter.toFixed(1)} pts
                            {" · "}
                            Worse ({sensPercent}%) {activeSensResult.athletePtsWorse.toFixed(1)} pts
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-medium text-sm">{meetTeam.individualScore.toFixed(1)}</div>
                  <div className="text-right font-medium text-sm">{meetTeam.relayScore.toFixed(1)}</div>
                  <div className="text-right font-medium text-sm">{meetTeam.divingScore.toFixed(1)}</div>
                  <div className="text-right font-bold text-sm">
                    {displayedTotal.toFixed(1)}
                  </div>
                  {showDelta && (
                    <div className={`text-right font-semibold text-sm ${delta != null && delta > 0 ? "text-green-600" : delta != null && delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                      {delta == null ? "--" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </div>
                  )}
                  <div className="text-right font-medium text-sm text-slate-600">
                    {pointsBehind === null ? "-" : pointsBehind.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Advanced Stats View
          <div className="space-y-0">
            <div className="grid gap-2 border-b pb-1.5" style={{ gridTemplateColumns: "40px 1fr repeat(6, minmax(0, 1fr))" }}>
              <div className="font-semibold text-xs text-slate-600">Rank</div>
              {renderSortableHeader("Team", "team", "left")}
              {renderSortableHeader("Swimmers", "swimmers", "right")}
              {renderSortableHeader("Divers", "divers", "right")}
              {renderSortableHeader("Pts/Swim", "ptsPerSwim", "right")}
              {renderSortableHeader("Pts/Dive", "ptsPerDive", "right")}
              {renderSortableHeader("Pts/Splash", "ptsPerSplash", "right")}
              {renderSortableHeader("Total", "total", "right")}
            </div>
            {sortedTeams.map((meetTeam, index) => {
              const stats = teamStats.get(meetTeam.teamId);
              if (!stats) return null;

              const swimmerCount = stats.swimmers.size;
              const diverCount = stats.divers.size;
              const pointsPerSwim = stats.swims > 0 ? stats.swimmingPoints / stats.swims : 0;
              const pointsPerDive = stats.dives > 0 ? stats.divingPoints / stats.dives : 0;
              const totalSplashes = stats.swims + stats.dives;
              const pointsPerSplash = totalSplashes > 0 
                ? (stats.swimmingPoints + stats.divingPoints) / totalSplashes 
                : 0;

              return (
                <div
                  key={meetTeam.id}
                  className="grid gap-2 items-center py-2 border-b last:border-0 hover:bg-slate-50 transition-colors"
                  style={{ gridTemplateColumns: "40px 1fr repeat(6, minmax(0, 1fr))" }}
                >
                  <div className="font-bold text-sm">{index + 1}</div>
                  <div className="font-semibold text-sm" style={meetTeam.team.primaryColor ? { color: meetTeam.team.primaryColor, fontWeight: 600 } : {}}>
                    {formatTeamName(meetTeam.team.name, meetTeam.team.schoolName)}
                  </div>
                  <div className="text-right font-medium text-sm">{swimmerCount}</div>
                  <div className="text-right font-medium text-sm">{diverCount}</div>
                  <div className="text-right font-medium text-sm">
                    {pointsPerSwim > 0 ? pointsPerSwim.toFixed(2) : "-"}
                  </div>
                  <div className="text-right font-medium text-sm">
                    {pointsPerDive > 0 ? pointsPerDive.toFixed(2) : "-"}
                  </div>
                  <div className="text-right font-medium text-sm">
                    {pointsPerSplash > 0 ? pointsPerSplash.toFixed(2) : "-"}
                  </div>
                  <div className="text-right font-bold text-sm">
                    {meetTeam.totalScore.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
