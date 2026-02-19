"use client";

import { useState, useMemo, Fragment, useRef, useEffect, useCallback } from "react";
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

interface MeetEvent {
  id: string;
  name: string;
  eventType?: string;
}

function abbreviateEventName(name: string): string {
  return name
    .replace(/\bFree\b/gi, "FR")
    .replace(/\bBack\b/gi, "BK")
    .replace(/\bBreast\b/gi, "BR")
    .replace(/\bFly\b/gi, "FL");
}

interface MeetAthleteSummaryTableProps {
  meetLineups: MeetLineup[];
  relayEntries: RelayEntry[];
  events: MeetEvent[];
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
  scoringPlaces: number;
  /** Athlete IDs in the test spot (show "Test" badge) */
  testSpotAthleteIds?: string[];
  /** Meet teams with sensitivity (for variant-specific points and scenario toggle) */
  meetTeams?: MeetTeamSensitivity[];
  meetId?: string;
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
  events = [],
  individualScoring,
  relayScoring,
  scoringPlaces,
  testSpotAthleteIds = [],
  meetTeams = [],
  meetId,
}: MeetAthleteSummaryTableProps) {
  const testSpotSet = useMemo(() => new Set(testSpotAthleteIds), [testSpotAthleteIds]);
  const meetTeamsByTeamId = useMemo(() => {
    const m = new Map<string, MeetTeamSensitivity>();
    meetTeams.forEach((mt) => m.set(mt.teamId, mt));
    return m;
  }, [meetTeams]);
  const router = useRouter();
  // Filter state
  const [nameFilter, setNameFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"standard" | "eventGrid">("standard");

  // Sort state (sortField can be SortField or event id for event grid columns)
  const [sortField, setSortField] = useState<string>("totalPoints");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sticky bottom horizontal scroll: refs and state
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [horizontalScrollWidth, setHorizontalScrollWidth] = useState(0);
  const [horizontalScrollClientWidth, setHorizontalScrollClientWidth] = useState(0);
  const isSyncingFromTable = useRef(false);
  const isSyncingFromBottom = useRef(false);
  const showStickyHorizontalScroll = horizontalScrollWidth > horizontalScrollClientWidth;

  const updateHorizontalScrollSize = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setHorizontalScrollWidth(el.scrollWidth);
    setHorizontalScrollClientWidth(el.clientWidth);
  }, []);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    updateHorizontalScrollSize();
    const ro = new ResizeObserver(updateHorizontalScrollSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, updateHorizontalScrollSize]);

  // When the sticky strip appears, sync its scroll position to the table
  useEffect(() => {
    if (!showStickyHorizontalScroll) return;
    const table = tableScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (table && bottom) bottom.scrollLeft = table.scrollLeft;
  }, [showStickyHorizontalScroll]);

  const handleTableScroll = useCallback(() => {
    if (isSyncingFromBottom.current) return;
    const table = tableScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (table && bottom && table.scrollLeft !== bottom.scrollLeft) {
      isSyncingFromTable.current = true;
      bottom.scrollLeft = table.scrollLeft;
      requestAnimationFrame(() => { isSyncingFromTable.current = false; });
    }
  }, []);

  const handleBottomScroll = useCallback(() => {
    if (isSyncingFromTable.current) return;
    const table = tableScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (table && bottom && bottom.scrollLeft !== table.scrollLeft) {
      isSyncingFromBottom.current = true;
      table.scrollLeft = bottom.scrollLeft;
      requestAnimationFrame(() => { isSyncingFromBottom.current = false; });
    }
  }, []);

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

      // Calculate points (use sensitivity variant when applicable)
      const teamId = lineup.athlete.team.id;
      const meetTeam = meetTeamsByTeamId.get(teamId);
      const useSensitivityVariant =
        meetTeam?.sensitivityVariantAthleteId &&
        lineup.athleteId === meetTeam.sensitivityVariantAthleteId &&
        (meetTeam.sensitivityVariant === "better" || meetTeam.sensitivityVariant === "worse");
      let points = 0;
      if (useSensitivityVariant && meetTeam.sensitivityVariant === "better" && lineup.sensitivityPointsBetter != null) {
        points = lineup.sensitivityPointsBetter;
        if (lineup.sensitivityPlaceBetter != null) place = lineup.sensitivityPlaceBetter;
      } else if (useSensitivityVariant && meetTeam.sensitivityVariant === "worse" && lineup.sensitivityPointsWorse != null) {
        points = lineup.sensitivityPointsWorse;
        if (lineup.sensitivityPlaceWorse != null) place = lineup.sensitivityPlaceWorse;
      } else if (place !== null && place <= scoringPlaces) {
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
  }, [meetLineups, relayEntries, individualScoring, relayScoring, scoringPlaces, meetTeamsByTeamId]);

  // Event grid: only individual and diving events (no relays)
  const gridEvents = useMemo(
    () => events.filter((e) => e.eventType !== "relay"),
    [events]
  );

  // Per-athlete, per-event points for event grid: number = points, null = competed but 0 (show "-"), undefined = didn't compete (blank)
  const pointsByAthleteByEvent = useMemo(() => {
    const map = new Map<string, Map<string, number | null>>();
    athleteSummaries.forEach((summary) => {
      const eventMap = new Map<string, number | null>();
      [...summary.individualEvents, ...summary.relayEvents].forEach((e) => {
        eventMap.set(e.eventId, e.points === 0 ? null : e.points);
      });
      map.set(summary.athleteId, eventMap);
    });
    return map;
  }, [athleteSummaries]);

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
        default: {
          // Event grid: sort by points in this event (sortField is event id); blank (didn't compete) sorts last
          const aVal = pointsByAthleteByEvent.get(a.athleteId)?.get(sortField);
          const bVal = pointsByAthleteByEvent.get(b.athleteId)?.get(sortField);
          if (aVal === undefined && bVal === undefined) comparison = 0;
          else if (aVal === undefined) comparison = -1; // a (blank) sorts after b → return positive in desc
          else if (bVal === undefined) comparison = 1;  // b (blank) sorts after a
          else {
            const aNum = aVal === null ? 0 : aVal;
            const bNum = bVal === null ? 0 : bVal;
            comparison = aNum - bNum;
          }
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [athleteSummaries, nameFilter, teamFilter, yearFilter, sortField, sortDirection, pointsByAthleteByEvent]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" || field === "team" || field === "year" ? "asc" : "desc");
    }
  };

  const clearFilters = () => {
    setNameFilter("");
    setTeamFilter("all");
    setYearFilter("all");
  };

  const hasActiveFilters = nameFilter.trim() || teamFilter !== "all" || yearFilter !== "all";

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="h-3 w-3 ml-1 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" aria-hidden />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 shrink-0 text-slate-500" aria-hidden />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 shrink-0 text-slate-500" aria-hidden />
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
    <div className="space-y-4 [&_table_th]:h-8 [&_table_th]:px-1.5 [&_table_th]:text-xs [&_table_td]:py-1.5 [&_table_td]:px-1.5 [&_table_td]:text-xs">
      {/* Sensitivity scenario toggle */}
      {meetId && meetTeams.filter((mt) => mt.sensitivityVariantAthleteId).length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-slate-600">Sensitivity scenario:</span>
          {meetTeams
            .filter((mt) => mt.sensitivityVariantAthleteId)
            .map((mt) => {
              const sensVariant = mt.sensitivityVariant ?? "baseline";
              const sensPercent = mt.sensitivityPercent ?? 1;
              const teamName = mt.team ? formatTeamName(mt.team.name ?? "", mt.team.schoolName) : mt.teamId;
              return (
                <div key={mt.teamId} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{teamName}:</span>
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
      )}
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
        <div className="min-w-[140px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">View</label>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as "standard" | "eventGrid")}>
            <SelectTrigger>
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              {gridEvents.length > 0 && (
                <SelectItem value="eventGrid">Event Grid</SelectItem>
              )}
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

      {/* Standard table - scrollable so header row sticks; horizontal scrollbar sticks at bottom */}
      {viewMode === "standard" && (
      <div className="flex flex-col rounded-md border min-w-0" style={{ maxHeight: "70vh" }}>
        <div
          ref={tableScrollRef}
          className="flex-1 min-h-0 overflow-auto [&::-webkit-scrollbar]:h-0"
          onScroll={handleTableScroll}
        >
          <Table noScrollWrapper>
          <TableHeader className="[&_tr_th]:sticky [&_tr_th]:top-0 [&_tr_th]:z-10 [&_tr_th]:bg-white [&_tr_th]:shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort("name")}
                  className="group flex items-center hover:text-slate-900 transition-colors"
                >
                  Athlete
                  {getSortIcon("name")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("team")}
                  className="group flex items-center hover:text-slate-900 transition-colors"
                >
                  Team
                  {getSortIcon("team")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("year")}
                  className="group flex items-center hover:text-slate-900 transition-colors"
                >
                  Year
                  {getSortIcon("year")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("individualEvents")}
                  className="group flex items-center hover:text-slate-900 transition-colors"
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
                  className="group flex items-center hover:text-slate-900 transition-colors"
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
                <TableCell colSpan={7} className="text-center py-6 text-slate-500">
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
                          {testSpotSet.has(summary.athleteId) && (
                            <Badge variant="secondary" className="ml-1.5 text-xs font-normal">Test</Badge>
                          )}
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
                        <span className="font-medium">{summary.individualEventCount}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{summary.relayEventCount}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{summary.divingEventCount}</span>
                      </TableCell>
                      <TableCell className="font-bold text-sm">
                        <span style={summary.teamColor ? { color: summary.teamColor } : undefined}>
                          {summary.totalPoints.toFixed(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${summary.athleteId}-details`} className="bg-slate-50">
                        <TableCell colSpan={7} className="py-3">
                          <div className="space-y-3 pl-3 border-l-2 border-slate-300">
                            {/* Individual Swimming Events */}
                            {swimmingEvents.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-xs text-slate-700 mb-1.5">
                                  Individual Swimming Events ({swimmingEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {swimmingEvents.map((e) => (
                                    <div key={e.eventId} className="text-xs text-slate-600">
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
                                <h4 className="font-semibold text-xs text-slate-700 mb-1.5">
                                  Diving Events ({divingEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {divingEvents.map((e) => (
                                    <div key={e.eventId} className="text-xs text-slate-600">
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
                                <h4 className="font-semibold text-xs text-slate-700 mb-1.5">
                                  Relay Events ({summary.relayEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {summary.relayEvents.map((e) => (
                                    <div key={e.eventId} className="text-xs text-slate-600">
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
                              <div className="text-xs text-slate-400 italic">
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
        {showStickyHorizontalScroll && (
          <div
            ref={bottomScrollRef}
            className="sticky bottom-0 shrink-0 h-4 overflow-x-auto overflow-y-hidden border-t bg-slate-100"
            onScroll={handleBottomScroll}
            aria-label="Horizontal scroll"
          >
            <div style={{ height: 1, width: horizontalScrollWidth, minWidth: "100%" }} />
          </div>
        )}
      </div>
      )}

      {/* Event Grid: points per athlete per event (individual + diving only, no relays) */}
      {viewMode === "eventGrid" && gridEvents.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Points scored by each athlete in each event. Blank = did not compete; — = competed but did not score.
          </p>
          <div className="flex flex-col rounded-md border min-w-0" style={{ maxHeight: "70vh" }}>
            <div
              ref={tableScrollRef}
              className="flex-1 min-h-0 overflow-auto [&::-webkit-scrollbar]:h-0"
              onScroll={handleTableScroll}
            >
              <Table noScrollWrapper>
              <TableHeader className="[&_tr_th]:sticky [&_tr_th]:top-0 [&_tr_th]:z-10 [&_tr_th]:bg-white [&_tr_th]:shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
                <TableRow>
                  <TableHead className="min-w-[140px] sticky left-0 z-20 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    <button
                      onClick={() => handleSort("name")}
                      className="group flex items-center hover:text-slate-900 transition-colors"
                    >
                      Athlete
                      {getSortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <button
                      onClick={() => handleSort("team")}
                      className="group flex items-center hover:text-slate-900 transition-colors"
                    >
                      Team
                      {getSortIcon("team")}
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[60px]">
                    <button
                      onClick={() => handleSort("year")}
                      className="group flex items-center hover:text-slate-900 transition-colors"
                    >
                      Year
                      {getSortIcon("year")}
                    </button>
                  </TableHead>
                  {gridEvents.map((ev) => (
                    <TableHead key={ev.id} className="text-center min-w-[56px] whitespace-nowrap" title={ev.name}>
                      <button
                        onClick={() => handleSort(ev.id)}
                        className="group flex items-center justify-center w-full hover:text-slate-900 transition-colors"
                      >
                        {abbreviateEventName(ev.name)}
                        {getSortIcon(ev.id)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[72px] font-semibold">
                    <button
                      onClick={() => handleSort("totalPoints")}
                      className="group flex items-center justify-center w-full hover:text-slate-900 transition-colors"
                    >
                      Total Points
                      {getSortIcon("totalPoints")}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSummaries.map((summary) => {
                  const eventPoints = pointsByAthleteByEvent.get(summary.athleteId);
                  return (
                    <TableRow key={summary.athleteId}>
                      <TableCell className="font-medium sticky left-0 z-[5] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                        <span className="flex items-center gap-1.5">
                          {formatName(summary.firstName, summary.lastName)}
                          {testSpotSet.has(summary.athleteId) && (
                            <Badge variant="secondary" className="text-xs font-normal">Test</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          style={summary.teamColor ? { color: summary.teamColor, fontWeight: 600 } : {}}
                        >
                          {summary.teamName}
                        </span>
                      </TableCell>
                      <TableCell>{summary.year || "-"}</TableCell>
                      {gridEvents.map((ev) => {
                        const val = eventPoints?.get(ev.id);
                        const pointStyle = summary.teamColor ? { color: summary.teamColor } : undefined;
                        return (
                          <TableCell key={ev.id} className="text-center">
                            {val === undefined ? (
                              ""
                            ) : val === null ? (
                              <span style={pointStyle ? { ...pointStyle, opacity: 0.6 } : undefined} className={!pointStyle ? "text-slate-400" : ""}>—</span>
                            ) : (
                              <span style={pointStyle}>{val.toFixed(1)}</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold">
                        <span style={summary.teamColor ? { color: summary.teamColor } : undefined}>
                          {summary.totalPoints.toFixed(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            {showStickyHorizontalScroll && (
              <div
                ref={bottomScrollRef}
                className="sticky bottom-0 shrink-0 h-4 overflow-x-auto overflow-y-hidden border-t bg-slate-100"
                onScroll={handleBottomScroll}
                aria-label="Horizontal scroll"
              >
                <div style={{ height: 1, width: horizontalScrollWidth, minWidth: "100%" }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
