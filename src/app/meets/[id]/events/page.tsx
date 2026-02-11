import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { sortEventsByOrder } from "@/lib/event-utils";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";

export default async function MeetEventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      meetLineups: {
        select: {
          eventId: true,
        },
      },
      relayEntries: {
        select: {
          eventId: true,
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
  
  // Get all event IDs from selectedEvents, lineups, and relay entries
  const lineupEventIds = new Set(meet.meetLineups.map((l) => l.eventId));
  const relayEventIds = new Set(meet.relayEntries.map((r) => r.eventId));
  const allEventIds = new Set([...selectedEvents, ...lineupEventIds, ...relayEventIds]);
  
  const eventsUnsorted = await prisma.event.findMany({
    where: {
      id: { in: Array.from(allEventIds) },
    },
  });

  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;

  // If eventOrder exists but doesn't include all events, we need to merge it
  // Events in eventOrder should maintain their order, events not in eventOrder should be sorted and appended
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Event Results</h1>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} />

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">All Events</CardTitle>
          <CardDescription>
            Click on an event to view detailed results and analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No events selected for this meet.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {events.map((event, index) => (
                <Button
                  key={event.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  asChild
                >
                  <Link href={`/meets/${id}/events/${event.id}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-500 w-8">
                          {index + 1}
                        </span>
                        <span className="font-medium">{event.name}</span>
                      </div>
                      <span className="text-sm text-slate-400">View Details →</span>
                    </div>
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
