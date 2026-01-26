"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { formatName, formatSecondsToTime } from "@/lib/utils";
type AthleteWithEvents = {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  isEnabled: boolean;
  eventTimes: {
    id: string;
    time: string;
    isEntered: boolean;
    event: {
      id: string;
      name: string;
    };
  }[];
};

interface AthletesTableProps {
  athletes: AthleteWithEvents[];
  teamId: string;
}

export function AthletesTable({ athletes, teamId }: AthletesTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (athletes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No athletes yet. Upload a CSV file or add athletes manually.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {athletes.map((athlete) => {
            const enteredEvents = athlete.eventTimes.filter((e) => e.isEntered);
            const allEvents = athlete.eventTimes.length;

            return (
              <TableRow key={athlete.id}>
                <TableCell className="font-medium">
                  {formatName(athlete.firstName, athlete.lastName)}
                </TableCell>
                <TableCell>{athlete.year || "-"}</TableCell>
                <TableCell>
                  <Badge variant={athlete.isDiver ? "secondary" : "default"}>
                    {athlete.isDiver ? "Diver" : "Swimmer"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">
                      {allEvents} total
                      {enteredEvents.length > 0 && (
                        <span className="text-slate-500">
                          {" "}
                          ({enteredEvents.length} entered)
                        </span>
                      )}
                    </span>
                    {athlete.eventTimes.slice(0, 3).map((eventTime) => (
                      <span
                        key={eventTime.id}
                        className="text-xs text-slate-500"
                      >
                        {eventTime.event.name}: {eventTime.time}
                      </span>
                    ))}
                    {athlete.eventTimes.length > 3 && (
                      <span className="text-xs text-slate-400">
                        +{athlete.eventTimes.length - 3} more
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={athlete.isEnabled ? "default" : "outline"}
                  >
                    {athlete.isEnabled ? "Active" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(athlete.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
