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
import { RealResultsUpload } from "@/components/meets/real-results-upload";
import { ScoreProgressionGraph } from "@/components/meets/score-progression-graph";
import { ClassYearBreakdown } from "@/components/meets/class-year-breakdown";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { TeamStandings } from "@/components/meets/team-standings";
import { DeleteMeetButton } from "@/components/meets/delete-meet-button";
import { ShareMeetButton } from "@/components/meets/share-meet-button";
import { sortEventsByOrder } from "@/lib/event-utils";
import { PerformanceVsProjection } from "@/components/meets/performance-vs-projection";

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

  // realResultsEventIds for hybrid display
  let realResultsEventIds: string[] = [];
  try {
    realResultsEventIds = meet.realResultsEventIds
      ? (JSON.parse(meet.realResultsEventIds) as string[])
      : [];
  } catch {
    realResultsEventIds = [];
  }
  const realSet = new Set(realResultsEventIds);
  const scoringMode = meet.scoringMode ?? "simulated";

  // Build display teams and entries based on scoring mode (simulated vs real vs hybrid)
  type MeetTeamWithSim = (typeof meet.meetTeams)[number] & {
    simulatedIndividualScore?: number;
    simulatedRelayScore?: number;
    simulatedDivingScore?: number;
    simulatedTotalScore?: number;
  };
  type LineupWithSim = (typeof meet.meetLineups)[number] & {
    simulatedPoints?: number | null;
    realResultApplied?: boolean;
  };
  type RelayWithSim = (typeof meet.relayEntries)[number] & {
    simulatedPoints?: number | null;
    realResultApplied?: boolean;
  };

  // Build projected (simulated) team totals ONLY for events with actual results (fair comparison)
  const eventsWithActualResults = new Set<string>();
  (meet.meetLineups as LineupWithSim[]).forEach((l) => { if (l.realResultApplied) eventsWithActualResults.add(l.eventId); });
  (meet.relayEntries as RelayWithSim[]).forEach((r) => { if (r.realResultApplied) eventsWithActualResults.add(r.eventId); });

  const projectedTotals = new Map<string, { individual: number; relay: number; diving: number; total: number }>();
  meet.meetTeams.forEach((mt) => projectedTotals.set(mt.teamId, { individual: 0, relay: 0, diving: 0, total: 0 }));

  (meet.meetLineups as LineupWithSim[]).forEach((l) => {
    if (!eventsWithActualResults.has(l.eventId)) return;
    const teamId = l.athlete.team.id;
    const pts = l.simulatedPoints ?? 0;
    const rec = projectedTotals.get(teamId);
    if (!rec) return;
    if (l.event.eventType === "diving") rec.diving += pts;
    else if (l.event.eventType === "individual") rec.individual += pts;
    rec.total = rec.individual + rec.relay + rec.diving;
  });
  (meet.relayEntries as RelayWithSim[]).forEach((r) => {
    if (!eventsWithActualResults.has(r.eventId)) return;
    const rec = projectedTotals.get(r.teamId);
    if (!rec) return;
    rec.relay += (r.simulatedPoints ?? 0);
    rec.total = rec.individual + rec.relay + rec.diving;
  });

  const projectedMeetTeams = meet.meetTeams.map((mt) => {
    const p = projectedTotals.get(mt.teamId) ?? { individual: 0, relay: 0, diving: 0, total: 0 };
    return { ...mt, individualScore: p.individual, relayScore: p.relay, divingScore: p.diving, totalScore: p.total };
  });

  // For Combined mode, "vs Proj." must compare to full projected (all events); for Actual, compare to projected in scored events only
  const teamsWithSim = meet.meetTeams as MeetTeamWithSim[];
  const projectedMeetTeamsFull = teamsWithSim.map((mt) => ({
    ...mt,
    individualScore: mt.simulatedIndividualScore ?? 0,
    relayScore: mt.simulatedRelayScore ?? 0,
    divingScore: mt.simulatedDivingScore ?? 0,
    totalScore: mt.simulatedTotalScore ?? 0,
  }));
  const projectedMeetTeamsForDelta = scoringMode === "hybrid" ? projectedMeetTeamsFull : projectedMeetTeams;

  let displayMeetTeams: typeof meet.meetTeams;
  let displayMeetLineups: typeof meet.meetLineups;
  let displayRelayEntries: typeof meet.relayEntries;

  if (scoringMode === "simulated") {
    const teamsWithSim = meet.meetTeams as MeetTeamWithSim[];
    displayMeetTeams = [...teamsWithSim]
      .map((mt) => ({
        ...mt,
        individualScore: mt.simulatedIndividualScore ?? 0,
        relayScore: mt.simulatedRelayScore ?? 0,
        divingScore: mt.simulatedDivingScore ?? 0,
        totalScore: mt.simulatedTotalScore ?? 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
    displayMeetLineups = (meet.meetLineups as LineupWithSim[]).map((l) => ({
      ...l,
      points: l.simulatedPoints ?? 0,
    }));
    displayRelayEntries = (meet.relayEntries as RelayWithSim[]).map((r) => ({
      ...r,
      points: r.simulatedPoints ?? 0,
    }));
  } else if (scoringMode === "hybrid") {
    const allLineups = meet.meetLineups as LineupWithSim[];
    const allRelays = meet.relayEntries as RelayWithSim[];

    // Detect which events have actual results from the data itself
    const eventsWithActual = new Set<string>();
    allLineups.forEach((l) => { if (l.realResultApplied) eventsWithActual.add(l.eventId); });
    allRelays.forEach((r) => { if (r.realResultApplied) eventsWithActual.add(r.eventId); });

    const teamTotals = new Map<string, { individual: number; relay: number; diving: number; total: number }>();
    meet.meetTeams.forEach((mt) => teamTotals.set(mt.teamId, { individual: 0, relay: 0, diving: 0, total: 0 }));

    allLineups.forEach((l) => {
      const teamId = l.athlete.team.id;
      let pts: number;
      if (eventsWithActual.has(l.eventId)) {
        pts = l.realResultApplied ? (l.points ?? 0) : 0;
      } else {
        pts = l.simulatedPoints ?? 0;
      }
      const rec = teamTotals.get(teamId);
      if (!rec) return;
      if (l.event.eventType === "diving") rec.diving += pts;
      else if (l.event.eventType === "individual") rec.individual += pts;
      rec.total = rec.individual + rec.relay + rec.diving;
    });
    allRelays.forEach((r) => {
      const rec = teamTotals.get(r.teamId);
      if (!rec) return;
      let pts: number;
      if (eventsWithActual.has(r.eventId)) {
        pts = r.realResultApplied ? (r.points ?? 0) : 0;
      } else {
        pts = r.simulatedPoints ?? 0;
      }
      rec.relay += pts;
      rec.total = rec.individual + rec.relay + rec.diving;
    });

    const teamsWithSim = meet.meetTeams as MeetTeamWithSim[];
    displayMeetTeams = [...teamsWithSim]
      .map((mt) => {
        const h = teamTotals.get(mt.teamId) ?? { individual: 0, relay: 0, diving: 0, total: 0 };
        return {
          ...mt,
          individualScore: h.individual,
          relayScore: h.relay,
          divingScore: h.diving,
          totalScore: h.total,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
    displayMeetLineups = allLineups.map((l) => ({
      ...l,
      points: eventsWithActual.has(l.eventId)
        ? (l.realResultApplied ? (l.points ?? 0) : 0)
        : (l.simulatedPoints ?? 0),
    }));
    displayRelayEntries = allRelays.map((r) => ({
      ...r,
      points: eventsWithActual.has(r.eventId)
        ? (r.realResultApplied ? (r.points ?? 0) : 0)
        : (r.simulatedPoints ?? 0),
    }));
  } else {
    // Real mode: only entries with realResultApplied === true contribute
    const allLineups = meet.meetLineups as LineupWithSim[];
    const allRelays = meet.relayEntries as RelayWithSim[];

    const teamTotals = new Map<string, { individual: number; relay: number; diving: number; total: number }>();
    meet.meetTeams.forEach((mt) => teamTotals.set(mt.teamId, { individual: 0, relay: 0, diving: 0, total: 0 }));

    allLineups.forEach((l) => {
      if (!l.realResultApplied) return;
      const teamId = l.athlete.team.id;
      const pts = l.points ?? 0;
      const rec = teamTotals.get(teamId);
      if (!rec) return;
      if (l.event.eventType === "diving") rec.diving += pts;
      else if (l.event.eventType === "individual") rec.individual += pts;
      rec.total = rec.individual + rec.relay + rec.diving;
    });
    allRelays.forEach((r) => {
      if (!r.realResultApplied) return;
      const rec = teamTotals.get(r.teamId);
      if (!rec) return;
      rec.relay += (r.points ?? 0);
      rec.total = rec.individual + rec.relay + rec.diving;
    });

    displayMeetTeams = [...meet.meetTeams]
      .map((mt) => {
        const h = teamTotals.get(mt.teamId) ?? { individual: 0, relay: 0, diving: 0, total: 0 };
        return {
          ...mt,
          individualScore: h.individual,
          relayScore: h.relay,
          divingScore: h.diving,
          totalScore: h.total,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
    displayMeetLineups = allLineups
      .filter((l) => l.realResultApplied)
      .map((l) => ({ ...l }));
    displayRelayEntries = allRelays
      .filter((r) => r.realResultApplied)
      .map((r) => ({ ...r }));
  }

  // Check if meet has simulated or real results (for button and graph)
  const hasResults = meet.meetLineups.some((l) => l.place !== null || (l as { simulatedPlace?: number | null }).simulatedPlace != null) ||
                     meet.relayEntries.some((r) => r.place !== null || (r as { simulatedPlace?: number | null }).simulatedPlace != null);

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
            <ShareMeetButton meetId={id} meetName={meet.name} shareToken={(meet as { shareToken?: string | null }).shareToken ?? null} />
          )}
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
      <MeetNavigation meetId={id} status={meet.status} scoringMode={meet.scoringMode} />

      {/* Real results upload - when mode is real or hybrid */}
      {(meet.scoringMode === "real" || meet.scoringMode === "hybrid") && (
        <RealResultsUpload meetId={id} />
      )}

      {/* Team Standings - View only; display by scoring mode (simulated vs real vs hybrid) */}
      <TeamStandings 
        meetId={id}
        meetTeams={displayMeetTeams} 
        meetLineups={displayMeetLineups}
        relayEntries={displayRelayEntries}
        durationDays={durationDays}
        eventDays={eventDays}
        projectedMeetTeams={projectedMeetTeamsForDelta}
        scoringMode={scoringMode}
      />

      {/* Performance vs Projection - show in Actual/Combined mode when real results exist */}
      {scoringMode !== "simulated" && eventsWithActualResults.size > 0 && (
        <PerformanceVsProjection
          meetLineups={meet.meetLineups as any}
          relayEntries={meet.relayEntries as any}
          teams={meet.meetTeams.map((mt) => mt.team)}
        />
      )}

      {/* Score Progression Graph - Only show if meet has been simulated */}
      {hasResults && (
        <ScoreProgressionGraph
          events={events}
          meetLineups={displayMeetLineups}
          relayEntries={displayRelayEntries}
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
            meetLineups={displayMeetLineups}
            relayEntries={displayRelayEntries}
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
