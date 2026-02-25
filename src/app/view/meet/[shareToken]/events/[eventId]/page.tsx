import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EventDetailView } from "@/components/meets/event-detail-view";
import { sortEventsByOrder } from "@/lib/event-utils";
import { EventNavigation } from "@/components/meets/event-navigation";
import { PublicMeetNavigation } from "@/components/meets/public-meet-navigation";
import {
  getComputedMeetView,
  hasRealResults,
  hasSimulatedData,
  type ViewMode,
} from "@/lib/meet-simulate-compute";

export const dynamic = "force-dynamic";

function parseViewParam(param: string | null): ViewMode {
  if (param === "simulated" || param === "real" || param === "hybrid") return param;
  return "simulated";
}

export default async function PublicEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ shareToken: string; eventId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { shareToken, eventId } = await params;
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
              shortName: true,
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
  const meetForCompute = { ...meet, individualScoring, relayScoring };

  const { meetLineups: allLineups, relayEntries: allRelays, meetTeams } = getComputedMeetView(
    meetForCompute,
    view,
    realResultsEventIds
  );

  const meetLineups = allLineups.filter((l) => l.eventId === eventId);
  const relayEntries = allRelays.filter((r) => r.eventId === eventId);

  const hasDataForView =
    view === "real"
      ? hasRealResults(meet, realResultsEventIds)
      : hasSimulatedData(meet);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    notFound();
  }

  const selectedEvents = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: selectedEvents } },
  });
  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  const currentEventIndex = events.findIndex((e) => e.id === eventId);
  const prevEvent = currentEventIndex > 0 ? events[currentEventIndex - 1] : null;
  const nextEvent =
    currentEventIndex < events.length - 1 ? events[currentEventIndex + 1] : null;

  const hasResults =
    meetLineups.some((l) => l.place !== null) || relayEntries.some((r) => r.place !== null);

  const testSpotAthleteIds: string[] = [];
  meetTeams?.forEach((mt) => {
    const raw = (mt as { testSpotAthleteIds?: string | null }).testSpotAthleteIds;
    if (raw) {
      try {
        testSpotAthleteIds.push(...(JSON.parse(raw) as string[]));
      } catch (_) {}
    }
  });

  let athleteIdToName: Record<string, string> = {};
  if (event.eventType === "relay") {
    const { formatName } = await import("@/lib/utils");
    const allLineups = await prisma.meetLineup.findMany({
      where: { meetId: meet.id },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    allLineups.forEach((l) => {
      athleteIdToName[l.athlete.id] = formatName(
        l.athlete.firstName,
        l.athlete.lastName
      );
    });
  }

  const eventsBasePath = `/view/meet/${shareToken}/events`;
  const pathQuery = viewParam ? `view=${encodeURIComponent(viewParam)}` : undefined;

  if (!hasDataForView) {
    const emptyMessage =
      view === "real"
        ? "No real results entered yet for this view."
        : "No data for this view.";
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={pathQuery ? `${eventsBasePath}?${pathQuery}` : eventsBasePath}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{event.name}</h1>
            <p className="text-slate-600 mt-1">{meet.name}</p>
          </div>
        </div>
        <PublicMeetNavigation shareToken={shareToken} />
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={pathQuery ? `${eventsBasePath}?${pathQuery}` : eventsBasePath}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{event.name}</h1>
            <p className="text-slate-600 mt-1">
              {meet.name} • Event {currentEventIndex + 1} of {events.length}
            </p>
          </div>
        </div>
      </div>

      <PublicMeetNavigation shareToken={shareToken} />

      <EventNavigation
        events={events}
        currentEventId={eventId}
        meetId={meet.id}
        eventsBasePath={eventsBasePath}
        pathQuery={pathQuery}
        prevEvent={prevEvent}
        nextEvent={nextEvent}
      />

      <EventDetailView
        event={event}
        meetLineups={meetLineups}
        relayEntries={relayEntries}
        teams={meetTeams.map((mt) => mt.team)}
        athleteIdToName={athleteIdToName}
        individualScoring={individualScoring}
        relayScoring={relayScoring}
        scoringPlaces={meet.scoringPlaces}
        hasResults={hasResults}
        meetId={meet.id}
        testSpotAthleteIds={testSpotAthleteIds}
        meetTeams={meetTeams.map((mt) => ({
          teamId: mt.teamId,
          sensitivityVariantAthleteId: (mt as { sensitivityVariantAthleteId?: string | null }).sensitivityVariantAthleteId,
          sensitivityVariant: (mt as { sensitivityVariant?: string | null }).sensitivityVariant,
          sensitivityPercent: (mt as { sensitivityPercent?: number | null }).sensitivityPercent,
          team: mt.team,
        }))}
        readOnly
      />
    </div>
  );
}
