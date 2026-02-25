import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMeetOwnerId } from "@/lib/meet-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { SimulateMeetButton } from "@/components/meets/simulate-meet-button";
import { ScoringModeSelector } from "@/components/meets/scoring-mode-selector";
import { RealResultsUpload } from "@/components/meets/real-results-upload";
import { ScoreProgressionGraph } from "@/components/meets/score-progression-graph";
import { ClassYearBreakdown } from "@/components/meets/class-year-breakdown";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { TeamStandings } from "@/components/meets/team-standings";
import { DeleteMeetButton } from "@/components/meets/delete-meet-button";
import { ShareMeetButton } from "@/components/meets/share-meet-button";
import { sortEventsByOrder } from "@/lib/event-utils";

export default async function MeetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let step = "params";
  try {
  const { id } = await params;

  step = "findUnique";
  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      team: { select: { ownerId: true } },
      teamAccount: { select: { ownerId: true } },
      meetTeams: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              schoolName: true,
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
                  schoolName: true,
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
              schoolName: true,
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

  step = "selectedEvents";
  let selectedEvents: string[] = [];
  try {
    selectedEvents = meet.selectedEvents ? (JSON.parse(meet.selectedEvents) as string[]) : [];
  } catch (e) {
    throw e;
  }
  // Fetch all selected events including individual, relay, and diving events
  step = "findMany";
  const eventsUnsorted = await prisma.event.findMany({
    where: {
      id: { in: selectedEvents },
      // No eventType filter - includes all types: individual, relay, diving
    },
  });

  // Get event order (custom order if set, otherwise null)
  step = "eventOrder";
  let eventOrder: string[] | null = null;
  try {
    eventOrder = meet.eventOrder ? (JSON.parse(meet.eventOrder) as string[]) : null;
  } catch (e) {
    throw e;
  }

  // Sort events according to custom order or default
  step = "sortEventsByOrder";
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  step = "individualScoring";
  let individualScoring: Record<string, number> = {};
  let relayScoring: Record<string, number> = {};
  let eventDays: Record<string, number> | null = null;
  try {
    individualScoring = meet.individualScoring ? (JSON.parse(meet.individualScoring) as Record<string, number>) : {};
    relayScoring = meet.relayScoring ? (JSON.parse(meet.relayScoring) as Record<string, number>) : {};
    eventDays = meet.eventDays ? (JSON.parse(meet.eventDays) as Record<string, number>) : null;
  } catch (e) {
    throw e;
  }
  const durationDays = meet.durationDays ?? 1;

  // Check if meet has been simulated (has places/points assigned)
  const hasResults = meet.meetLineups.some((l) => l.place !== null) || 
                     meet.relayEntries.some((r) => r.place !== null);

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === getMeetOwnerId(meet);

  step = "render";

  // Check if payload is JSON-serializable (production can throw during RSC serialization)
  step = "serialize";
  try {
    JSON.stringify({
      meetTeams: meet.meetTeams,
      meetLineups: meet.meetLineups,
      relayEntries: meet.relayEntries,
      events: events.slice(0, 2),
      eventOrder,
      eventDays,
    });
  } catch (serialErr) {
    throw serialErr;
  }

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
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {isOwner && (
            <ShareMeetButton meetId={id} meetName={meet.name} shareToken={meet.shareToken ?? null} />
          )}
          <ScoringModeSelector meetId={id} value={meet.scoringMode} />
          <SimulateMeetButton meetId={id} hasResults={hasResults} scoringMode={meet.scoringMode} />
          {isOwner && <DeleteMeetButton meetId={id} meetName={meet.name} />}
          <Button variant="outline" asChild>
            <Link href="/meets">
              Back to Meets
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} />

      {/* Real results upload - when mode is real or hybrid */}
      {(meet.scoringMode === "real" || meet.scoringMode === "hybrid") && (
        <RealResultsUpload meetId={id} />
      )}

      {/* Team Standings - View only; meet actions live in header */}
      <TeamStandings 
        meetId={id}
        meetTeams={meet.meetTeams} 
        meetLineups={meet.meetLineups}
        relayEntries={meet.relayEntries}
        durationDays={durationDays}
        eventDays={eventDays}
      />

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
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStack = e instanceof Error ? e.stack : undefined;
    console.error("[meets/[id]] server exception", { step, error: errMsg, stack: errStack });
    throw e;
  }
}
