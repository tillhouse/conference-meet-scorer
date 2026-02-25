import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { sortEventsByOrder } from "@/lib/event-utils";

export default async function ViewMeetEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { shareToken } = await params;
  const { view: viewParam } = await searchParams;
  const view = viewParam ?? null;

  const meet = await prisma.meet.findUnique({
    where: { shareToken },
    include: {
      meetLineups: { select: { eventId: true } },
      relayEntries: { select: { eventId: true } },
    },
  });

  if (!meet) {
    notFound();
  }

  const selectedEvents = meet.selectedEvents ? (JSON.parse(meet.selectedEvents) as string[]) : [];
  const lineupEventIds = new Set(meet.meetLineups.map((l) => l.eventId));
  const relayEventIds = new Set(meet.relayEntries.map((r) => r.eventId));
  const allEventIds = new Set([...selectedEvents, ...lineupEventIds, ...relayEventIds]);

  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: Array.from(allEventIds) } },
  });
  const eventOrder = meet.eventOrder ? (JSON.parse(meet.eventOrder) as string[]) : null;
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Event Results</h2>
        <p className="text-slate-600 mt-1">{meet.name}</p>
      </div>

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
                  <Link href={`/view/meet/${shareToken}/events/${event.id}${view ? `?view=${encodeURIComponent(view)}` : ""}`}>
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
