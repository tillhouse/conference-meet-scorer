import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { EventDetailView } from "@/components/meets/event-detail-view";
import { sortEventsByOrder } from "@/lib/event-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventNavigation } from "@/components/meets/event-navigation";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;

  let meet;
  try {
    meet = await prisma.meet.findUnique({
    where: { id },
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
        orderBy: {
          totalScore: "desc",
        },
      },
      meetLineups: {
        where: {
          eventId: eventId,
        },
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
        where: {
          eventId: eventId,
        },
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
  } catch (error: any) {
    console.error("Error fetching meet:", error);
    throw new Error(`Failed to load meet: ${error.message}`);
  }

  if (!meet) {
    notFound();
  }

  // Get the specific event
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    notFound();
  }

  // Get all events for navigation
  const selectedEvents = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  
  const eventsUnsorted = await prisma.event.findMany({
    where: {
      id: { in: selectedEvents },
    },
  });

  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;

  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  // Find current event index
  const currentEventIndex = events.findIndex((e) => e.id === eventId);
  const prevEvent = currentEventIndex > 0 ? events[currentEventIndex - 1] : null;
  const nextEvent = currentEventIndex < events.length - 1 ? events[currentEventIndex + 1] : null;

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  // Check if meet has been simulated
  const hasResults = meet.meetLineups.some((l) => l.place !== null) || 
                     meet.relayEntries.some((r) => r.place !== null);

  const testSpotAthleteIds: string[] = [];
  meet.meetTeams?.forEach((mt) => {
    const raw = (mt as { testSpotAthleteIds?: string | null }).testSpotAthleteIds;
    if (raw) {
      try {
        testSpotAthleteIds.push(...(JSON.parse(raw) as string[]));
      } catch (_) {}
    }
  });

  // For relay events, build athlete id -> name map from all meet lineups (so we can show split names)
  let athleteIdToName: Record<string, string> = {};
  if (event.eventType === "relay") {
    const { formatName } = await import("@/lib/utils");
    const allLineups = await prisma.meetLineup.findMany({
      where: { meetId: id },
      include: { athlete: { select: { id: true, firstName: true, lastName: true } } },
    });
    allLineups.forEach((l) => {
      athleteIdToName[l.athlete.id] = formatName(l.athlete.firstName, l.athlete.lastName);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/meets/${id}/events`}>
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
        <BackToMeetButton meetId={id} />
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} />

      {/* Event Navigation */}
      <EventNavigation
        events={events}
        currentEventId={eventId}
        meetId={id}
        prevEvent={prevEvent}
        nextEvent={nextEvent}
      />

      {/* Event Detail View */}
      <EventDetailView
        event={event}
        meetLineups={meet.meetLineups}
        relayEntries={meet.relayEntries}
        teams={meet.meetTeams.map((mt) => mt.team)}
        athleteIdToName={athleteIdToName}
        individualScoring={individualScoring}
        relayScoring={relayScoring}
        scoringPlaces={meet.scoringPlaces}
        hasResults={hasResults}
        meetId={id}
        testSpotAthleteIds={testSpotAthleteIds}
        meetTeams={meet.meetTeams.map((mt) => ({
          teamId: mt.teamId,
          sensitivityAthleteId: (mt as { sensitivityAthleteId?: string | null }).sensitivityAthleteId,
          sensitivityVariant: (mt as { sensitivityVariant?: string | null }).sensitivityVariant,
          sensitivityPercent: (mt as { sensitivityPercent?: number | null }).sensitivityPercent,
          team: mt.team,
        }))}
      />
    </div>
  );
}
