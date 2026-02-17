"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTeamName, formatName } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor: string | null;
}

interface MeetLineup {
  id: string;
  athleteId: string;
  eventId: string;
  points: number | null;
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
}

interface RelayEntry {
  id: string;
  teamId: string;
  eventId: string;
  points: number | null;
  team: Team;
}

interface TeamStandingsProps {
  meetId?: string;
  meetTeams: MeetTeam[];
  meetLineups: MeetLineup[];
  relayEntries?: RelayEntry[];
  durationDays?: number;
  eventDays?: Record<string, number> | null;
}

type SortColumn = 
  | "team" 
  | "individual" 
  | "relays" 
  | "diving" 
  | "total"
  | "swimmers"
  | "divers"
  | "ptsPerSwim"
  | "ptsPerDive"
  | "ptsPerSplash"
  | "day-1" | "day-2" | "day-3" | "day-4" | "day-5";

type SortDirection = "asc" | "desc";

type ViewMode = "standard" | "advanced" | "dailyGrid";
type DailyGridSubView = "subScore" | "cumulative";

export function TeamStandings({ meetId, meetTeams, meetLineups, relayEntries = [], durationDays = 1, eventDays = null }: TeamStandingsProps) {
  const router = useRouter();
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
  }, [meetTeams, meetLineups, relayEntries, durationDays, eventDays]);

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
  }, [meetTeams, meetLineups, relayEntries, selectedDay, eventDays, durationDays, allEventIdsInMeet]);

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
  }, [meetTeams, meetLineups, eventIdsOnSelectedDay]);

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
              </SelectContent>
            </Select>
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
        ) : viewMode === "standard" ? (
          // Standard View
          <div className="space-y-0">
            <div className="grid gap-2 border-b pb-1.5" style={{ gridTemplateColumns: "40px 1fr repeat(5, minmax(0, 1fr))" }}>
              <div className="font-semibold text-xs text-slate-600">Rank</div>
              {renderSortableHeader("Team", "team", "left")}
              {renderSortableHeader("Individual", "individual", "right")}
              {renderSortableHeader("Relays", "relays", "right")}
              {renderSortableHeader("Diving", "diving", "right")}
              {renderSortableHeader("Total", "total", "right")}
              <div className="font-semibold text-xs text-slate-600 text-right">Points Behind</div>
            </div>
            {sortedTeams.map((meetTeam, index) => {
              const firstPlaceScore = sortedTeams[0]?.totalScore || 0;
              const pointsBehind = index === 0 ? null : firstPlaceScore - meetTeam.totalScore;
              const testSpotIds: string[] = meetTeam.testSpotAthleteIds
                ? (typeof meetTeam.testSpotAthleteIds === "string"
                    ? (JSON.parse(meetTeam.testSpotAthleteIds) as string[])
                    : meetTeam.testSpotAthleteIds)
                : [];
              const hasTestSpot = testSpotIds.length > 0;
              const scoringId = meetTeam.testSpotScoringAthleteId ?? testSpotIds[0];

              return (
                <div
                  key={meetTeam.id}
                  className="grid gap-2 items-center py-2 border-b last:border-0 hover:bg-slate-50 transition-colors"
                  style={{ gridTemplateColumns: "40px 1fr repeat(5, minmax(0, 1fr))" }}
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
                  </div>
                  <div className="text-right font-medium text-sm">{meetTeam.individualScore.toFixed(1)}</div>
                  <div className="text-right font-medium text-sm">{meetTeam.relayScore.toFixed(1)}</div>
                  <div className="text-right font-medium text-sm">{meetTeam.divingScore.toFixed(1)}</div>
                  <div className="text-right font-bold text-sm">
                    {meetTeam.totalScore.toFixed(1)}
                  </div>
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
