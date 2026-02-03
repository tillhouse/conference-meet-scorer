"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { formatName, parseTimeToSeconds, formatSecondsToTime, normalizeTimeFormat } from "@/lib/utils";
import { toast } from "sonner";

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  eventTimes: {
    id: string;
    time: string;
    timeSeconds: number;
    isRelaySplit: boolean;
    event: {
      id: string;
      name: string;
    };
  }[];
}

interface Team {
  id: string;
  name: string;
  athletes: Athlete[];
}

interface RelayEvent {
  id: string;
  name: string;
  fullName?: string;
  legs: string[]; // ["BK", "BR", "FL", "FR"] or ["FR", "FR", "FR", "FR"]
  distances: string[]; // ["50", "50", "50", "50"] or ["100", "100", "100", "100"], etc.
}

interface MeetTeam {
  id: string;
  teamId: string;
}

interface RelayCreatorProps {
  meetId: string;
  meetTeam: MeetTeam;
  team: Team;
  relayEvents: RelayEvent[];
  maxRelays: number;
}

interface RelayEntry {
  eventId: string;
  athletes: (string | null)[]; // [athleteId1, athleteId2, athleteId3, athleteId4]
  times: (string | null)[]; // Custom times for each leg, or null to calculate
  useRelaySplits: boolean[]; // Whether to use relay splits (true) or flat-start minus correction (false)
}

