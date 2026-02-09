"use client";

import { useState, useMemo, useCallback } from "react";
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
import { formatName, normalizeTimeFormat, parseTimeToSeconds } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Edit2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface MeetLineup {
  id: string;
  athleteId: string;
  eventId: string;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  overrideTime: string | null;
  overrideTimeSeconds: number | null;
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
  overrideTime: string | null;
  overrideTimeSeconds: number | null;
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
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
  scoringPlaces: number;
  hasResults: boolean;
  meetId: string;
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
        place: number | null;
        points: number;
        time: string | null;
        teamName?: string;
        teamColor?: string | null;
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
  individualScoring,
  relayScoring,
  scoringPlaces,
  hasResults,
  meetId,
}: EventDetailViewProps) {
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTimes, setEditingTimes] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  // Calculate A/B/C final ranges
  const aFinalRange = { min: 1, max: Math.min(8, scoringPlaces) };
  const bFinalRange = { min: 9, max: Math.min(16, scoringPlaces) };
  const cFinalRange = { min: 17, max: Math.min(24, scoringPlaces) };

  // Helper to get effective time (override if present, otherwise seed)
  const getEffectiveTime = useCallback((lineup: MeetLineup | RelayEntry) => {
    // Safely access overrideTime (may not exist on older records)
    const overrideTime = 'overrideTime' in lineup ? lineup.overrideTime : null;
    return overrideTime ?? lineup.seedTime;
  }, []);

  const getEffectiveTimeSeconds = useCallback((lineup: MeetLineup | RelayEntry) => {
    // Safely access overrideTimeSeconds (may not exist on older records)
    const overrideTimeSeconds = 'overrideTimeSeconds' in lineup ? lineup.overrideTimeSeconds : null;
    return overrideTimeSeconds ?? lineup.seedTimeSeconds;
  }, []);

  // Process individual events
  const teamStats = useMemo(() => {
    const statsMap = new Map<string, TeamEventStats>();

    // Initialize all teams
    teams.forEach((team) => {
      statsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
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

    // Sort lineups by time/score (use override if present)
    const sortedLineups = [...meetLineups].sort((a, b) => {
      const aOverride = 'overrideTimeSeconds' in a ? a.overrideTimeSeconds : null;
      const bOverride = 'overrideTimeSeconds' in b ? b.overrideTimeSeconds : null;
      const aTime = (aOverride ?? a.seedTimeSeconds) ?? (event.eventType === "diving" ? -Infinity : Infinity);
      const bTime = (bOverride ?? b.seedTimeSeconds) ?? (event.eventType === "diving" ? -Infinity : Infinity);

      if (event.eventType === "diving") {
        return bTime - aTime; // Higher is better
      } else {
        return aTime - bTime; // Lower is better
      }
    });

    // Calculate places and points
    sortedLineups.forEach((lineup, index) => {
      const place = lineup.place !== null ? lineup.place : index + 1;
      let points = 0;

      if (lineup.points !== null) {
        points = lineup.points;
      } else if (place <= scoringPlaces) {
        points = individualScoring[place.toString()] || 0;
      }

      const teamId = lineup.athlete.team.id;
      const stats = statsMap.get(teamId);
      if (!stats) return;

      // Categorize by final
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
      stats.entries.push({
        athleteId: lineup.id,
        athleteName: formatName(lineup.athlete.firstName, lineup.athlete.lastName),
        place,
        points,
        time: getEffectiveTime(lineup),
        teamName: stats.teamName,
        teamColor: stats.teamColor,
        lineupId: lineup.id,
        hasOverride: !!('overrideTime' in lineup && lineup.overrideTime),
      });
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [meetLineups, teams, individualScoring, scoringPlaces, event.eventType, aFinalRange, bFinalRange, cFinalRange, getEffectiveTime]);

  // Process relay entries if this is a relay event
  const relayTeamStats = useMemo(() => {
    if (event.eventType !== "relay") return [];

    const statsMap = new Map<string, TeamEventStats>();

    teams.forEach((team) => {
      statsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
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

    const sortedRelays = [...relayEntries].sort((a, b) => {
      const aOverride = 'overrideTimeSeconds' in a ? a.overrideTimeSeconds : null;
      const bOverride = 'overrideTimeSeconds' in b ? b.overrideTimeSeconds : null;
      const aTime = (aOverride ?? a.seedTimeSeconds) ?? Infinity;
      const bTime = (bOverride ?? b.seedTimeSeconds) ?? Infinity;
      return aTime - bTime;
    });

    sortedRelays.forEach((relay, index) => {
      const place = relay.place !== null ? relay.place : index + 1;
      let points = 0;

      if (relay.points !== null) {
        points = relay.points;
      } else if (place <= scoringPlaces) {
        points = relayScoring[place.toString()] || 0;
      }

      const stats = statsMap.get(relay.teamId);
      if (!stats) return;

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
      stats.entries.push({
        athleteId: relay.id,
        athleteName: relay.team.name,
        place,
        points,
        time: getEffectiveTime(relay),
        teamName: stats.teamName,
        teamColor: stats.teamColor,
        lineupId: relay.id,
        hasOverride: !!('overrideTime' in relay && relay.overrideTime),
      });
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [relayEntries, teams, relayScoring, scoringPlaces, event.eventType, aFinalRange, bFinalRange, cFinalRange, getEffectiveTime]);

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

  // Helper to render time cell (editable in edit mode)
  const renderTimeCell = useCallback((entry: { lineupId?: string; time: string | null; hasOverride?: boolean }) => {
    if (!isEditMode || !entry.lineupId) {
      return (
        <div className="text-right font-mono tabular-nums">
          {entry.time ? (
            <span className={entry.hasOverride ? "text-red-600" : ""}>
              {normalizeTimeFormat(entry.time)}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Event Results</CardTitle>
                  <CardDescription>
                    Complete list of all entries in this event, sorted by place
                  </CardDescription>
                </div>
                {!isEditMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Times
                  </Button>
                ) : (
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
                )}
              </div>
            </CardHeader>
            <CardContent>
              {displayStats.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No entries in this event.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Place</TableHead>
                        <TableHead>Athlete/Team</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Time/Score</TableHead>
                        <TableHead className="text-right">Points</TableHead>
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
                                  <TableCell colSpan={5} className="text-white font-semibold py-2">
                                    A Final (Places {aFinalRange.min}-{aFinalRange.max})
                                  </TableCell>
                                </TableRow>
                                {aFinalEntries.map((entry, idx) => (
                                  <TableRow 
                                    key={`a-${entry.athleteId}-${idx}`}
                                    className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}
                                  >
                                    <TableCell className="font-bold">
                                      <span className="flex items-center gap-2">
                                        {entry.place}
                                        {entry.place === 1 && "🥇"}
                                        {entry.place === 2 && "🥈"}
                                        {entry.place === 3 && "🥉"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="font-medium">{entry.athleteName}</TableCell>
                                    <TableCell>
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
                                    <TableCell className="text-right">
                                      {renderTimeCell(entry)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">
                                      {entry.points > 0 ? entry.points.toFixed(1) : "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            )}

                            {/* B Final Section */}
                            {bFinalEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-600 hover:bg-slate-600">
                                  <TableCell colSpan={5} className="text-white font-semibold py-2">
                                    B Final (Places {bFinalRange.min}-{bFinalRange.max})
                                  </TableCell>
                                </TableRow>
                                {bFinalEntries.map((entry, idx) => (
                                  <TableRow 
                                    key={`b-${entry.athleteId}-${idx}`}
                                    className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}
                                  >
                                    <TableCell className="font-bold">{entry.place}</TableCell>
                                    <TableCell className="font-medium">{entry.athleteName}</TableCell>
                                    <TableCell>
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
                                    <TableCell className="text-right">
                                      {renderTimeCell(entry)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">
                                      {entry.points > 0 ? entry.points.toFixed(1) : "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            )}

                            {/* C Final Section */}
                            {cFinalEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-500 hover:bg-slate-500">
                                  <TableCell colSpan={5} className="text-white font-semibold py-2">
                                    C Final (Places {cFinalRange.min}-{cFinalRange.max})
                                  </TableCell>
                                </TableRow>
                                {cFinalEntries.map((entry, idx) => (
                                  <TableRow 
                                    key={`c-${entry.athleteId}-${idx}`}
                                    className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}
                                  >
                                    <TableCell className="font-bold">{entry.place}</TableCell>
                                    <TableCell className="font-medium">{entry.athleteName}</TableCell>
                                    <TableCell>
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
                                    <TableCell className="text-right">
                                      {renderTimeCell(entry)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">
                                      {entry.points > 0 ? entry.points.toFixed(1) : "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            )}

                            {/* Non-Scorers Section */}
                            {nonScorerEntries.length > 0 && (
                              <>
                                <TableRow className="bg-slate-400 hover:bg-slate-400">
                                  <TableCell colSpan={5} className="text-white font-semibold py-2">
                                    Non-Scorers (Places {cFinalRange.max + 1}+)
                                  </TableCell>
                                </TableRow>
                                {nonScorerEntries.map((entry, idx) => (
                                  <TableRow 
                                    key={`nonscorer-${entry.athleteId}-${idx}`}
                                    className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}
                                  >
                                    <TableCell className="font-bold">
                                      {entry.place || "-"}
                                    </TableCell>
                                    <TableCell className="font-medium">{entry.athleteName}</TableCell>
                                    <TableCell>
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
                                    <TableCell className="text-right">
                                      {renderTimeCell(entry)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-slate-400">
                                      -
                                    </TableCell>
                                  </TableRow>
                                ))}
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
              {!isEditMode && (
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
                    {displayStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
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
