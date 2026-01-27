"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatName, formatSecondsToTime } from "@/lib/utils";

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
    };
  }[];
  meetLineups: {
    id: string;
    athleteId: string;
    eventId: string;
    seedTime: string | null;
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
    finalTime: string | null;
    finalTimeSeconds: number | null;
    place: number | null;
    points: number | null;
    members: string | null;
    team: {
      id: string;
      name: string;
    };
    event: {
      id: string;
      name: string;
    };
  }[];
}

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface ResultsViewerProps {
  meet: Meet;
  events: Event[];
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
}

export function ResultsViewer({
  meet,
  events,
  individualScoring,
  relayScoring,
}: ResultsViewerProps) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // Calculate team statistics
  const teamStats = meet.meetTeams.map((meetTeam) => {
    const teamLineups = meet.meetLineups.filter(
      (lineup) => lineup.athlete.team.id === meetTeam.teamId
    );
    const teamRelays = meet.relayEntries.filter(
      (relay) => relay.teamId === meetTeam.teamId
    );

    const individualEntries = teamLineups.filter(
      (l) => l.event.eventType === "individual"
    );
    const divingEntries = teamLineups.filter(
      (l) => l.event.eventType === "diving"
    );

    const individualPoints = individualEntries.reduce(
      (sum, entry) => sum + (entry.points || 0),
      0
    );
    const divingPoints = divingEntries.reduce(
      (sum, entry) => sum + (entry.points || 0),
      0
    );
    const relayPoints = teamRelays.reduce(
      (sum, relay) => sum + (relay.points || 0),
      0
    );

    const pointsPerSwim =
      individualEntries.length > 0
        ? individualPoints / individualEntries.length
        : 0;
    const pointsPerDive =
      divingEntries.length > 0 ? divingPoints / divingEntries.length : 0;
    const pointsPerRelay =
      teamRelays.length > 0 ? relayPoints / teamRelays.length : 0;

    return {
      ...meetTeam,
      individualEntries: individualEntries.length,
      divingEntries: divingEntries.length,
      relayEntries: teamRelays.length,
      pointsPerSwim,
      pointsPerDive,
      pointsPerRelay,
    };
  });

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

  // Sort events by type and name
  const sortedEvents = [...events].sort((a, b) => {
    if (a.eventType !== b.eventType) {
      if (a.eventType === "individual") return -1;
      if (b.eventType === "individual") return 1;
      if (a.eventType === "relay") return -1;
      if (b.eventType === "relay") return 1;
    }
    return a.name.localeCompare(b.name);
  });

  const swimmingEvents = sortedEvents.filter((e) => e.eventType === "individual");
  const divingEvents = sortedEvents.filter((e) => e.eventType === "diving");
  const relayEvents = sortedEvents.filter((e) => e.eventType === "relay");

  // Determine which final a place is in
  const getFinalType = (place: number | null): string => {
    if (!place) return "";
    if (place <= 8) return "A Final";
    if (place <= 16) return "B Final";
    if (place <= 24) return "C Final";
    return "Non-Scoring";
  };

  // Sort results for an event (fastest first for swimming, highest first for diving)
  const sortEventResults = (
    results: typeof meet.meetLineups,
    eventType: string
  ) => {
    return [...results].sort((a, b) => {
      // First, sort by place if available
      if (a.place && b.place) {
        return a.place - b.place;
      }
      if (a.place) return -1;
      if (b.place) return 1;

      // Then sort by time/score
      const aTime = a.finalTimeSeconds ?? a.seedTimeSeconds;
      const bTime = b.finalTimeSeconds ?? b.seedTimeSeconds;
      
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
      {/* Team Standings */}
      <Card>
        <CardHeader>
          <CardTitle>Team Standings</CardTitle>
          <CardDescription>
            Current scores and statistics for all teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="standings" className="w-full">
            <TabsList>
              <TabsTrigger value="standings">Standings</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="standings" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Swimming</TableHead>
                    <TableHead className="text-right">Diving</TableHead>
                    <TableHead className="text-right">Relays</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStats.map((team, index) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-bold">#{index + 1}</TableCell>
                      <TableCell className="font-medium">{team.team.name}</TableCell>
                      <TableCell className="text-right">
                        {team.individualScore.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {team.divingScore.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {team.relayScore.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {team.totalScore.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                    <TableHead className="text-right">Points/Swim</TableHead>
                    <TableHead className="text-right">Points/Dive</TableHead>
                    <TableHead className="text-right">Points/Relay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStats.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.team.name}</TableCell>
                      <TableCell className="text-right">
                        {team.individualEntries} swim • {team.divingEntries} dive • {team.relayEntries} relay
                      </TableCell>
                      <TableCell className="text-right">
                        {team.pointsPerSwim > 0 ? team.pointsPerSwim.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {team.pointsPerDive > 0 ? team.pointsPerDive.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {team.pointsPerRelay > 0 ? team.pointsPerRelay.toFixed(2) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Event Results */}
      <Card>
        <CardHeader>
          <CardTitle>Event Results</CardTitle>
          <CardDescription>
            View results by event with heats and scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Events</TabsTrigger>
              <TabsTrigger value="swimming">Swimming</TabsTrigger>
              <TabsTrigger value="diving">Diving</TabsTrigger>
              <TabsTrigger value="relays">Relays</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="space-y-4">
                {sortedEvents.map((event) => {
                  if (event.eventType === "relay") {
                    const relays = relaysByEvent[event.id] || [];
                    const sortedRelays = [...relays].sort((a, b) => {
                      if (!a.finalTimeSeconds && !b.finalTimeSeconds) return 0;
                      if (!a.finalTimeSeconds) return 1;
                      if (!b.finalTimeSeconds) return -1;
                      return a.finalTimeSeconds - b.finalTimeSeconds;
                    });

                    return (
                      <div key={event.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                        {sortedRelays.length === 0 ? (
                          <p className="text-slate-500 text-sm">No relays entered</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Place</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead className="text-right">Time</TableHead>
                                <TableHead className="text-right">Points</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedRelays.map((relay, idx) => (
                                <TableRow key={relay.id}>
                                  <TableCell className="font-bold">
                                    {relay.place ? (
                                      <>
                                        {relay.place}
                                        {relay.place === 1 && " 🥇"}
                                        {relay.place === 2 && " 🥈"}
                                        {relay.place === 3 && " 🥉"}
                                      </>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{relay.team.name}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    {relay.finalTime || relay.seedTime || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {relay.points || 0}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  } else {
                    const lineups = lineupsByEvent[event.id] || [];
                    const sortedLineups = sortEventResults(lineups, event.eventType);

                    return (
                      <div key={event.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                        {sortedLineups.length === 0 ? (
                          <p className="text-slate-500 text-sm">No results yet</p>
                        ) : (
                          <div className="space-y-4">
                            {/* Show entries without places first (seed times) */}
                            {sortedLineups.filter((l) => !l.place).length > 0 && (
                              <div className="border rounded-lg">
                                <div className="p-2 font-semibold text-sm bg-slate-50 border-slate-200 border-b">
                                  Entries (No Results Yet)
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Athlete</TableHead>
                                      <TableHead>Team</TableHead>
                                      <TableHead className="text-right">Seed Time</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sortedLineups
                                      .filter((l) => !l.place)
                                      .map((lineup) => (
                                        <TableRow key={lineup.id}>
                                          <TableCell>
                                            {formatName(
                                              lineup.athlete.firstName,
                                              lineup.athlete.lastName
                                            )}
                                          </TableCell>
                                          <TableCell>{lineup.athlete.team.name}</TableCell>
                                          <TableCell className="text-right font-mono">
                                            {lineup.seedTime || "N/A"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}

                            {/* Group by finals for entries with places */}
                            {[1, 9, 17, 25].map((startPlace) => {
                              const finalResults = sortedLineups.filter(
                                (l) =>
                                  l.place &&
                                  l.place >= startPlace &&
                                  l.place < startPlace + 8
                              );
                              if (finalResults.length === 0) return null;

                              const finalType = getFinalType(startPlace);
                              const headerColor =
                                startPlace === 1
                                  ? "bg-yellow-100 border-yellow-300"
                                  : startPlace === 9
                                  ? "bg-blue-100 border-blue-300"
                                  : startPlace === 17
                                  ? "bg-slate-100 border-slate-300"
                                  : "bg-gray-50 border-gray-200";

                              return (
                                <div key={startPlace} className="border rounded-lg">
                                  <div
                                    className={`p-2 font-semibold text-sm ${headerColor} border-b`}
                                  >
                                    {finalType} (Places {startPlace}-
                                    {Math.min(startPlace + 7, meet.scoringPlaces)})
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Place</TableHead>
                                        <TableHead>Athlete</TableHead>
                                        <TableHead>Team</TableHead>
                                        <TableHead className="text-right">Time</TableHead>
                                        <TableHead className="text-right">Points</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {finalResults.map((lineup) => (
                                        <TableRow key={lineup.id}>
                                          <TableCell className="font-bold">
                                            {lineup.place}
                                            {lineup.place === 1 && " 🥇"}
                                            {lineup.place === 2 && " 🥈"}
                                            {lineup.place === 3 && " 🥉"}
                                          </TableCell>
                                          <TableCell>
                                            {formatName(
                                              lineup.athlete.firstName,
                                              lineup.athlete.lastName
                                            )}
                                          </TableCell>
                                          <TableCell>{lineup.athlete.team.name}</TableCell>
                                          <TableCell className="text-right font-mono">
                                            {lineup.finalTime || lineup.seedTime || "N/A"}
                                          </TableCell>
                                          <TableCell className="text-right font-semibold">
                                            {lineup.points || 0}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            </TabsContent>

            <TabsContent value="swimming" className="mt-4">
              <div className="space-y-4">
                {swimmingEvents.map((event) => {
                  const lineups = lineupsByEvent[event.id] || [];
                  const sortedLineups = sortEventResults(lineups, "individual");

                  return (
                    <div key={event.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                      {sortedLineups.length === 0 ? (
                        <p className="text-slate-500 text-sm">No entries</p>
                      ) : (
                        <div className="space-y-4">
                          {/* Show entries without places first (seed times) */}
                          {sortedLineups.filter((l) => !l.place).length > 0 && (
                            <div className="border rounded-lg">
                              <div className="p-2 font-semibold text-sm bg-slate-50 border-slate-200 border-b">
                                Entries (No Results Yet)
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Athlete</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead className="text-right">Seed Time</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedLineups
                                    .filter((l) => !l.place)
                                    .map((lineup) => (
                                      <TableRow key={lineup.id}>
                                        <TableCell>
                                          {formatName(
                                            lineup.athlete.firstName,
                                            lineup.athlete.lastName
                                          )}
                                        </TableCell>
                                        <TableCell>{lineup.athlete.team.name}</TableCell>
                                        <TableCell className="text-right font-mono">
                                          {lineup.seedTime || "N/A"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* Group by finals for entries with places */}
                          {[1, 9, 17, 25].map((startPlace) => {
                            const finalResults = sortedLineups.filter(
                              (l) =>
                                l.place &&
                                l.place >= startPlace &&
                                l.place < startPlace + 8
                            );
                            if (finalResults.length === 0) return null;

                            const finalType = getFinalType(startPlace);
                            const headerColor =
                              startPlace === 1
                                ? "bg-yellow-100 border-yellow-300"
                                : startPlace === 9
                                ? "bg-blue-100 border-blue-300"
                                : startPlace === 17
                                ? "bg-slate-100 border-slate-300"
                                : "bg-gray-50 border-gray-200";

                            return (
                              <div key={startPlace} className="border rounded-lg">
                                <div
                                  className={`p-2 font-semibold text-sm ${headerColor} border-b`}
                                >
                                  {finalType} (Places {startPlace}-
                                  {Math.min(startPlace + 7, meet.scoringPlaces)})
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Place</TableHead>
                                      <TableHead>Athlete</TableHead>
                                      <TableHead>Team</TableHead>
                                      <TableHead className="text-right">Time</TableHead>
                                      <TableHead className="text-right">Points</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {finalResults.map((lineup) => (
                                      <TableRow key={lineup.id}>
                                        <TableCell className="font-bold">
                                          {lineup.place}
                                          {lineup.place === 1 && " 🥇"}
                                          {lineup.place === 2 && " 🥈"}
                                          {lineup.place === 3 && " 🥉"}
                                        </TableCell>
                                        <TableCell>
                                          {formatName(
                                            lineup.athlete.firstName,
                                            lineup.athlete.lastName
                                          )}
                                        </TableCell>
                                        <TableCell>{lineup.athlete.team.name}</TableCell>
                                        <TableCell className="text-right font-mono">
                                          {lineup.finalTime || lineup.seedTime || "N/A"}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {lineup.points || 0}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="diving" className="mt-4">
              <div className="space-y-4">
                {divingEvents.map((event) => {
                  const lineups = lineupsByEvent[event.id] || [];
                  const sortedLineups = sortEventResults(lineups, "diving");

                  return (
                    <div key={event.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                      {sortedLineups.length === 0 ? (
                        <p className="text-slate-500 text-sm">No entries</p>
                      ) : (
                        <div className="space-y-4">
                          {/* Show entries without places first (seed scores) */}
                          {sortedLineups.filter((l) => !l.place).length > 0 && (
                            <div className="border rounded-lg">
                              <div className="p-2 font-semibold text-sm bg-slate-50 border-slate-200 border-b">
                                Entries (No Results Yet)
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Athlete</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead className="text-right">Seed Score</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedLineups
                                    .filter((l) => !l.place)
                                    .map((lineup) => (
                                      <TableRow key={lineup.id}>
                                        <TableCell>
                                          {formatName(
                                            lineup.athlete.firstName,
                                            lineup.athlete.lastName
                                          )}
                                        </TableCell>
                                        <TableCell>{lineup.athlete.team.name}</TableCell>
                                        <TableCell className="text-right font-mono">
                                          {lineup.seedTime || "N/A"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* Group by finals for entries with places */}
                          {[1, 9, 17, 25].map((startPlace) => {
                            const finalResults = sortedLineups.filter(
                              (l) =>
                                l.place &&
                                l.place >= startPlace &&
                                l.place < startPlace + 8
                            );
                            if (finalResults.length === 0) return null;

                            const finalType = getFinalType(startPlace);
                            const headerColor =
                              startPlace === 1
                                ? "bg-yellow-100 border-yellow-300"
                                : startPlace === 9
                                ? "bg-blue-100 border-blue-300"
                                : startPlace === 17
                                ? "bg-slate-100 border-slate-300"
                                : "bg-gray-50 border-gray-200";

                            return (
                              <div key={startPlace} className="border rounded-lg">
                                <div
                                  className={`p-2 font-semibold text-sm ${headerColor} border-b`}
                                >
                                  {finalType} (Places {startPlace}-
                                  {Math.min(startPlace + 7, meet.scoringPlaces)})
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Place</TableHead>
                                      <TableHead>Athlete</TableHead>
                                      <TableHead>Team</TableHead>
                                      <TableHead className="text-right">Score</TableHead>
                                      <TableHead className="text-right">Points</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {finalResults.map((lineup) => (
                                      <TableRow key={lineup.id}>
                                        <TableCell className="font-bold">
                                          {lineup.place}
                                          {lineup.place === 1 && " 🥇"}
                                          {lineup.place === 2 && " 🥈"}
                                          {lineup.place === 3 && " 🥉"}
                                        </TableCell>
                                        <TableCell>
                                          {formatName(
                                            lineup.athlete.firstName,
                                            lineup.athlete.lastName
                                          )}
                                        </TableCell>
                                        <TableCell>{lineup.athlete.team.name}</TableCell>
                                        <TableCell className="text-right font-mono">
                                          {lineup.finalTime || lineup.seedTime || "N/A"}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {lineup.points || 0}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="relays" className="mt-4">
              <div className="space-y-4">
                {relayEvents.map((event) => {
                  const relays = relaysByEvent[event.id] || [];
                  const sortedRelays = [...relays].sort((a, b) => {
                    if (!a.finalTimeSeconds && !b.finalTimeSeconds) return 0;
                    if (!a.finalTimeSeconds) return 1;
                    if (!b.finalTimeSeconds) return -1;
                    return a.finalTimeSeconds - b.finalTimeSeconds;
                  });

                  return (
                      <div key={event.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">{event.name}</h3>
                        {sortedRelays.length === 0 ? (
                          <p className="text-slate-500 text-sm">No relays entered</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Place</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead className="text-right">Time</TableHead>
                                <TableHead className="text-right">Points</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedRelays.map((relay, idx) => (
                                <TableRow key={relay.id}>
                                  <TableCell className="font-bold">
                                    {relay.place ? (
                                      <>
                                        {relay.place}
                                        {relay.place === 1 && " 🥇"}
                                        {relay.place === 2 && " 🥈"}
                                        {relay.place === 3 && " 🥉"}
                                      </>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{relay.team.name}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    {relay.finalTime || relay.seedTime || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {relay.points || 0}
                                  </TableCell>
                                </TableRow>
                              ))}
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
    </div>
  );
}
