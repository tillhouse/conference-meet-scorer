import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { SimulateMeetButton } from "@/components/meets/simulate-meet-button";
import { ScoreProgressionGraph } from "@/components/meets/score-progression-graph";
import { ClassYearBreakdown } from "@/components/meets/class-year-breakdown";
import { MeetNavigation } from "@/components/meets/meet-navigation";
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
        </div>
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} />

      {/* Team Standings - Prominently displayed */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Team Standings</CardTitle>
              <CardDescription>
                Current standings for all participating teams
              </CardDescription>
            </div>
            <SimulateMeetButton meetId={id} hasResults={hasResults} />
          </div>
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

      {/* Score Progression Graph - Only show if meet has been simulated */}
      {hasResults && (
        <ScoreProgressionGraph
          events={events}
          meetLineups={meet.meetLineups}
          relayEntries={meet.relayEntries}
          teams={meet.meetTeams.map((mt) => mt.team)}
          eventOrder={eventOrder}
        />
      )}

      {/* Class Year Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Class Year Breakdown</CardTitle>
          <CardDescription>
            Team scores broken down by class year (Freshman, Sophomore, Junior, Senior, Graduate)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassYearBreakdown
            meetLineups={meet.meetLineups}
            relayEntries={meet.relayEntries}
            teams={meet.meetTeams.map((mt) => mt.team)}
            individualScoring={individualScoring}
            relayScoring={relayScoring}
            scoringPlaces={meet.scoringPlaces}
          />
        </CardContent>
      </Card>


    </div>
  );
}
