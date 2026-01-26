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
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (athleteId: string, athleteName: string) => {
    setDeletingId(athleteId);
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete athlete");
      }

      toast.success(`${athleteName} deleted successfully`);
      // Refresh the page to show updated list
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete athlete");
      setDeletingId(null);
    }
  };

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
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/teams/${teamId}/athletes/${athlete.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === athlete.id}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {formatName(athlete.firstName, athlete.lastName)} and all their event times.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(athlete.id, formatName(athlete.firstName, athlete.lastName))}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
