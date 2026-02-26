"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { formatName, formatTeamName } from "@/lib/utils";

interface MeetLineup {
  id: string;
  athleteId: string;
  eventId: string;
  points: number | null;
  simulatedPoints?: number | null;
  realResultApplied?: boolean;
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
  points: number | null;
  simulatedPoints?: number | null;
  realResultApplied?: boolean;
  team: {
    id: string;
    name: string;
    schoolName?: string | null;
    primaryColor: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor: string | null;
}

interface PerformanceVsProjectionProps {
  meetLineups: MeetLineup[];
  relayEntries: RelayEntry[];
  teams: Team[];
}

type Filter = "all" | "gainers" | "drops";
type SortCol = "name" | "projected" | "actual" | "delta" | "events";

export function PerformanceVsProjection({ meetLineups, relayEntries, teams }: PerformanceVsProjectionProps) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sortCol, setSortCol] = useState<SortCol>("delta");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const scoredLineups = useMemo(
    () => meetLineups.filter((l) => l.realResultApplied === true),
    [meetLineups]
  );
  const scoredRelays = useMemo(
    () => relayEntries.filter((r) => r.realResultApplied === true),
    [relayEntries]
  );

  const scoredEventIds = useMemo(() => {
    const set = new Set<string>();
    scoredLineups.forEach((l) => set.add(l.eventId));
    scoredRelays.forEach((r) => set.add(r.eventId));
    return set;
  }, [scoredLineups, scoredRelays]);

  const teamDeltas = useMemo(() => {
    const map = new Map<string, { projected: number; actual: number }>();
    teams.forEach((t) => map.set(t.id, { projected: 0, actual: 0 }));

    scoredLineups.forEach((l) => {
      const teamId = l.athlete.team.id;
      const rec = map.get(teamId);
      if (!rec) return;
      rec.actual += l.points ?? 0;
      rec.projected += (l.simulatedPoints as number) ?? 0;
    });
    scoredRelays.forEach((r) => {
      const rec = map.get(r.teamId);
      if (!rec) return;
      rec.actual += r.points ?? 0;
      rec.projected += (r.simulatedPoints as number) ?? 0;
    });

    return teams
      .map((t) => {
        const rec = map.get(t.id) ?? { projected: 0, actual: 0 };
        return { ...t, projected: rec.projected, actual: rec.actual, delta: rec.actual - rec.projected };
      })
      .sort((a, b) => b.delta - a.delta);
  }, [teams, scoredLineups, scoredRelays]);

  const athleteMovers = useMemo(() => {
    const map = new Map<string, {
      name: string;
      year: string | null;
      teamId: string;
      teamName: string;
      teamSchool: string | null;
      teamColor: string | null;
      projected: number;
      actual: number;
      events: number;
    }>();

    scoredLineups.forEach((l) => {
      const aid = l.athlete.id;
      if (!map.has(aid)) {
        map.set(aid, {
          name: formatName(l.athlete.firstName, l.athlete.lastName),
          year: l.athlete.year,
          teamId: l.athlete.team.id,
          teamName: formatTeamName(l.athlete.team.name, l.athlete.team.schoolName),
          teamSchool: l.athlete.team.schoolName ?? null,
          teamColor: l.athlete.team.primaryColor,
          projected: 0,
          actual: 0,
          events: 0,
        });
      }
      const rec = map.get(aid)!;
      rec.actual += l.points ?? 0;
      rec.projected += (l.simulatedPoints as number) ?? 0;
      rec.events += 1;
    });

    return Array.from(map.values()).map((a) => ({
      ...a,
      delta: a.actual - a.projected,
    }));
  }, [scoredLineups]);

  const filteredMovers = useMemo(() => {
    let list = athleteMovers;
    if (filter === "gainers") list = list.filter((a) => a.delta > 0);
    else if (filter === "drops") list = list.filter((a) => a.delta < 0);

    list.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (sortCol) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case "projected": aVal = a.projected; bVal = b.projected; break;
        case "actual": aVal = a.actual; bVal = b.actual; break;
        case "events": aVal = a.events; bVal = b.events; break;
        default: aVal = Math.abs(a.delta); bVal = Math.abs(b.delta); break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [athleteMovers, filter, sortCol, sortDir]);

  const displayedMovers = showAll ? filteredMovers : filteredMovers.slice(0, 10);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const renderSortIcon = (col: SortCol) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  if (scoredEventIds.size === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance vs Projection
        </CardTitle>
        <CardDescription>
          Comparing actual results to projected across {scoredEventIds.size} scored event{scoredEventIds.size !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team summary badges */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Team Deltas</h4>
          <div className="flex flex-wrap gap-2">
            {teamDeltas.map((t) => (
              <Badge
                key={t.id}
                variant="outline"
                className={`text-sm py-1 px-3 ${
                  t.delta > 0
                    ? "border-green-300 bg-green-50 text-green-700"
                    : t.delta < 0
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-slate-300 bg-slate-50 text-slate-600"
                }`}
              >
                <span className="font-semibold" style={t.primaryColor ? { color: t.primaryColor } : {}}>
                  {formatTeamName(t.name, t.schoolName)}
                </span>
                <span className="ml-1.5 font-mono">
                  {t.delta > 0 ? "+" : ""}{t.delta.toFixed(1)}
                </span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Top Movers table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Top Movers</h4>
            <div className="flex gap-1">
              {(["all", "gainers", "drops"] as Filter[]).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "gainers" ? (
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Gainers</span>
                  ) : (
                    <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Drops</span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none text-xs"
                    onClick={() => toggleSort("name")}
                  >
                    <span className="inline-flex items-center">Athlete{renderSortIcon("name")}</span>
                  </TableHead>
                  <TableHead className="text-xs">Team</TableHead>
                  <TableHead className="text-xs">Year</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none text-xs"
                    onClick={() => toggleSort("projected")}
                  >
                    <span className="inline-flex items-center justify-end">Proj.{renderSortIcon("projected")}</span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none text-xs"
                    onClick={() => toggleSort("actual")}
                  >
                    <span className="inline-flex items-center justify-end">Actual{renderSortIcon("actual")}</span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none text-xs"
                    onClick={() => toggleSort("delta")}
                  >
                    <span className="inline-flex items-center justify-end">+/−{renderSortIcon("delta")}</span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none text-xs"
                    onClick={() => toggleSort("events")}
                  >
                    <span className="inline-flex items-center justify-end">Events{renderSortIcon("events")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedMovers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-500 text-sm">
                      No {filter === "gainers" ? "gainers" : filter === "drops" ? "drops" : "movers"} found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedMovers.map((a, idx) => (
                    <TableRow key={`${a.name}-${a.teamId}-${idx}`} className={idx % 2 === 0 ? "bg-slate-50" : ""}>
                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                      <TableCell className="text-sm">
                        <span style={a.teamColor ? { color: a.teamColor, fontWeight: 600 } : {}}>
                          {a.teamName}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{a.year ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{a.projected.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{a.actual.toFixed(1)}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold font-mono ${a.delta > 0 ? "text-green-600" : a.delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                        {a.delta > 0 ? "+" : ""}{a.delta.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">{a.events}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredMovers.length > 10 && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? `Show top 10` : `Show all ${filteredMovers.length}`}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
