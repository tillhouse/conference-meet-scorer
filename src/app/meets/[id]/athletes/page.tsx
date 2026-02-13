import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetAthleteSummaryTable } from "@/components/meets/meet-athlete-summary-table";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";
import { sortEventsByOrder } from "@/lib/event-utils";

export default async function MeetAthletesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
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

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  const selectedEventIds = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;
  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: selectedEventIds } },
  });
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Athlete Summary</h1>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} />

      {/* Athlete Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Athlete Summary</CardTitle>
          <CardDescription>
            Overview of all athletes competing in this meet, including events and projected points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeetAthleteSummaryTable
            meetLineups={meet.meetLineups}
            relayEntries={meet.relayEntries}
            events={events}
            individualScoring={individualScoring}
            relayScoring={relayScoring}
            scoringPlaces={meet.scoringPlaces}
          />
        </CardContent>
      </Card>
    </div>
  );
}
