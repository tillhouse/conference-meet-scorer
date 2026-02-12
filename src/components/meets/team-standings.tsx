"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, List, ArrowUp, ArrowDown } from "lucide-react";
import { formatTeamName } from "@/lib/utils";

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
}

interface TeamStandingsProps {
  meetTeams: MeetTeam[];
  meetLineups: MeetLineup[];
  simulateButton?: React.ReactNode;
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
  | "ptsPerSplash";

type SortDirection = "asc" | "desc";

export function TeamStandings({ meetTeams, meetLineups, simulateButton }: TeamStandingsProps) {
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Reset sort to total when switching views
  useEffect(() => {
    setSortColumn("total");
    setSortDirection("desc");
  }, [showAdvancedStats]);

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

  // Calculate advanced stats for each team
  const teamStats = useMemo(() => {
    const statsMap = new Map<string, {
      swimmers: Set<string>;
      divers: Set<string>;
      swims: number;
      dives: number;
      swimmingPoints: number;
      divingPoints: number;
    }>();

    // Initialize all teams
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

    // Process lineups
    meetLineups.forEach((lineup) => {
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
  }, [meetTeams, meetLineups]);

  // Sort teams based on selected column and direction
  const sortedTeams = useMemo(() => {
    const teams = [...meetTeams];
    
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
  }, [meetTeams, sortColumn, sortDirection, teamStats]);

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
              {showAdvancedStats 
                ? "Advanced statistics for all participating teams"
                : "Current standings for all participating teams"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {simulateButton}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedStats(!showAdvancedStats)}
            >
              {showAdvancedStats ? (
                <>
                  <List className="h-4 w-4 mr-2" />
                  Standard View
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Advanced Stats
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!showAdvancedStats ? (
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
              // Calculate points behind first place
              const firstPlaceScore = sortedTeams[0]?.totalScore || 0;
              const pointsBehind = index === 0 
                ? null 
                : firstPlaceScore - meetTeam.totalScore;
              
              return (
                <div
                  key={meetTeam.id}
                  className="grid gap-2 items-center py-2 border-b last:border-0 hover:bg-slate-50 transition-colors"
                  style={{ gridTemplateColumns: "40px 1fr repeat(5, minmax(0, 1fr))" }}
                >
                  <div className="font-bold text-sm">{index + 1}</div>
                  <div className="font-semibold text-sm" style={meetTeam.team.primaryColor ? { color: meetTeam.team.primaryColor, fontWeight: 600 } : {}}>
                    {formatTeamName(meetTeam.team.name, meetTeam.team.schoolName)}
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