export function RelayCreator({
  meetId,
  meetTeam,
  team,
  relayEvents,
  maxRelays,
}: RelayCreatorProps) {
  const [relayEntries, setRelayEntries] = useState<Record<string, RelayEntry>>({});
  const [savedRelayEntries, setSavedRelayEntries] = useState<Record<string, RelayEntry>>({});
  const [correctionFactor, setCorrectionFactor] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Initialize relay entries
  useEffect(() => {
    const entries: Record<string, RelayEntry> = {};
    relayEvents.forEach((event) => {
      entries[event.id] = {
        eventId: event.id,
        athletes: [null, null, null, null],
        times: [null, null, null, null],
        useRelaySplits: [false, true, true, true], // First leg uses flat-start, others default to relay splits
      };
    });
    setRelayEntries(entries);

    // Load existing relays
    fetch(`/api/meets/${meetId}/relays/${meetTeam.teamId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.relays && data.relays.length > 0) {
          const loaded: Record<string, RelayEntry> = {};
          data.relays.forEach((relay: any) => {
            // Use event name as key (relay.eventId is the event name from API)
            // Skip if eventId looks like a database ID (long alphanumeric string) instead of event name
            const eventName = relay.eventId;
            if (eventName && eventName.length < 20 && /^[\d\sA-Z]+$/.test(eventName)) {
              // Valid event name (e.g., "200 Medley Relay", "400 Free Relay")
              loaded[eventName] = {
                eventId: eventName,
                athletes: relay.members || [null, null, null, null],
                times: relay.times || [null, null, null, null],
                useRelaySplits: relay.useRelaySplits || [false, true, true, true],
              };
            } else {
              // Skip old format entries with database IDs
              console.warn(`Skipping relay entry with invalid eventId format: ${eventName}`);
            }
          });
          // Merge with initialized entries to ensure all events are present
          const merged = { ...entries, ...loaded };
          setRelayEntries(merged);
          setSavedRelayEntries(JSON.parse(JSON.stringify(merged))); // Deep copy
          if (data.correctionFactor !== undefined) {
            setCorrectionFactor(data.correctionFactor);
          }
        }
      })
      .catch((error) => {
        console.error("Error loading relays:", error);
        // No existing relays - entries already initialized above
      });
  }, [meetId, meetTeam.teamId, relayEvents]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const current = JSON.stringify(relayEntries);
    const saved = JSON.stringify(savedRelayEntries);
    return current !== saved;
  }, [relayEntries, savedRelayEntries]);

  // Get flat-start events for a specific leg based on stroke and distance
  const getFlatStartEvents = (stroke: string, distance: string) => {
    const events: { name: string; distance: string }[] = [];
    const eventName = `${distance} ${stroke}`;
    events.push({ name: eventName, distance });
    return events;
  };

  // Get athlete's time for an event
  const getAthleteTime = (athleteId: string, eventName: string, isRelaySplit: boolean) => {
    const athlete = team.athletes.find((a) => a.id === athleteId);
    if (!athlete) return null;

    const eventTime = athlete.eventTimes.find(
      (et) => et.event.name === eventName && et.isRelaySplit === isRelaySplit
    );
    return eventTime ? { time: eventTime.time, seconds: eventTime.timeSeconds } : null;
  };

  // Calculate relay time for a leg
  const calculateLegTime = (
    athleteId: string | null,
    legIndex: number,
    stroke: string,
    eventId: string,
    useRelaySplit: boolean,
    customTime: string | null,
    distance: string
  ): string | null => {
    if (!athleteId) return null;
    if (customTime) return customTime;

    const entry = relayEntries[eventId];
    if (!entry) return null;

    // Get the specific event for this leg (e.g., "50 FR", "100 BK")
    const flatStartEvents = getFlatStartEvents(stroke, distance);

    if (legIndex === 0) {
      // First leg: use flat-start individual event
      for (const event of flatStartEvents) {
        const timeData = getAthleteTime(athleteId, event.name, false);
        if (timeData) {
          return timeData.time;
        }
      }
      return null;
    } else {
      // Other legs: use relay split OR flat-start minus correction
      if (useRelaySplit) {
        // Try to find relay split first
        for (const event of flatStartEvents) {
          const timeData = getAthleteTime(athleteId, event.name, true);
          if (timeData) {
            return timeData.time;
          }
        }
        // Fall back to flat-start minus correction
        for (const event of flatStartEvents) {
          const timeData = getAthleteTime(athleteId, event.name, false);
          if (timeData) {
            const adjustedSeconds = timeData.seconds - correctionFactor;
            return formatSecondsToTime(Math.max(0, adjustedSeconds));
          }
        }
      } else {
        // Use flat-start minus correction
        for (const event of flatStartEvents) {
          const timeData = getAthleteTime(athleteId, event.name, false);
          if (timeData) {
            const adjustedSeconds = timeData.seconds - correctionFactor;
            return formatSecondsToTime(Math.max(0, adjustedSeconds));
          }
        }
      }
    }
    return null;
  };

  // Validate relay assignments (4 relay limit per swimmer)
  const validateRelays = () => {
    const athleteRelayCount: Record<string, number> = {};
    
    Object.values(relayEntries).forEach((entry) => {
      entry.athletes.forEach((athleteId) => {
        if (athleteId) {
          athleteRelayCount[athleteId] = (athleteRelayCount[athleteId] || 0) + 1;
        }
      });
    });

    const violations: string[] = [];
    Object.entries(athleteRelayCount).forEach(([athleteId, count]) => {
      if (count > maxRelays) {
        const athlete = team.athletes.find((a) => a.id === athleteId);
        if (athlete) {
          violations.push(
            `${formatName(athlete.firstName, athlete.lastName)}: ${count} relays (max ${maxRelays})`
          );
        }
      }
    });

    return { isValid: violations.length === 0, violations };
  };

  const validation = useMemo(() => validateRelays(), [relayEntries, maxRelays, team.athletes]);

  // Calculate relay assignments per athlete
  const athleteRelayAssignments = useMemo(() => {
    const assignments: Record<string, { count: number; relays: string[] }> = {};

    Object.entries(relayEntries).forEach(([eventId, entry]) => {
      const event = relayEvents.find((e) => e.id === eventId);
      const eventName = event?.name || eventId;

      entry.athletes.forEach((athleteId) => {
        if (athleteId) {
          if (!assignments[athleteId]) {
            assignments[athleteId] = { count: 0, relays: [] };
          }
          assignments[athleteId].count++;
          assignments[athleteId].relays.push(eventName);
        }
      });
    });

    return assignments;
  }, [relayEntries, relayEvents]);

  const handleClear = async () => {
    if (!confirm(`Are you sure you want to clear all relays for ${team.name}? This action cannot be undone.`)) {
      return;
    }

    setClearing(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/relays/${meetTeam.teamId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear relays");
      }

      // Reset local state
      const entries: Record<string, RelayEntry> = {};
      relayEvents.forEach((event) => {
        entries[event.id] = {
          eventId: event.id,
          athletes: [null, null, null, null],
          times: [null, null, null, null],
          useRelaySplits: [false, true, true, true],
        };
      });
      setRelayEntries(entries);
      setSavedRelayEntries(JSON.parse(JSON.stringify(entries))); // Deep copy

      toast.success(`${team.name} relays cleared successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear relays");
    } finally {
      setClearing(false);
    }
  };

  const handleSave = async () => {
    if (!validation.isValid) {
      toast.error("Please fix relay assignment violations before saving");
      return;
    }

    setSaving(true);
    try {
      // Calculate actual times for each leg before saving
      const relays = Object.values(relayEntries)
        .map((entry) => {
          const event = relayEvents.find((e) => e.id === entry.eventId);
          if (!event) {
            console.warn(`Event not found for entry: ${entry.eventId}`);
            return null;
          }

          // Only include relays that have at least one athlete assigned
          const hasAthletes = entry.athletes.some((athleteId) => athleteId !== null);
          if (!hasAthletes) {
            return null; // Skip empty relays
          }

          const calculatedTimes = event.legs.map((stroke, idx) => {
            // Use custom time if provided, otherwise calculate
            if (entry.times[idx]) {
              return entry.times[idx];
            }
            return calculateLegTime(
              entry.athletes[idx],
              idx,
              stroke,
              entry.eventId,
              entry.useRelaySplits[idx],
              entry.times[idx],
              event.distances[idx]
            );
          });

          return {
            eventId: entry.eventId,
            members: entry.athletes,
            times: calculatedTimes,
            useRelaySplits: entry.useRelaySplits,
          };
        })
        .filter((r) => r !== null) as any[];
      
      console.log("Saving relays:", JSON.stringify(relays, null, 2));

      const response = await fetch(`/api/meets/${meetId}/relays/${meetTeam.teamId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relays,
          correctionFactor,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to save relays";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
          if (error.violations && Array.isArray(error.violations)) {
            errorMessage += `: ${error.violations.join(", ")}`;
          }
          if (error.details) {
            console.error("Validation details:", error.details);
            errorMessage += " (check console for details)";
          }
        } catch (e) {
          // Response might not be JSON
          const text = await response.text();
          console.error("Error response:", text);
          errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      toast.success(`${team.name} relays saved successfully`);
      // Update saved state
      setSavedRelayEntries(JSON.parse(JSON.stringify(relayEntries))); // Deep copy
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save relays");
    } finally {
      setSaving(false);
    }
  };

  // Expose save function and unsaved state to parent
  useEffect(() => {
    (window as any)[`relayCreator_${meetTeam.teamId}`] = {
      hasUnsavedChanges,
      save: handleSave,
    };
    return () => {
      delete (window as any)[`relayCreator_${meetTeam.teamId}`];
    };
  }, [hasUnsavedChanges, meetTeam.teamId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{team.name}</CardTitle>
            <CardDescription>
              Create relay lineups (max {maxRelays} relays per swimmer)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {validation.isValid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Valid
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Violations
              </Badge>
            )}
            <Button
              onClick={handleClear}
              disabled={clearing}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {clearing ? "Clearing..." : "Clear Relays"}
            </Button>
            <Button onClick={handleSave} disabled={!validation.isValid || saving} size="sm">
              {saving ? "Saving..." : "Save Relays"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Correction Factor */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
          <Label htmlFor="correctionFactor" className="whitespace-nowrap">
            Flat-Start to Flying Exchange Correction:
          </Label>
          <Input
            id="correctionFactor"
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={correctionFactor}
            onChange={(e) => setCorrectionFactor(parseFloat(e.target.value) || 0.5)}
            className="w-24"
          />
          <span className="text-sm text-slate-600">seconds</span>
        </div>

        {/* Relay Assignments Summary */}
        {Object.keys(athleteRelayAssignments).length > 0 && (
          <Card className="bg-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">Relay Assignments Summary</CardTitle>
              <CardDescription>
                Swimmers assigned to relays and their relay count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(athleteRelayAssignments)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([athleteId, assignment]) => {
                    const athlete = team.athletes.find((a) => a.id === athleteId);
                    if (!athlete) return null;

                    const isAtLimit = assignment.count >= maxRelays;
                    const isNearLimit = assignment.count >= maxRelays - 1;

                    return (
                      <div
                        key={athleteId}
                        className={`p-3 rounded-lg border ${
                          isAtLimit
                            ? "bg-red-50 border-red-200"
                            : isNearLimit
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {formatName(athlete.firstName, athlete.lastName)}
                          </span>
                          <Badge
                            variant={
                              isAtLimit
                                ? "destructive"
                                : isNearLimit
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {assignment.count}/{maxRelays}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600">
                          <div className="font-semibold mb-1">Relays:</div>
                          <div className="flex flex-wrap gap-1">
                            {assignment.relays.map((relay, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px] py-0 px-1.5"
                              >
                                {relay}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Errors */}
        {!validation.isValid && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Relay Limit Violations:</h4>
            <ul className="list-disc list-inside text-sm text-red-800">
              {validation.violations.map((violation, idx) => (
                <li key={idx}>{violation}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Relay Events */}
        <Tabs defaultValue={relayEvents[0]?.id} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {relayEvents.map((event) => (
              <TabsTrigger key={event.id} value={event.id}>
                {event.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {relayEvents.map((event) => {
            const entry = relayEntries[event.id] || {
              eventId: event.id,
              athletes: [null, null, null, null],
              times: [null, null, null, null],
              useRelaySplits: [false, true, true, true],
            };

            return (
              <TabsContent key={event.id} value={event.id} className="space-y-4 mt-4">
                <div className="grid grid-cols-4 gap-4">
                  {event.legs.map((stroke, legIndex) => {
                    const athleteId = entry.athletes[legIndex];
                    const customTime = entry.times[legIndex];
                    const useRelaySplit = entry.useRelaySplits[legIndex];
                    const distance = event.distances[legIndex];
                    const calculatedTime = calculateLegTime(
                      athleteId,
                      legIndex,
                      stroke,
                      event.id,
                      useRelaySplit,
                      customTime,
                      distance
                    );

                    return (
                      <Card key={legIndex} className="p-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="font-semibold">
                              Leg {legIndex + 1} - {distance} {stroke}
                            </Label>
                            {legIndex === 0 && (
                              <p className="text-xs text-slate-500 mt-1">
                                Flat-start time ({distance} {stroke})
                              </p>
                            )}
                            {legIndex > 0 && (
                              <p className="text-xs text-slate-500 mt-1">
                                {useRelaySplit ? `Relay split (${distance} ${stroke})` : `Flat-start - ${correctionFactor}s (${distance} ${stroke})`}
                              </p>
                            )}
                          </div>

                          {/* Athlete Selector */}
                          <Select
                            value={athleteId || "none"}
                            onValueChange={(value) => {
                              const newEntries = { ...relayEntries };
                              if (!newEntries[event.id]) {
                                newEntries[event.id] = { ...entry };
                              }
                              newEntries[event.id].athletes[legIndex] = value === "none" ? null : value;
                              setRelayEntries(newEntries);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select athlete" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {team.athletes.map((athlete) => (
                                <SelectItem key={athlete.id} value={athlete.id}>
                                  {formatName(athlete.firstName, athlete.lastName)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Time Source Toggle (for legs 2-4) */}
                          {legIndex > 0 && athleteId && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Use:</Label>
                              <Select
                                value={useRelaySplit ? "split" : "flat"}
                                onValueChange={(value) => {
                                  const newEntries = { ...relayEntries };
                                  if (!newEntries[event.id]) {
                                    newEntries[event.id] = { ...entry };
                                  }
                                  newEntries[event.id].useRelaySplits[legIndex] = value === "split";
                                  setRelayEntries(newEntries);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="split">Relay Split</SelectItem>
                                  <SelectItem value="flat">Flat - {correctionFactor}s</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Calculated/Display Time */}
                          {athleteId && (
                            <div className="space-y-2">
                              <div className="text-sm">
                                <span className="text-slate-600">Time: </span>
                                <span className="font-mono font-semibold">
                                  {calculatedTime || "N/A"}
                                </span>
                              </div>
                              {/* Custom Time Override */}
                              <div>
                                <Label className="text-xs">Custom Time (override):</Label>
                                <Input
                                  type="text"
                                  placeholder="e.g., 19.25"
                                  value={customTime || ""}
                                  onChange={(e) => {
                                    const newEntries = { ...relayEntries };
                                    if (!newEntries[event.id]) {
                                      newEntries[event.id] = { ...entry };
                                    }
                                    newEntries[event.id].times[legIndex] = e.target.value || null;
                                    setRelayEntries(newEntries);
                                  }}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Relay Total Time */}
                {entry.athletes.every((a) => a !== null) && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Estimated Relay Time:</span>
                      <span className="font-mono text-lg font-bold">
                        {(() => {
                          const times = event.legs.map((stroke, idx) => {
                            // Use custom time if provided, otherwise calculate
                            const time = entry.times[idx] || calculateLegTime(
                              entry.athletes[idx],
                              idx,
                              stroke,
                              event.id,
                              entry.useRelaySplits[idx],
                              entry.times[idx],
                              event.distances[idx]
                            );
                            return time ? parseTimeToSeconds(time) : 0;
                          });
                          const total = times.reduce((sum, t) => sum + t, 0);
                          return total > 0 ? formatSecondsToTime(total) : "N/A";
                        })()}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      Leg times: {event.legs.map((stroke, idx) => {
                        const time = entry.times[idx] || calculateLegTime(
                          entry.athletes[idx],
                          idx,
                          stroke,
                          event.id,
                          entry.useRelaySplits[idx],
                          entry.times[idx],
                          event.distances[idx]
                        );
                        return `${event.distances[idx]} ${stroke}: ${time ? normalizeTimeFormat(time) : "N/A"}`;
                      }).join(" • ")}
                    </div>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
