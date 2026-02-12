"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, AlertCircle, Trash2, Pencil } from "lucide-react";
import { formatName, formatTeamName, parseTimeToSeconds, formatSecondsToTime, normalizeTimeFormat, normalizeEventName } from "@/lib/utils";
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
  schoolName?: string | null;
  primaryColor?: string | null;
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
  const router = useRouter();
  const [relayEntries, setRelayEntries] = useState<Record<string, RelayEntry>>({});
  const [savedRelayEntries, setSavedRelayEntries] = useState<Record<string, RelayEntry>>({});
  const [correctionFactor, setCorrectionFactor] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const firstEventName = relayEvents[0] ? (relayEvents[0].name || relayEvents[0].id) : "";
  const [selectedEventName, setSelectedEventName] = useState<string>(firstEventName);
  // Which leg is in "custom time" edit mode: "eventName:legIndex" or null
  const [editingLegKey, setEditingLegKey] = useState<string | null>(null);
  const [editingLegValue, setEditingLegValue] = useState<string>("");

  // Initialize relay entries
  useEffect(() => {
    const entries: Record<string, RelayEntry> = {};
    // Use event name as key (not ID) to ensure consistency with saved relays
    relayEvents.forEach((event) => {
      const eventName = event.name || event.id; // Use name if available, fallback to id
      entries[eventName] = {
        eventId: eventName, // Store event name, not database ID
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
            const eventName = relay.eventId;
            if (eventName) {
              // Accept any event name (removed strict regex check)
              loaded[eventName] = {
                eventId: eventName,
                athletes: relay.members || [null, null, null, null],
                times: relay.times || [null, null, null, null],
                useRelaySplits: relay.useRelaySplits || [false, true, true, true],
              };
            } else {
              console.warn(`Skipping relay entry with missing eventId`);
            }
          });
          // Merge with initialized entries to ensure all events are present
          // This ensures saved relays are loaded, and any new events are also included
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

  // Get athlete's time for an event (matches "50 FR" to "50 Free" etc. via normalizeEventName)
  const getAthleteTime = (athleteId: string, eventName: string, isRelaySplit: boolean) => {
    const athlete = team.athletes.find((a) => a.id === athleteId);
    if (!athlete) return null;
    const normalizedSearch = normalizeEventName(eventName);

    const eventTime = athlete.eventTimes.find((et) => {
      const normalizedEt = normalizeEventName(et.event.name);
      return normalizedEt === normalizedSearch && et.isRelaySplit === isRelaySplit;
    });
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
      // Find event by name (eventId is the event name, not database ID)
      const event = relayEvents.find((e) => (e.name || e.id) === eventId);
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
    if (!confirm(`Are you sure you want to clear all relays for ${formatTeamName(team.name, team.schoolName)}? This action cannot be undone.`)) {
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
        const eventName = event.name || event.id;
        entries[eventName] = {
          eventId: eventName,
          athletes: [null, null, null, null],
          times: [null, null, null, null],
          useRelaySplits: [false, true, true, true],
        };
      });
      setRelayEntries(entries);
      setSavedRelayEntries(JSON.parse(JSON.stringify(entries))); // Deep copy

      toast.success(`${formatTeamName(team.name, team.schoolName)} relays cleared successfully`);
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
          // Find event by name (entry.eventId is the event name, not database ID)
          const event = relayEvents.find((e) => (e.name || e.id) === entry.eventId);
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

      toast.success(`${formatTeamName(team.name, team.schoolName)} relays saved successfully`);
      // Update saved state
      setSavedRelayEntries(JSON.parse(JSON.stringify(relayEntries))); // Deep copy
      
      // Reload relays from server to ensure we have the latest data
      // This ensures that if event IDs were resolved, we get the correct data back
      const reloadResponse = await fetch(`/api/meets/${meetId}/relays/${meetTeam.teamId}`);
      if (reloadResponse.ok) {
        const reloadData = await reloadResponse.json();
        if (reloadData.relays && reloadData.relays.length > 0) {
          const reloaded: Record<string, RelayEntry> = {};
          reloadData.relays.forEach((relay: any) => {
            const eventName = relay.eventId;
            if (eventName) {
              reloaded[eventName] = {
                eventId: eventName,
                athletes: relay.members || [null, null, null, null],
                times: relay.times || [null, null, null, null],
                useRelaySplits: relay.useRelaySplits || [false, true, true, true],
              };
            }
          });
          // Merge with current entries to preserve any unsaved changes
          const merged = { ...relayEntries, ...reloaded };
          setRelayEntries(merged);
          setSavedRelayEntries(JSON.parse(JSON.stringify(merged)));
        }
      }
      
      // Refresh router to ensure server components re-fetch data
      router.refresh();
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

  const displayName = formatTeamName(team.name, team.schoolName);
  const accentStyle = team.primaryColor ? { color: team.primaryColor } : undefined;

  return (
    <Card
      className={team.primaryColor ? "border-l-4" : ""}
      style={team.primaryColor ? { borderLeftColor: team.primaryColor } : undefined}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle style={accentStyle}>{displayName}</CardTitle>
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
      <CardContent className="space-y-4">
        {/* Correction factor - compact */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="correctionFactor" className="text-slate-600">
            Flat-start to flying exchange:
          </Label>
          <Input
            id="correctionFactor"
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={correctionFactor}
            onChange={(e) => setCorrectionFactor(parseFloat(e.target.value) || 0.5)}
            className="w-16 h-8 text-sm"
          />
          <span className="text-slate-500">sec</span>
        </div>

        {/* Validation Errors - compact */}
        {!validation.isValid && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            <span className="font-semibold">Violations: </span>
            {validation.violations.join("; ")}
          </div>
        )}

        {/* Two-column: relay construction (left) + swimmers list (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(240px,320px)] gap-6">
          {/* Left: Relay event dropdown + vertical leg table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-slate-700">Relay event</Label>
              <Select
                value={selectedEventName || firstEventName}
                onValueChange={(v) => setSelectedEventName(v)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select relay" />
                </SelectTrigger>
                <SelectContent>
                  {relayEvents.map((event) => {
                    const name = event.name || event.id;
                    return (
                      <SelectItem key={event.id} value={name}>
                        {event.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const event = relayEvents.find((e) => (e.name || e.id) === selectedEventName) || relayEvents[0];
              if (!event) return null;
              const eventName = event.name || event.id;
              const entry = relayEntries[eventName] || {
                eventId: eventName,
                athletes: [null, null, null, null],
                times: [null, null, null, null],
                useRelaySplits: [false, true, true, true],
              };

              return (
                <>
                  <div className="rounded-md border">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-12 px-3 py-2 text-xs">Pos</TableHead>
                          <TableHead className="min-w-[11rem] px-4 py-2 pr-8 text-xs">Swimmer</TableHead>
                          <TableHead className="w-[6.25rem] px-4 py-2 text-xs text-right">Relay Leg</TableHead>
                          <TableHead className="w-[8.5rem] px-4 py-2 text-xs text-center">Time</TableHead>
                          {event.legs.some((_, i) => i > 0) && (
                            <TableHead className="w-[7.25rem] pl-4 pr-4 py-2 text-xs text-right">Source</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {event.legs.map((stroke, legIndex) => {
                          const athleteId = entry.athletes[legIndex];
                          const customTime = entry.times[legIndex];
                          const useRelaySplit = entry.useRelaySplits[legIndex];
                          const distance = event.distances[legIndex];
                          const calculatedTime = calculateLegTime(
                            athleteId,
                            legIndex,
                            stroke,
                            eventName,
                            useRelaySplit,
                            customTime,
                            distance
                          );
                          const strokeLabel = `${distance} ${stroke}`;

                          return (
                            <TableRow key={legIndex} className="align-middle">
                              <TableCell className="w-12 px-3 py-2 font-medium text-slate-600">
                                {legIndex + 1}
                              </TableCell>
                              <TableCell className="min-w-[11rem] px-4 py-2 pr-8">
                                <Select
                                  value={athleteId || "none"}
                                  onValueChange={(value) => {
                                    const newEntries = { ...relayEntries };
                                    if (!newEntries[eventName]) newEntries[eventName] = { ...entry };
                                    newEntries[eventName].athletes[legIndex] = value === "none" ? null : value;
                                    // Clear custom time for this leg so the displayed time updates to the new swimmer's calculated time
                                    newEntries[eventName].times[legIndex] = null;
                                    setRelayEntries(newEntries);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {team.athletes.map((a) => (
                                      <SelectItem key={a.id} value={a.id}>
                                        {formatName(a.firstName, a.lastName)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="w-[6.25rem] px-4 py-2 text-right text-slate-600 text-sm">
                                {strokeLabel}
                              </TableCell>
                              <TableCell className="w-[8.5rem] px-4 py-2 text-center">
                                {athleteId ? (
                                  (() => {
                                    const effectiveTime = customTime || calculatedTime || "";
                                    const isEditing = editingLegKey === `${eventName}:${legIndex}`;
                                    const handleSaveCustom = () => {
                                      const val = editingLegValue.trim();
                                      const newEntries = { ...relayEntries };
                                      if (!newEntries[eventName]) newEntries[eventName] = { ...entry };
                                      newEntries[eventName].times[legIndex] = val || null;
                                      setRelayEntries(newEntries);
                                      setEditingLegKey(null);
                                      setEditingLegValue("");
                                    };
                                    if (isEditing) {
                                      return (
                                        <div className="grid grid-cols-[1fr_auto] gap-1 items-center justify-items-center">
                                          <Input
                                            type="text"
                                            placeholder="e.g. 19.25"
                                            value={editingLegValue}
                                            onChange={(e) => setEditingLegValue(e.target.value)}
                                            onBlur={handleSaveCustom}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleSaveCustom();
                                              if (e.key === "Escape") {
                                                setEditingLegKey(null);
                                                setEditingLegValue("");
                                              }
                                            }}
                                            className="h-8 min-w-[5.5rem] w-28 text-sm font-mono justify-self-center"
                                            autoFocus
                                          />
                                          <span className="text-xs text-slate-500 whitespace-nowrap">Custom time</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="grid grid-cols-[1fr_auto] gap-1 items-center w-full">
                                        <span className="font-mono text-sm justify-self-center">
                                          {effectiveTime || "—"}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingLegKey(`${eventName}:${legIndex}`);
                                            setEditingLegValue(effectiveTime || "");
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                          title="Edit custom time"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </TableCell>
                              {event.legs.some((_, i) => i > 0) && (
                                <TableCell className="w-[7.25rem] pl-4 pr-4 py-2 text-right">
                                  {legIndex > 0 && athleteId ? (
                                    <Select
                                      value={customTime != null && customTime !== "" ? "custom" : (useRelaySplit ? "split" : "flat")}
                                      onValueChange={(value) => {
                                        const newEntries = { ...relayEntries };
                                        if (!newEntries[eventName]) newEntries[eventName] = { ...entry };
                                        if (value === "custom") {
                                          const calc = calculateLegTime(
                                            athleteId,
                                            legIndex,
                                            stroke,
                                            eventName,
                                            useRelaySplit,
                                            null,
                                            distance
                                          );
                                          newEntries[eventName].times[legIndex] = calc || null;
                                        } else {
                                          newEntries[eventName].times[legIndex] = null;
                                          newEntries[eventName].useRelaySplits[legIndex] = value === "split";
                                        }
                                        setRelayEntries(newEntries);
                                      }}
                                    >
                                      <SelectTrigger className="h-8 min-w-[7rem] text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="split">Split</SelectItem>
                                        <SelectItem value="flat">Flat −{correctionFactor}s</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : legIndex === 0 ? (
                                    <span className="text-xs text-slate-500">Flat start</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                        {entry.athletes.every((a) => a !== null) && (
                          <TableRow className="bg-slate-50 border-t-2 border-slate-200">
                            <TableCell className="w-12 px-3 py-2 font-medium text-slate-700">
                              Total
                            </TableCell>
                            <TableCell className="min-w-[11rem] px-4 py-2 pr-8" />
                            <TableCell className="w-[6.25rem] px-4 py-2" />
                            <TableCell className="w-[8.5rem] px-4 py-2 text-center">
                              <div className="grid grid-cols-[1fr_auto] gap-1 items-center w-full">
                                <span className="font-mono font-bold justify-self-center">
                                  {(() => {
                                    const times = event.legs.map((stroke, idx) => {
                                      const time = entry.times[idx] || calculateLegTime(
                                        entry.athletes[idx],
                                        idx,
                                        stroke,
                                        eventName,
                                        entry.useRelaySplits[idx],
                                        entry.times[idx],
                                        event.distances[idx]
                                      );
                                      return time ? parseTimeToSeconds(time) : 0;
                                    });
                                    const total = times.reduce((sum, t) => sum + t, 0);
                                    return total > 0 ? formatSecondsToTime(total) : "—";
                                  })()}
                                </span>
                                <span className="w-7" aria-hidden />
                              </div>
                            </TableCell>
                            {event.legs.some((_, i) => i > 0) && <TableCell className="w-[7.25rem] pl-4 pr-4 py-2" />}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Right: Swimmers in relays - matrix of swimmer × relay with split times */}
          <div className="rounded-md border bg-slate-50/50 min-w-0">
            <div className="px-3 py-2 border-b bg-white">
              <h4 className="text-sm font-semibold text-slate-800">Swimmers in relays</h4>
              <p className="text-xs text-slate-500">Split time per relay in team colors</p>
            </div>
            {Object.keys(athleteRelayAssignments).length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                Add swimmers to relays to see the matrix here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full" style={{ minWidth: "max-content" }}>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80">
                      <TableHead className="min-w-[6rem] px-4 py-2 text-xs font-medium whitespace-nowrap">Name</TableHead>
                      <TableHead className="min-w-[2.5rem] px-3 py-2 text-xs font-medium">Year</TableHead>
                      {relayEvents.map((evt) => (
                        <TableHead key={evt.id} className="min-w-[8rem] px-4 py-2 text-xs font-medium whitespace-nowrap text-center">
                          {evt.name}
                        </TableHead>
                      ))}
                      <TableHead className="min-w-[5.5rem] px-3 py-2 text-xs font-medium text-right whitespace-nowrap">Relay Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(athleteRelayAssignments)
                      .sort(([, a], [, b]) => b.count - a.count || 0)
                      .map(([athleteId, assignment]) => {
                        const athlete = team.athletes.find((a) => a.id === athleteId);
                        if (!athlete) return null;
                        const isAtLimit = assignment.count >= maxRelays;
                        const isNearLimit = assignment.count >= maxRelays - 1;
                        const teamColorStyle = team.primaryColor ? { color: team.primaryColor, fontWeight: 700 } : { fontWeight: 700 };

                        return (
                          <TableRow
                            key={athleteId}
                            className={isAtLimit ? "bg-red-50/80" : isNearLimit ? "bg-amber-50/80" : ""}
                          >
                            <TableCell className="min-w-[6rem] px-4 py-2 font-medium text-sm whitespace-nowrap">
                              {formatName(athlete.firstName, athlete.lastName)}
                            </TableCell>
                            <TableCell className="min-w-[2.5rem] px-3 py-2 text-xs text-slate-600">
                              {athlete.year || "—"}
                            </TableCell>
                            {relayEvents.map((evt) => {
                              const eventName = evt.name || evt.id;
                              const entry = relayEntries[eventName];
                              if (!entry) return <TableCell key={evt.id} className="min-w-[8rem] px-4 py-2 text-center align-middle">—</TableCell>;
                              const legIndex = entry.athletes.findIndex((id) => id === athleteId);
                              if (legIndex === -1) {
                                return <TableCell key={evt.id} className="min-w-[8rem] px-4 py-2 text-center align-middle text-slate-300">—</TableCell>;
                              }
                              const stroke = evt.legs[legIndex];
                              const distance = evt.distances[legIndex];
                              const time = entry.times[legIndex] || calculateLegTime(
                                athleteId,
                                legIndex,
                                stroke,
                                eventName,
                                entry.useRelaySplits[legIndex],
                                entry.times[legIndex],
                                distance
                              );
                              return (
                                <TableCell key={evt.id} className="min-w-[8rem] px-4 py-2 text-center align-middle">
                                  <span className="font-mono text-sm" style={teamColorStyle}>
                                    {time ? normalizeTimeFormat(time) : "—"}
                                  </span>
                                </TableCell>
                              );
                            })}
                            <TableCell className="min-w-[5.5rem] px-3 py-2 text-right">
                              <Badge
                                variant={isAtLimit ? "destructive" : isNearLimit ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {assignment.count}/{maxRelays}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {/* Total row: aggregate time per relay */}
                    <TableRow className="bg-slate-100/80 border-t-2 border-slate-200">
                      <TableCell className="min-w-[6rem] px-4 py-2 font-medium text-slate-700">
                        Total
                      </TableCell>
                      <TableCell className="min-w-[2.5rem] px-3 py-2" />
                      {relayEvents.map((evt) => {
                        const eventName = evt.name || evt.id;
                        const entry = relayEntries[eventName];
                        if (!entry || !entry.athletes.every((a) => a !== null)) {
                          return <TableCell key={evt.id} className="min-w-[8rem] px-4 py-2 text-center align-middle text-slate-400">—</TableCell>;
                        }
                        const times = evt.legs.map((stroke, idx) => {
                          const time = entry.times[idx] || calculateLegTime(
                            entry.athletes[idx],
                            idx,
                            stroke,
                            eventName,
                            entry.useRelaySplits[idx],
                            entry.times[idx],
                            evt.distances[idx]
                          );
                          return time ? parseTimeToSeconds(time) : 0;
                        });
                        const totalSeconds = times.reduce((sum, t) => sum + t, 0);
                        const totalFormatted = totalSeconds > 0 ? formatSecondsToTime(totalSeconds) : "—";
                        return (
                          <TableCell key={evt.id} className="min-w-[8rem] px-4 py-2 text-center align-middle">
                            <span className="font-mono text-sm font-bold text-slate-800">
                              {totalFormatted}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="min-w-[5.5rem] px-3 py-2" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
