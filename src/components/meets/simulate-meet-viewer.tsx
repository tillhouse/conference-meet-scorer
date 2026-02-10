"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatName, formatTeamName, formatSecondsToTime, parseTimeToSeconds, normalizeTimeFormat } from "@/lib/utils";
import { sortEventsByOrder } from "@/lib/event-utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Meet {
  id: string;
  name: string;
  scoringPlaces: number;
  meetTeams: {
    id: string;
    teamId: string;
    individualScore: number;
    relayScore: number;
    divingScore: number;
    totalScore: number;
    team: {
      id: string;
      name: string;
      schoolName?: string | null;
      primaryColor: string | null;
    };
  }[];
  meetLineups: {
    id: string;
    athleteId: string;
    eventId: string;
    seedTime: string | null;
    seedTimeSeconds: number | null;
    finalTime: string | null;
    finalTimeSeconds: number | null;
    place: number | null;
    points: number | null;
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
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
  }[];
  relayEntries: {
    id: string;
    teamId: string;
    eventId: string;
    seedTime: string | null;
    seedTimeSeconds: number | null;
    finalTime: string | null;
    finalTimeSeconds: number | null;
    place: number | null;
    points: number | null;
    members: string | null;
    team: {
      id: string;
      name: string;
      schoolName?: string | null;
      primaryColor: string | null;
    };
    event: {
      id: string;
      name: string;
      eventType: string;
    };
  }[];
}

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface SimulateMeetViewerProps {
  meet: Meet;
  events: Event[];
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
  eventOrder?: string[] | null;
}

