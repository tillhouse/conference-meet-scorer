import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { ScoreProgressionGraph } from "@/components/meets/score-progression-graph";
import { ClassYearBreakdown } from "@/components/meets/class-year-breakdown";
import { TeamStandings } from "@/components/meets/team-standings";
import { sortEventsByOrder } from "@/lib/event-utils";
import {
  getComputedMeetView,
  hasRealResults,
  hasSimulatedData,
  type ViewMode,
} from "@/lib/meet-simulate-compute";

function parseViewParam(param: string | null): ViewMode {
  if (param === "simulated" || param === "real" || param === "hybrid") return param;
  return "simulated";
}

export default async function ViewMeetOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { shareToken } = await params;
  const { view: viewParam } = await searchParams;
  const view = parseViewParam(viewParam ?? null);

  const meet = await prisma.meet.findUnique({
    where: { shareToken },
    include: {
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
        orderBy: { totalScore: "desc" },
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
    },
  });

  if (!meet) {
    notFound();
  }

  const realResultsEventIds = meet.realResultsEventIds
    ? (JSON.parse(meet.realResultsEventIds) as string[])
    : [];

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  const meetForCompute = {
    ...meet,
    individualScoring,
    relayScoring,
  };

  const { meetLineups, relayEntries, meetTeams } = getComputedMeetView(
    meetForCompute,
    view,
    realResultsEventIds
  );

  const hasDataForView =
    view === "real"
      ? hasRealResults(meet, realResultsEventIds)
      : hasSimulatedData(meet);

  const selectedEvents = meet.selectedEvents ? (JSON.parse(meet.selectedEvents) as string[]) : [];
  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: selectedEvents } },
  });
  const eventOrder = meet.eventOrder ? (JSON.parse(meet.eventOrder) as string[] | null) : null;
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  const eventDays = meet.eventDays ? (JSON.parse(meet.eventDays) as Record<string, number>) : null;
  const durationDays = meet.durationDays ?? 1;

  const hasResults =
    meetLineups.some((l) => l.place !== null) || relayEntries.some((r) => r.place !== null);

  if (!hasDataForView) {
    const emptyMessage =
      view === "real"
        ? "No real results entered yet. Real results appear here after they are pasted or uploaded for events."
        : view === "simulated"
          ? "No seed times or entries to simulate. Add lineups and seed times, then run Simulate on the meet to see results."
          : "No data for hybrid view. Add lineups and seed times, and/or enter real results for some events.";
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
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
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600">{emptyMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
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
      </div>

      <TeamStandings
        meetId={meet.id}
        meetTeams={meetTeams}
        meetLineups={meetLineups}
        relayEntries={relayEntries}
        durationDays={durationDays}
        eventDays={eventDays}
      />

      {hasResults && (
        <ScoreProgressionGraph
          events={events}
          meetLineups={meetLineups}
          relayEntries={relayEntries}
          teams={meetTeams.map((mt) => mt.team)}
          eventOrder={eventOrder}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Class Year Breakdown</CardTitle>
          <CardDescription>
            Team scores broken down by class year (Freshman, Sophomore, Junior, Senior, Graduate)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassYearBreakdown
            meetLineups={meetLineups}
            relayEntries={relayEntries}
            teams={meetTeams.map((mt) => mt.team)}
            individualScoring={individualScoring}
            relayScoring={relayScoring}
            scoringPlaces={meet.scoringPlaces}
          />
        </CardContent>
      </Card>
    </div>
  );
}
