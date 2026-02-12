"use client";

import { useState, useMemo, Fragment } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, X, ChevronDown, ChevronRight } from "lucide-react";
import { formatName, normalizeTimeFormat, parseTimeToSeconds, formatTeamName } from "@/lib/utils";

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
      schoolName?: string | null;
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
  members: string | null; // JSON array of athlete IDs
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

interface MeetAthleteSummaryTableProps {
  meetLineups: MeetLineup[];
  relayEntries: RelayEntry[];
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
  scoringPlaces: number;
}

type SortField = "name" | "team" | "year" | "totalPoints" | "individualEvents" | "relayEvents";
type SortDirection = "asc" | "desc";

interface AthleteSummary {
  athleteId: string;
  firstName: string;
  lastName: string;
  year: string | null;
  teamId: string;
  teamName: string;
  teamColor: string | null;
  individualEvents: Array<{
    eventId: string;
    eventName: string;
    eventType: string;
    place: number | null;
    points: number;
    seedTime: string | null;
  }>;
  relayEvents: Array<{
    eventId: string;
    eventName: string;
    place: number | null;
    points: number;
    seedTime: string | null;
  }>;
  totalPoints: number;
  individualEventCount: number;
  relayEventCount: number;
  divingEventCount: number;
}

export function MeetAthleteSummaryTable({
  meetLineups,
  relayEntries,
  individualScoring,
  relayScoring,
  scoringPlaces,
}: MeetAthleteSummaryTableProps) {
  // Filter state
  const [nameFilter, setNameFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>("totalPoints");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Calculate athlete summaries
  const athleteSummaries = useMemo(() => {
    const summariesMap = new Map<string, AthleteSummary>();

    // Process individual events (swimming and diving)
    meetLineups.forEach((lineup) => {
      const athleteId = lineup.athlete.id;
      
      if (!summariesMap.has(athleteId)) {
        summariesMap.set(athleteId, {
          athleteId,
          firstName: lineup.athlete.firstName,
          lastName: lineup.athlete.lastName,
          year: lineup.athlete.year,
          teamId: lineup.athlete.team.id,
          teamName: formatTeamName(lineup.athlete.team.name, lineup.athlete.team.schoolName),
          teamColor: lineup.athlete.team.primaryColor,
          individualEvents: [],
          relayEvents: [],
          totalPoints: 0,
          individualEventCount: 0,
          relayEventCount: 0,
          divingEventCount: 0,
        });
      }

      const summary = summariesMap.get(athleteId)!;
      
      // Calculate place based on seedTimeSeconds (if not already set)
      let place = lineup.place;
      if (place === null && lineup.seedTimeSeconds !== null) {
        // Need to calculate place by sorting all lineups for this event
        const eventLineups = meetLineups.filter((l) => l.eventId === lineup.eventId);
        const sorted = [...eventLineups].sort((a, b) => {
          const aTime = a.seedTimeSeconds ?? (lineup.event.eventType === "diving" ? -Infinity : Infinity);
          const bTime = b.seedTimeSeconds ?? (lineup.event.eventType === "diving" ? -Infinity : Infinity);
          
          if (lineup.event.eventType === "diving") {
            // Diving: higher is better
            return bTime - aTime;
          } else {
            // Swimming: lower is better
            return aTime - bTime;
          }
        });
        place = sorted.findIndex((l) => l.id === lineup.id) + 1;
        if (place === 0) place = sorted.length; // Handle case where not found
      }

      // Calculate points
      let points = 0;
      if (place !== null && place <= scoringPlaces) {
        if (lineup.points !== null) {
          points = lineup.points;
        } else {
          points = individualScoring[place.toString()] || 0;
        }
      }

      summary.individualEvents.push({
        eventId: lineup.eventId,
        eventName: lineup.event.name,
        eventType: lineup.event.eventType,
        place,
        points,
        seedTime: lineup.seedTime,
      });

      if (lineup.event.eventType === "diving") {
        summary.divingEventCount++;
      } else {
        summary.individualEventCount++;
      }
      summary.totalPoints += points;
    });

    // Process relay events
    relayEntries.forEach((relay) => {
      if (!relay.members) return;
      
      let memberIds: string[] = [];
      try {
        memberIds = JSON.parse(relay.members) as string[];
      } catch (e) {
        // Invalid JSON, skip
        return;
      }

      // Calculate place based on seedTimeSeconds (if not already set)
      let place = relay.place;
      if (place === null && relay.seedTimeSeconds !== null) {
        const eventRelays = relayEntries.filter((r) => r.eventId === relay.eventId);
        const sorted = [...eventRelays].sort((a, b) => {
          const aTime = a.seedTimeSeconds ?? Infinity;
          const bTime = b.seedTimeSeconds ?? Infinity;
          return aTime - bTime; // Relays: lower is better
        });
        place = sorted.findIndex((r) => r.id === relay.id) + 1;
      }

      // Calculate points
      let points = 0;
      if (place !== null && place <= scoringPlaces) {
        if (relay.points !== null) {
          points = relay.points;
        } else {
          points = relayScoring[place.toString()] || 0;
        }
      }

      // Each member gets full credit for the relay points (they all contributed)
      // Note: This means sum of individual relay points will exceed team relay score
      // but it's appropriate for individual athlete contribution tracking
      memberIds.forEach((memberId) => {
        if (!summariesMap.has(memberId)) {
          // Athlete might not have individual events, but is in a relay
          // Skip for now - in practice most relay athletes also have individual events
          // TODO: Could fetch athlete info separately for relay-only athletes
          return;
        }

        const summary = summariesMap.get(memberId)!;
        summary.relayEvents.push({
          eventId: relay.eventId,
          eventName: relay.event.name,
          place,
          points: points, // Full points per member
          seedTime: relay.seedTime,
        });
        summary.relayEventCount++;
        // Note: Relay points are NOT added to totalPoints - only individual events count
      });
    });

    return Array.from(summariesMap.values());
  }, [meetLineups, relayEntries, individualScoring, relayScoring, scoringPlaces]);

  // Get unique teams (with color) and years for filters
  const availableTeams = useMemo(() => {
    const map = new Map<string, string | null>();
    athleteSummaries.forEach((summary) => {
      if (!map.has(summary.teamName)) {
        map.set(summary.teamName, summary.teamColor);
      }
    });
    return Array.from(map.entries())
      .map(([teamName, teamColor]) => ({ teamName, teamColor }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [athleteSummaries]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    athleteSummaries.forEach((summary) => {
      if (summary.year) {
        years.add(summary.year);
      }
    });
    return Array.from(years).sort();
  }, [athleteSummaries]);

  // Filter and sort summaries
  const filteredAndSortedSummaries = useMemo(() => {
    let filtered = [...athleteSummaries];

    // Apply filters
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.toLowerCase().trim();
      filtered = filtered.filter((summary) => {
        const fullName = formatName(summary.firstName, summary.lastName).toLowerCase();
        return fullName.includes(searchTerm);
      });
    }

    if (teamFilter !== "all") {
      filtered = filtered.filter((summary) => summary.teamName === teamFilter);
    }

    if (yearFilter !== "all") {
      filtered = filtered.filter((summary) => summary.year === yearFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          const aName = formatName(a.firstName, a.lastName).toLowerCase();
          const bName = formatName(b.firstName, b.lastName).toLowerCase();
          comparison = aName.localeCompare(bName);
          break;
        case "team":
          comparison = a.teamName.localeCompare(b.teamName);
          break;
        case "year":
          const yearOrder = ["FR", "SO", "JR", "SR", "GR"];
          const aYearIndex = a.year ? yearOrder.indexOf(a.year) : 999;
          const bYearIndex = b.year ? yearOrder.indexOf(b.year) : 999;
          comparison = aYearIndex - bYearIndex;
          break;
        case "totalPoints":
          comparison = a.totalPoints - b.totalPoints;
          break;
        case "individualEvents":
          comparison = a.individualEventCount - b.individualEventCount;
          break;
        case "relayEvents":
          comparison = a.relayEventCount - b.relayEventCount;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [athleteSummaries, nameFilter, teamFilter, yearFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to desc for most fields
    }
  };

  const clearFilters = () => {
    setNameFilter("");
    setTeamFilter("all");
    setYearFilter("all");
  };

  const hasActiveFilters = nameFilter.trim() || teamFilter !== "all" || yearFilter !== "all";

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

  if (athleteSummaries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No athletes entered in this meet yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-slate-50 rounded-md border">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Name</label>
          <Input
            placeholder="Search by name..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Team</label>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {availableTeams.map(({ teamName, teamColor }) => (
                <SelectItem key={teamName} value={teamName}>
                  <span className="flex items-center gap-2">
                    {teamColor && (
                      <span
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: teamColor }}
                        aria-hidden
                      />
                    )}
                    {teamName}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[120px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Year</label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-9"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-600">
        Showing {filteredAndSortedSummaries.length} of {athleteSummaries.length} athletes
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Athlete
                  {getSortIcon("name")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("team")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Team
                  {getSortIcon("team")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("year")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Year
                  {getSortIcon("year")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("individualEvents")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Individual Events
                  {getSortIcon("individualEvents")}
                </button>
              </TableHead>
              <TableHead>Relay Events</TableHead>
              <TableHead>Diving Events</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("totalPoints")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Total Points
                  {getSortIcon("totalPoints")}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedSummaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No athletes match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedSummaries.map((summary) => {
                const allEvents = [...summary.individualEvents, ...summary.relayEvents];
                const isExpanded = expandedRows.has(summary.athleteId);
                const swimmingEvents = summary.individualEvents.filter(e => e.eventType !== "diving");
                const divingEvents = summary.individualEvents.filter(e => e.eventType === "diving");
                
                return (
                  <Fragment key={summary.athleteId}>
                    <TableRow 
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        setExpandedRows((prev) => {
                          const newSet = new Set(prev);
                          if (newSet.has(summary.athleteId)) {
                            newSet.delete(summary.athleteId);
                          } else {
                            newSet.add(summary.athleteId);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                          {formatName(summary.firstName, summary.lastName)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          style={summary.teamColor ? { color: summary.teamColor, fontWeight: 600 } : {}}
                        >
                          {summary.teamName}
                        </span>
                      </TableCell>
                      <TableCell>{summary.year || "-"}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{summary.individualEventCount}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{summary.relayEventCount}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{summary.divingEventCount}</span>
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {summary.totalPoints.toFixed(1)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${summary.athleteId}-details`} className="bg-slate-50">
                        <TableCell colSpan={7} className="py-4">
                          <div className="space-y-4 pl-4 border-l-2 border-slate-300">
                            {/* Individual Swimming Events */}
                            {swimmingEvents.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm text-slate-700 mb-2">
                                  Individual Swimming Events ({swimmingEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {swimmingEvents.map((e) => (
                                    <div key={e.eventId} className="text-sm text-slate-600">
                                      <span className="font-medium">{e.eventName}</span>
                                      {e.place && (
                                        <span className="ml-2 text-slate-500">
                                          (Place: {e.place}
                                          {e.points > 0 && `, ${e.points.toFixed(1)} pts`})
                                        </span>
                                      )}
                                      {e.seedTime && (
                                        <span className="ml-2 text-slate-400 text-xs">
                                          {normalizeTimeFormat(e.seedTime)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Diving Events */}
                            {divingEvents.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm text-slate-700 mb-2">
                                  Diving Events ({divingEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {divingEvents.map((e) => (
                                    <div key={e.eventId} className="text-sm text-slate-600">
                                      <span className="font-medium">{e.eventName}</span>
                                      {e.place && (
                                        <span className="ml-2 text-slate-500">
                                          (Place: {e.place}
                                          {e.points > 0 && `, ${e.points.toFixed(1)} pts`})
                                        </span>
                                      )}
                                      {e.seedTime && (
                                        <span className="ml-2 text-slate-400 text-xs">
                                          Score: {normalizeTimeFormat(e.seedTime)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Relay Events */}
                            {summary.relayEvents.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm text-slate-700 mb-2">
                                  Relay Events ({summary.relayEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {summary.relayEvents.map((e) => (
                                    <div key={e.eventId} className="text-sm text-slate-600">
                                      <span className="font-medium">{e.eventName}</span>
                                      {e.place && (
                                        <span className="ml-2 text-slate-500">
                                          (Place: {e.place}
                                          {e.points > 0 && `, ${e.points.toFixed(1)} pts`})
                                        </span>
                                      )}
                                      {e.seedTime && (
                                        <span className="ml-2 text-slate-400 text-xs">
                                          {normalizeTimeFormat(e.seedTime)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {allEvents.length === 0 && (
                              <div className="text-sm text-slate-400 italic">
                                No events entered
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
