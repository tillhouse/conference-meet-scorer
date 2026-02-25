"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Event {
  id: string;
  name: string;
}

interface EventNavigationProps {
  events: Event[];
  currentEventId: string;
  meetId: string;
  /** If set, links use this path instead of /meets/[meetId]/events (e.g. /view/meet/[shareToken]/events) */
  eventsBasePath?: string;
  /** Optional query string to append to event links (e.g. "view=simulated") */
  pathQuery?: string;
  prevEvent: Event | null;
  nextEvent: Event | null;
}

export function EventNavigation({
  events,
  currentEventId,
  meetId,
  eventsBasePath,
  pathQuery,
  prevEvent,
  nextEvent,
}: EventNavigationProps) {
  const router = useRouter();
  const basePath = eventsBasePath ?? `/meets/${meetId}/events`;
  const q = pathQuery ? `?${pathQuery}` : "";

  const handleEventChange = (eventId: string) => {
    router.push(`${basePath}/${eventId}${q}`);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={!prevEvent}
          >
            {prevEvent ? (
              <Link href={`${basePath}/${prevEvent.id}${q}`}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous: {prevEvent.name}
              </Link>
            ) : (
              <span>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </span>
            )}
          </Button>

          <div className="flex-1 max-w-md">
            <Select value={currentEventId} onValueChange={handleEventChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select event..." />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={!nextEvent}
          >
            {nextEvent ? (
              <Link href={`${basePath}/${nextEvent.id}${q}`}>
                Next: {nextEvent.name}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            ) : (
              <span>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