export function SimulateMeetViewer({
  meet,
  events,
  individualScoring,
  relayScoring,
  eventOrder,
}: SimulateMeetViewerProps) {
  // Check if meet has been simulated (has places/points assigned)
  const hasResults = meet.meetLineups.some((l) => l.place !== null) || 
                     meet.relayEntries.some((r) => r.place !== null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("all");

  // Group lineups by event
  const lineupsByEvent: Record<string, typeof meet.meetLineups> = {};
  meet.meetLineups.forEach((lineup) => {
    if (!lineupsByEvent[lineup.eventId]) {
      lineupsByEvent[lineup.eventId] = [];
    }
    lineupsByEvent[lineup.eventId].push(lineup);
  });

  // Group relays by event
  const relaysByEvent: Record<string, typeof meet.relayEntries> = {};
  meet.relayEntries.forEach((relay) => {
    if (!relaysByEvent[relay.eventId]) {
      relaysByEvent[relay.eventId] = [];
    }
    relaysByEvent[relay.eventId].push(relay);
  });

  // Get all unique event IDs from lineups and relays
  const lineupEventIds = new Set(meet.meetLineups.map((l) => l.eventId));
  const relayEventIds = new Set(meet.relayEntries.map((r) => r.eventId));
  const allEventIds = new Set([...lineupEventIds, ...relayEventIds]);

  // Get events from database for all event IDs
  const allEventsMap = new Map(events.map((e) => [e.id, e]));

  // Add events from lineups/relays that might not be in selectedEvents
  meet.meetLineups.forEach((lineup) => {
    if (lineup.event && !allEventsMap.has(lineup.eventId)) {
      allEventsMap.set(lineup.eventId, lineup.event);
    }
  });
  meet.relayEntries.forEach((relay) => {
    if (relay.event && !allEventsMap.has(relay.eventId)) {
      allEventsMap.set(relay.eventId, relay.event);
    }
  });

  const allEvents = Array.from(allEventsMap.values());

  // Sort events by custom order if provided, otherwise by type and name
  let sortedEvents: Event[];
  if (eventOrder && eventOrder.length > 0) {
    // Use custom order
    sortedEvents = sortEventsByOrder(allEvents, eventOrder);
  } else {
    // Default sort by type and name
    sortedEvents = [...allEvents].sort((a, b) => {
      if (a.eventType !== b.eventType) {
        if (a.eventType === "individual") return -1;
        if (b.eventType === "individual") return 1;
        if (a.eventType === "relay") return -1;
        if (b.eventType === "relay") return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  const swimmingEvents = sortedEvents.filter((e) => e.eventType === "individual");
  const divingEvents = sortedEvents.filter((e) => e.eventType === "diving");
  const relayEvents = sortedEvents.filter((e) => e.eventType === "relay");

  // Get events based on current filter
  const filteredEvents = useMemo(() => {
    if (eventFilter === "swimming") return swimmingEvents;
    if (eventFilter === "diving") return divingEvents;
    if (eventFilter === "relays") return relayEvents;
    return sortedEvents;
  }, [eventFilter, swimmingEvents, divingEvents, relayEvents, sortedEvents]);

  const currentEventIndex = selectedEventId
    ? filteredEvents.findIndex((e) => e.id === selectedEventId)
    : -1;

  // Initialize selected event to first event if none selected or when filter changes
  useEffect(() => {
    if (filteredEvents.length > 0) {
      // If current selection is not in filtered events, or no selection, pick first
      if (!selectedEventId || !filteredEvents.find((e) => e.id === selectedEventId)) {
        setSelectedEventId(filteredEvents[0].id);
      }
    }
  }, [eventFilter, filteredEvents, selectedEventId]);

  const handlePreviousEvent = () => {
    if (currentEventIndex > 0) {
      setSelectedEventId(filteredEvents[currentEventIndex - 1].id);
    }
  };

  const handleNextEvent = () => {
    if (currentEventIndex < filteredEvents.length - 1) {
      setSelectedEventId(filteredEvents[currentEventIndex + 1].id);
    }
  };

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  // Helper to get team color style
  const getTeamColorStyle = (primaryColor: string | null) => {
    if (!primaryColor) return {};
    return { color: primaryColor, fontWeight: 600 };
  };


  // Sort results for an event (fastest first for swimming, highest first for diving)
  const sortEventResults = (
    results: typeof meet.meetLineups | typeof meet.relayEntries,
    eventType: string
  ) => {
    return [...results].sort((a, b) => {
      // Use seed time for sorting
      const aTime = a.seedTimeSeconds ?? (a as any).seedTimeSeconds;
      const bTime = b.seedTimeSeconds ?? (b as any).seedTimeSeconds;

      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;

      if (eventType === "diving") {
        // Diving: higher score is better
        return bTime - aTime;
      } else {
        // Swimming: lower time is better
        return aTime - bTime;
      }
    });
  };

  return (
    <div className="space-y-6">

      {/* Results Display - Show if results exist */}
      {hasResults && (
      <Card>
        <CardHeader>
          <CardTitle>{hasResults ? "Meet Results" : "Event Preview"}</CardTitle>
          <CardDescription>
            {hasResults 
              ? "Simulated results based on seed times. Events are sorted by projected finish order."
              : "Preview of how results will be simulated based on seed times"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={setEventFilter}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">All Events</TabsTrigger>
                <TabsTrigger value="swimming">Swimming</TabsTrigger>
                <TabsTrigger value="diving">Diving</TabsTrigger>
                <TabsTrigger value="relays">Relays</TabsTrigger>
              </TabsList>
              
              {/* Event Navigation */}
              {filteredEvents.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousEvent}
                    disabled={currentEventIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={selectedEventId || "all"}
                    onValueChange={(value) => {
                      if (value === "all") {
                        setSelectedEventId(null);
                      } else {
                        setSelectedEventId(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select event..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Show All Events</SelectItem>
                      {filteredEvents.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextEvent}
                    disabled={currentEventIndex >= filteredEvents.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {selectedEventId && (
                    <span className="text-sm text-slate-500 ml-2">
                      {currentEventIndex + 1} of {filteredEvents.length}
                    </span>
                  )}
                </div>
              )}
            </div>

            <TabsContent value="all" className="mt-4">
              <div className="space-y-4">
                {(selectedEventId
                  ? sortedEvents.filter((e) => e.id === selectedEventId)
                  : sortedEvents
                ).map((event) => {
                  if (event.eventType === "relay") {
                    const relays = relaysByEvent[event.id] || [];
                    const sortedRelays = sortEventResults(relays, "relay") as typeof meet.relayEntries;

                    return (
                      <div 
                        key={event.id} 
                        id={`event-${event.id}`} 
                        className="border rounded-lg p-4 border-slate-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{event.name}</h3>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/meets/${meet.id}/events/${event.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                        {sortedRelays.length === 0 ? (
                          <p className="text-slate-500 text-sm">No relays entered</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Projected Place</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead className="text-right">Seed Time</TableHead>
                                <TableHead className="text-right">Projected Points</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedRelays.map((relay, idx) => {
                                const place = idx + 1;
                                const points = relayScoring[place.toString()] || 0;
                                return (
                                  <TableRow key={relay.id}>
                                    <TableCell className="font-bold">
                                      {place <= meet.scoringPlaces ? (
                                        <>
                                          {place}
                                          {place === 1 && " 🥇"}
                                          {place === 2 && " 🥈"}
                                          {place === 3 && " 🥉"}
                                        </>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span style={getTeamColorStyle(relay.team.primaryColor)}>
                                        {formatTeamName(relay.team.name, relay.team.schoolName)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {relay.seedTime ? normalizeTimeFormat(relay.seedTime) : "N/A"}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {place <= meet.scoringPlaces ? points : 0}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  } else {
                    const lineups = lineupsByEvent[event.id] || [];
                    const sortedLineups = sortEventResults(lineups, event.eventType) as typeof meet.meetLineups;

                    return (
                      <div 
                        key={event.id} 
                        id={`event-${event.id}`} 
                        className="border rounded-lg p-4 border-slate-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{event.name}</h3>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/meets/${meet.id}/events/${event.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                        {sortedLineups.length === 0 ? (
                          <p className="text-slate-500 text-sm">No entries</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Projected Place</TableHead>
                                <TableHead>Athlete</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead className="text-right">Seed Time</TableHead>
                                <TableHead className="text-right">Projected Points</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedLineups.map((lineup, idx) => {
                                const place = idx + 1;
                                const points = individualScoring[place.toString()] || 0;
                                return (
                                  <TableRow key={lineup.id}>
                                    <TableCell className="font-bold">
                                      {place <= meet.scoringPlaces ? (
                                        <>
                                          {place}
                                          {place === 1 && " 🥇"}
                                          {place === 2 && " 🥈"}
                                          {place === 3 && " 🥉"}
                                        </>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {formatName(
                                        lineup.athlete.firstName,
                                        lineup.athlete.lastName
                                      )}
                                    </TableCell>
                                    <TableCell>
                                    <span style={getTeamColorStyle(lineup.athlete.team.primaryColor)}>
                                      {formatTeamName(lineup.athlete.team.name, lineup.athlete.team.schoolName)}
                                    </span>
                                  </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {lineup.seedTime ? normalizeTimeFormat(lineup.seedTime) : "N/A"}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {place <= meet.scoringPlaces ? points : 0}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            </TabsContent>

            <TabsContent value="swimming" className="mt-4">
              <div className="space-y-4">
                {(selectedEventId
                  ? swimmingEvents.filter((e) => e.id === selectedEventId)
                  : swimmingEvents
                ).map((event) => {
                  const lineups = lineupsByEvent[event.id] || [];
                  const sortedLineups = sortEventResults(lineups, "individual") as typeof meet.meetLineups;

                  return (
                    <div 
                      key={event.id} 
                      id={`event-${event.id}`} 
                      className="border rounded-lg p-4 border-slate-200"
                    >
                      <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                      {sortedLineups.length === 0 ? (
                        <p className="text-slate-500 text-sm">No entries</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Projected Place</TableHead>
                              <TableHead>Athlete</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead className="text-right">Seed Time</TableHead>
                              <TableHead className="text-right">Projected Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedLineups.map((lineup, idx) => {
                              const place = idx + 1;
                              const points = individualScoring[place.toString()] || 0;
                              return (
                                <TableRow key={lineup.id}>
                                  <TableCell className="font-bold">
                                    {place <= meet.scoringPlaces ? (
                                      <>
                                        {place}
                                        {place === 1 && " 🥇"}
                                        {place === 2 && " 🥈"}
                                        {place === 3 && " 🥉"}
                                      </>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatName(
                                      lineup.athlete.firstName,
                                      lineup.athlete.lastName
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span style={getTeamColorStyle(lineup.athlete.team.primaryColor)}>
                                      {formatTeamName(lineup.athlete.team.name, lineup.athlete.team.schoolName)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {lineup.seedTime || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {place <= meet.scoringPlaces ? points : 0}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="diving" className="mt-4">
              <div className="space-y-4">
                {(selectedEventId
                  ? divingEvents.filter((e) => e.id === selectedEventId)
                  : divingEvents
                ).map((event) => {
                  const lineups = lineupsByEvent[event.id] || [];
                  const sortedLineups = sortEventResults(lineups, "diving") as typeof meet.meetLineups;

                  return (
                    <div 
                      key={event.id} 
                      id={`event-${event.id}`} 
                      className="border rounded-lg p-4 border-slate-200"
                    >
                      <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                      {sortedLineups.length === 0 ? (
                        <p className="text-slate-500 text-sm">No entries</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Projected Place</TableHead>
                              <TableHead>Athlete</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead className="text-right">Seed Score</TableHead>
                              <TableHead className="text-right">Projected Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedLineups.map((lineup, idx) => {
                              const place = idx + 1;
                              const points = individualScoring[place.toString()] || 0;
                              return (
                                <TableRow key={lineup.id}>
                                  <TableCell className="font-bold">
                                    {place <= meet.scoringPlaces ? (
                                      <>
                                        {place}
                                        {place === 1 && " 🥇"}
                                        {place === 2 && " 🥈"}
                                        {place === 3 && " 🥉"}
                                      </>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatName(
                                      lineup.athlete.firstName,
                                      lineup.athlete.lastName
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span style={getTeamColorStyle(lineup.athlete.team.primaryColor)}>
                                      {formatTeamName(lineup.athlete.team.name, lineup.athlete.team.schoolName)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {lineup.seedTime || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {place <= meet.scoringPlaces ? points : 0}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="relays" className="mt-4">
              <div className="space-y-4">
                {(selectedEventId
                  ? relayEvents.filter((e) => e.id === selectedEventId)
                  : relayEvents
                ).map((event) => {
                  const relays = relaysByEvent[event.id] || [];
                  const sortedRelays = sortEventResults(relays, "relay") as typeof meet.relayEntries;

                  return (
                    <div 
                      key={event.id} 
                      id={`event-${event.id}`} 
                      className="border rounded-lg p-4 border-slate-200"
                    >
                      <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                      {sortedRelays.length === 0 ? (
                        <p className="text-slate-500 text-sm">No relays entered</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Projected Place</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead className="text-right">Seed Time</TableHead>
                              <TableHead className="text-right">Projected Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedRelays.map((relay, idx) => {
                              const place = idx + 1;
                              const points = relayScoring[place.toString()] || 0;
                              return (
                                <TableRow key={relay.id}>
                                  <TableCell className="font-bold">
                                    {place <= meet.scoringPlaces ? (
                                      <>
                                        {place}
                                        {place === 1 && " 🥇"}
                                        {place === 2 && " 🥈"}
                                        {place === 3 && " 🥉"}
                                      </>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span style={getTeamColorStyle(relay.team.primaryColor)}>
                                      {formatTeamName(relay.team.name, relay.team.schoolName)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {relay.seedTime || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {place <= meet.scoringPlaces ? points : 0}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
