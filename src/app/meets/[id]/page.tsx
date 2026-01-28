import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Settings, ListChecks, UsersRound } from "lucide-react";
import Link from "next/link";
import { SimulateMeetViewer } from "@/components/meets/simulate-meet-viewer";
import { sortEventsByOrder } from "@/lib/event-utils";

export default async function MeetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      meetTeams: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              primaryColor: true,
            },
          },
        },
        orderBy: {
          totalScore: "desc",
        },
      },
      meetLineups: {
        include: {
          athlete: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  primaryColor: true,
                },
              },
            },
          },
          event: true,
        },
      },
      relayEntries: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              primaryColor: true,
            },
          },
          event: true,
        },
      },
      conference: true,
      _count: {
        select: {
          meetTeams: true,
          meetLineups: true,
          relayEntries: true,
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  const selectedEvents = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  // Fetch all selected events including individual, relay, and diving events
  const eventsUnsorted = await prisma.event.findMany({
    where: {
      id: { in: selectedEvents },
      // No eventType filter - includes all types: individual, relay, diving
    },
  });

  // Get event order (custom order if set, otherwise null)
  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;

  // Sort events according to custom order or default
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  // Check if meet has been simulated (has places/points assigned)
  const hasResults = meet.meetLineups.some((l) => l.place !== null) || 
                     meet.relayEntries.some((r) => r.place !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{meet.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            {meet.date && (
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>{new Date(meet.date).toLocaleDateString()}</span>
              </div>
            )}
            {meet.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4" />
                <span>{meet.location}</span>
              </div>
            )}
            <Badge variant={meet.status === "completed" ? "default" : "secondary"}>
              {meet.status}
            </Badge>
            <Badge variant="outline">
              {meet.meetType === "championship" ? "Championship" : "Dual"} Meet
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/meets">
              Back to Meets
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/meets/${id}/edit`}>
              <Settings className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Teams</CardDescription>
            <CardTitle className="text-2xl">{meet._count.meetTeams}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Events</CardDescription>
            <CardTitle className="text-2xl">{events.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Individual Entries</CardDescription>
            <CardTitle className="text-2xl">{meet._count.meetLineups}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Relay Entries</CardDescription>
            <CardTitle className="text-2xl">{meet._count.relayEntries}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Team Standings - Prominently displayed */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-2xl">Team Standings</CardTitle>
          <CardDescription>
            Current standings for all participating teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meet.meetTeams.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No teams added yet. Add teams to start scoring.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-4 font-semibold text-sm text-slate-600 border-b pb-2">
                <div>Rank</div>
                <div>Team</div>
                <div className="text-right">Individual</div>
                <div className="text-right">Relays</div>
                <div className="text-right">Diving</div>
                <div className="text-right">Total</div>
              </div>
              {meet.meetTeams.map((meetTeam, index) => (
                <div
                  key={meetTeam.id}
                  className="grid grid-cols-6 gap-4 items-center py-3 border-b last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <div className="font-bold text-xl">#{index + 1}</div>
                  <div className="font-semibold text-lg" style={meetTeam.team.primaryColor ? { color: meetTeam.team.primaryColor, fontWeight: 600 } : {}}>
                    {meetTeam.team.name}
                  </div>
                  <div className="text-right font-medium">{meetTeam.individualScore.toFixed(1)}</div>
                  <div className="text-right font-medium">{meetTeam.relayScore.toFixed(1)}</div>
                  <div className="text-right font-medium">{meetTeam.divingScore.toFixed(1)}</div>
                  <div className="text-right font-bold text-xl">
                    {meetTeam.totalScore.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meet Results Section - Includes simulation and results display */}
      <SimulateMeetViewer
        meet={meet}
        events={events}
        individualScoring={individualScoring}
        relayScoring={relayScoring}
        eventOrder={eventOrder}
      />

      {/* Setup Actions - Only show for draft meets */}
      {meet.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
            <CardDescription>
              Configure rosters, lineups, and relays before simulating
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={`/meets/${id}/roster`}>
                  <Users className="h-4 w-4 mr-2" />
                  Set Rosters
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/meets/${id}/lineups`}>
                  <ListChecks className="h-4 w-4 mr-2" />
                  Set Lineups
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/meets/${id}/relays`}>
                  <UsersRound className="h-4 w-4 mr-2" />
                  Create Relays
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meet Configuration */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roster Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Max Athletes per Team:</span>
              <span className="font-medium">{meet.maxAthletes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Diver Ratio:</span>
              <span className="font-medium">{meet.diverRatio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Diving Included:</span>
              <span className="font-medium">{meet.divingIncluded ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Max Individual Events:</span>
              <span className="font-medium">{meet.maxIndivEvents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Max Relay Events:</span>
              <span className="font-medium">{meet.maxRelays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Max Diving Events:</span>
              <span className="font-medium">{meet.maxDivingEvents}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Scoring Places:</span>
              <span className="font-medium">{meet.scoringPlaces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Points for 1st Place:</span>
              <span className="font-medium">{meet.scoringStartPoints}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Relay Multiplier:</span>
              <span className="font-medium">{meet.relayMultiplier}x</span>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
