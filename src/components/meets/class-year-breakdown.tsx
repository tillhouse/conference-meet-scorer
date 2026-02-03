"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface MeetLineup {
  id: string;
  athleteId: string;
  eventId: string;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  place: number | null;
  points: number | null;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    year: string | null;
    team: {
      id: string;
      name: string;
      primaryColor: string | null;
    };
  };
  event: {
    id: string;
    name: string;
    eventType: string;
  };
}

interface RelayEntry {
  id: string;
  teamId: string;
  eventId: string;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  place: number | null;
  points: number | null;
  members: string | null;
  team: {
    id: string;
    name: string;
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
  primaryColor: string | null;
}

interface ClassYearBreakdownProps {
  meetLineups: MeetLineup[];
  relayEntries: RelayEntry[];
  teams: Team[];
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
  scoringPlaces: number;
}

interface TeamClassYearStats {
  teamId: string;
  teamName: string;
  teamColor: string | null;
  classYears: {
    [year: string]: {
      points: number;
      athleteCount: number;
      eventCount: number;
    };
  };
  totalPoints: number;
}

const YEAR_ORDER = ["FR", "SO", "JR", "SR", "GR"];
const YEAR_LABELS: Record<string, string> = {
  FR: "Freshman",
  SO: "Sophomore",
  JR: "Junior",
  SR: "Senior",
  GR: "Graduate",
};

type SortField = "team" | "totalPoints" | "FR" | "SO" | "JR" | "SR" | "GR";
type SortDirection = "asc" | "desc";

export function ClassYearBreakdown({
  meetLineups,
  relayEntries,
  teams,
  individualScoring,
  relayScoring,
  scoringPlaces,
}: ClassYearBreakdownProps) {
  // Filter state
  const [athleteTypeFilter, setAthleteTypeFilter] = useState<string>("all");
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>("totalPoints");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Calculate relay totals for display in team rows
  const relayTotals = useMemo(() => {
    const teamRelayPoints = new Map<string, number>();
    
    relayEntries.forEach((relay) => {
      let points = 0;
      if (relay.points !== null) {
        points = relay.points;
      } else if (relay.place !== null && relay.place <= scoringPlaces) {
        points = relayScoring[relay.place.toString()] || 0;
      } else if (relay.seedTimeSeconds !== null) {
        const eventRelays = relayEntries.filter((r) => r.eventId === relay.eventId);
        const sorted = [...eventRelays].sort((a, b) => {
          const aTime = a.seedTimeSeconds ?? Infinity;
          const bTime = b.seedTimeSeconds ?? Infinity;
          return aTime - bTime;
        });
        const place = sorted.findIndex((r) => r.id === relay.id) + 1;
        if (place <= scoringPlaces) {
          points = relayScoring[place.toString()] || 0;
        }
      }
      
      const current = teamRelayPoints.get(relay.teamId) || 0;
      teamRelayPoints.set(relay.teamId, current + points);
    });
    
    return teamRelayPoints;
  }, [relayEntries, relayScoring, scoringPlaces]);

  // Calculate class year breakdown for each team
  const teamClassYearStats = useMemo(() => {
    const statsMap = new Map<string, TeamClassYearStats>();

    // Initialize stats for all teams
    teams.forEach((team) => {
      statsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        teamColor: team.primaryColor,
        classYears: {},
        totalPoints: 0,
      });
    });

    // Count unique athletes and events per year per team first (with filter)
    const athleteCounts = new Map<string, Set<string>>();
    const eventCounts = new Map<string, Set<string>>();
    
    meetLineups.forEach((lineup) => {
      // Apply athlete type filter
      const isDivingEvent = lineup.event.eventType === "diving";
      if (athleteTypeFilter === "swimmer" && isDivingEvent) return;
      if (athleteTypeFilter === "diver" && !isDivingEvent) return;
      
      const year = lineup.athlete.year || "Unknown";
      const key = `${lineup.athlete.team.id}-${year}`;
      
      if (!athleteCounts.has(key)) {
        athleteCounts.set(key, new Set());
      }
      athleteCounts.get(key)!.add(lineup.athleteId);
      
      if (!eventCounts.has(key)) {
        eventCounts.set(key, new Set());
      }
      eventCounts.get(key)!.add(lineup.eventId);
    });

    // Process individual events (swimming and diving) to calculate points
    meetLineups.forEach((lineup) => {
      // Filter by athlete type
      const isDivingEvent = lineup.event.eventType === "diving";
      if (athleteTypeFilter === "swimmer" && isDivingEvent) return;
      if (athleteTypeFilter === "diver" && !isDivingEvent) return;
      
      const teamId = lineup.athlete.team.id;
      const year = lineup.athlete.year || "Unknown";
      const stats = statsMap.get(teamId);

      if (!stats) return;

      // Initialize year if not exists
      if (!stats.classYears[year]) {
        const key = `${teamId}-${year}`;
        stats.classYears[year] = {
          points: 0,
          athleteCount: athleteCounts.get(key)?.size || 0,
          eventCount: eventCounts.get(key)?.size || 0,
        };
      }

      // Calculate points
      let points = 0;
      if (lineup.points !== null) {
        points = lineup.points;
      } else if (lineup.place !== null && lineup.place <= scoringPlaces) {
        points = individualScoring[lineup.place.toString()] || 0;
      } else if (lineup.seedTimeSeconds !== null) {
        // Calculate place from seed time
        const eventLineups = meetLineups.filter((l) => l.eventId === lineup.eventId);
        const sorted = [...eventLineups].sort((a, b) => {
          const aTime = a.seedTimeSeconds ?? Infinity;
          const bTime = b.seedTimeSeconds ?? Infinity;

          if (lineup.event.eventType === "diving") {
            return bTime - aTime;
          } else {
            return aTime - bTime;
          }
        });
        const place = sorted.findIndex((l) => l.id === lineup.id) + 1;
        if (place <= scoringPlaces) {
          points = individualScoring[place.toString()] || 0;
        }
      }

      stats.classYears[year].points += points;
      stats.totalPoints += points;
    });

    return Array.from(statsMap.values());
  }, [meetLineups, relayEntries, individualScoring, relayScoring, scoringPlaces, teams, athleteTypeFilter]);

  // Get all unique years across all teams
  const allYears = useMemo(() => {
    const years = new Set<string>();
    teamClassYearStats.forEach((teamStats) => {
      Object.keys(teamStats.classYears).forEach((year) => {
        if (year !== "Unknown") {
          years.add(year);
        }
      });
    });
    return Array.from(years).sort((a, b) => {
      const aIndex = YEAR_ORDER.indexOf(a);
      const bIndex = YEAR_ORDER.indexOf(b);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }, [teamClassYearStats]);

  // Calculate totals by year across all teams
  const yearTotals = useMemo(() => {
    const totals: { [year: string]: number } = {};
    allYears.forEach((year) => {
      totals[year] = teamClassYearStats.reduce((sum, teamStats) => {
        return sum + (teamStats.classYears[year]?.points || 0);
      }, 0);
    });
    return totals;
  }, [teamClassYearStats, allYears]);

  const grandTotal = teamClassYearStats.reduce((sum, teamStats) => sum + teamStats.totalPoints, 0);

  // Sort teams
  const sortedTeamStats = useMemo(() => {
    const sorted = [...teamClassYearStats];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === "team") {
        comparison = a.teamName.localeCompare(b.teamName);
      } else if (sortField === "totalPoints") {
        comparison = a.totalPoints - b.totalPoints;
      } else if (YEAR_ORDER.includes(sortField)) {
        const aPoints = a.classYears[sortField]?.points || 0;
        const bPoints = b.classYears[sortField]?.points || 0;
        comparison = aPoints - bPoints;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [teamClassYearStats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  if (teamClassYearStats.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No team data available for class year breakdown.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="min-w-[180px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Athlete Type</label>
          <Select value={athleteTypeFilter} onValueChange={setAthleteTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All athletes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Athletes</SelectItem>
              <SelectItem value="swimmer">Swimmers Only</SelectItem>
              <SelectItem value="diver">Divers Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {allYears.map((year) => (
          <div key={year} className="border rounded-lg p-4 bg-slate-50">
            <div className="text-sm text-slate-600 mb-1">{YEAR_LABELS[year] || year}</div>
            <div className="text-2xl font-bold text-slate-900">
              {yearTotals[year]?.toFixed(1) || "0.0"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {grandTotal > 0
                ? `${((yearTotals[year] / grandTotal) * 100).toFixed(1)}% of individual`
                : "0%"}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort("team")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Team
                  {getSortIcon("team")}
                </button>
              </TableHead>
              {allYears.map((year) => (
                <TableHead key={year} className="text-center">
                  <button
                    onClick={() => handleSort(year as SortField)}
                    className="flex items-center justify-center hover:text-slate-900 transition-colors w-full"
                  >
                    {YEAR_LABELS[year] || year}
                    {getSortIcon(year as SortField)}
                  </button>
                </TableHead>
              ))}
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("totalPoints")}
                  className="flex items-center justify-end hover:text-slate-900 transition-colors w-full"
                >
                  Total
                  {getSortIcon("totalPoints")}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTeamStats.map((teamStats) => (
              <TableRow key={teamStats.teamId}>
                <TableCell className="font-semibold">
                  <span
                    style={
                      teamStats.teamColor
                        ? { color: teamStats.teamColor, fontWeight: 600 }
                        : {}
                    }
                  >
                    {teamStats.teamName}
                  </span>
                </TableCell>
                {allYears.map((year) => {
                  const yearData = teamStats.classYears[year];
                  const points = yearData?.points || 0;
                  const percentage =
                    teamStats.totalPoints > 0
                      ? ((points / teamStats.totalPoints) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <TableCell key={year} className="text-center">
                      {points > 0 ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{points.toFixed(1)}</span>
                          <span className="text-xs text-slate-500">
                            {yearData?.athleteCount || 0} athletes
                          </span>
                          <span className="text-xs text-slate-400">
                            {percentage}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-lg">{teamStats.totalPoints.toFixed(1)}</span>
                    {relayTotals.get(teamStats.teamId) && (
                      <span className="text-xs text-slate-500">
                        +{relayTotals.get(teamStats.teamId)!.toFixed(1)} relay
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
