"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { formatName } from "@/lib/utils";
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
} from "@/components/ui/alert-dialog";

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  eventTimes: {
    id: string;
    time: string;
    event: {
      id: string;
      name: string;
    };
  }[];
}

interface Team {
  id: string;
  name: string;
  athletes: Athlete[];
}

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface MeetTeam {
  id: string;
  teamId: string;
}

interface LineupSelectorProps {
  meetId: string;
  meetTeam: MeetTeam;
  team: Team;
  swimmingEvents: Event[];
  divingEvents: Event[];
  maxIndivEvents: number;
  maxRelays: number;
  maxDivingEvents: number;
}

export function LineupSelector({
  meetId,
  meetTeam,
  team,
  swimmingEvents,
  divingEvents,
  maxIndivEvents,
  maxRelays,
  maxDivingEvents,
}: LineupSelectorProps) {
  const [athleteLineups, setAthleteLineups] = useState<Record<string, Set<string>>>({});
  const [savedLineups, setSavedLineups] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Load existing lineups
  useEffect(() => {
    fetch(`/api/meets/${meetId}/lineups/${meetTeam.teamId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.lineups) {
          const lineups: Record<string, Set<string>> = {};
          Object.entries(data.lineups).forEach(([athleteId, eventIds]) => {
            lineups[athleteId] = new Set(eventIds as string[]);
          });
          setAthleteLineups(lineups);
          setSavedLineups(JSON.parse(JSON.stringify(lineups))); // Deep copy
        }
      })
      .catch(() => {
        // No existing lineups
      });
  }, [meetId, meetTeam.teamId]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const current = JSON.stringify(
      Object.fromEntries(
        Object.entries(athleteLineups).map(([k, v]) => [k, Array.from(v).sort()])
      )
    );
    const saved = JSON.stringify(
      Object.fromEntries(
        Object.entries(savedLineups).map(([k, v]) => [k, Array.from(v).sort()])
      )
    );
    return current !== saved;
  }, [athleteLineups, savedLineups]);

  const handleToggleEvent = (athleteId: string, eventId: string, eventType: string) => {
    const newLineups = { ...athleteLineups };
    if (!newLineups[athleteId]) {
      newLineups[athleteId] = new Set();
    }

    const athlete = team.athletes.find((a) => a.id === athleteId);
    if (!athlete) return;

    const currentEvents = newLineups[athleteId];
    const isDiving = eventType === "diving";
    const maxEvents = isDiving ? maxDivingEvents : maxIndivEvents;

    if (currentEvents.has(eventId)) {
      currentEvents.delete(eventId);
    } else {
      // Check limits
      const currentCount = Array.from(currentEvents).filter((eid) => {
        const event = isDiving
          ? divingEvents.find((ev) => ev.id === eid)
          : swimmingEvents.find((ev) => ev.id === eid);
        return event?.eventType === eventType;
      }).length;

      if (currentCount >= maxEvents) {
        toast.error(
          `${athlete.isDiver ? "Divers" : "Swimmers"} can only enter ${maxEvents} ${isDiving ? "diving" : "individual"} event${maxEvents !== 1 ? "s" : ""}`
        );
        return;
      }

      currentEvents.add(eventId);
    }

    setAthleteLineups(newLineups);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const lineups: Record<string, string[]> = {};
      Object.entries(athleteLineups).forEach(([athleteId, eventIds]) => {
        lineups[athleteId] = Array.from(eventIds);
      });

      const response = await fetch(`/api/meets/${meetId}/lineups/${meetTeam.teamId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lineups }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save lineups");
      }

      toast.success(`${team.name} lineups saved successfully`);
      // Update saved state
      setSavedLineups(JSON.parse(JSON.stringify(athleteLineups))); // Deep copy
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save lineups");
    } finally {
      setSaving(false);
    }
  };

  // Expose save function and unsaved state to parent
  useEffect(() => {
    // Store in a way parent can access
    (window as any)[`lineupSelector_${meetTeam.teamId}`] = {
      hasUnsavedChanges,
      save: handleSave,
    };
    return () => {
      delete (window as any)[`lineupSelector_${meetTeam.teamId}`];
    };
  }, [hasUnsavedChanges, meetTeam.teamId]);

  const swimmers = team.athletes.filter((a) => !a.isDiver);
  const divers = team.athletes.filter((a) => a.isDiver);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{team.name}</CardTitle>
            <CardDescription>
              Select events for each athlete
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Saving..." : "Save Lineups"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="swimmers" className="w-full">
          <TabsList>
            <TabsTrigger value="swimmers">
              Swimmers ({swimmers.length})
            </TabsTrigger>
            {divers.length > 0 && (
              <TabsTrigger value="divers">
                Divers ({divers.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="swimmers" className="space-y-4 mt-4">
            {swimmers.map((athlete) => {
              const selectedEvents = athleteLineups[athlete.id] || new Set();
              const selectedCount = Array.from(selectedEvents).filter((eid) =>
                swimmingEvents.some((e) => e.id === eid)
              ).length;
              const isValid = selectedCount <= maxIndivEvents;

              // Get athlete's available events (ones they have times for)
              const availableEvents = swimmingEvents.filter((event) =>
                athlete.eventTimes.some((et) => et.event.id === event.id)
              );

              return (
                <div key={athlete.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">
                        {formatName(athlete.firstName, athlete.lastName)}
                      </span>
                      {athlete.year && (
                        <span className="text-sm text-slate-500 ml-2">({athlete.year})</span>
                      )}
                    </div>
                    <Badge variant={isValid ? "default" : "destructive"}>
                      {selectedCount}/{maxIndivEvents} events
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {availableEvents.map((event) => {
                      const hasTime = athlete.eventTimes.some(
                        (et) => et.event.id === event.id
                      );
                      const time = athlete.eventTimes.find(
                        (et) => et.event.id === event.id
                      )?.time;

                      return (
                        <div key={event.id} className="flex items-center space-x-1">
                          <Checkbox
                            id={`${athlete.id}-${event.id}`}
                            checked={selectedEvents.has(event.id)}
                            onCheckedChange={() =>
                              handleToggleEvent(athlete.id, event.id, event.eventType)
                            }
                          />
                          <Label
                            htmlFor={`${athlete.id}-${event.id}`}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {event.name}
                            {time && (
                              <span className="text-slate-500 block text-[10px]">
                                {time}
                              </span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {divers.length > 0 && (
            <TabsContent value="divers" className="space-y-4 mt-4">
              {divers.map((athlete) => {
                const selectedEvents = athleteLineups[athlete.id] || new Set();
                const selectedCount = Array.from(selectedEvents).filter((eid) =>
                  divingEvents.some((e) => e.id === eid)
                ).length;
                const isValid = selectedCount <= maxDivingEvents;

                return (
                  <div key={athlete.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">
                          {formatName(athlete.firstName, athlete.lastName)}
                        </span>
                        {athlete.year && (
                          <span className="text-sm text-slate-500 ml-2">({athlete.year})</span>
                        )}
                      </div>
                      <Badge variant={isValid ? "default" : "destructive"}>
                        {selectedCount}/{maxDivingEvents} events
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {divingEvents.map((event) => {
                        const hasTime = athlete.eventTimes.some(
                          (et) => et.event.id === event.id
                        );
                        const time = athlete.eventTimes.find(
                          (et) => et.event.id === event.id
                        )?.time;

                        return (
                          <div key={event.id} className="flex items-center space-x-1">
                            <Checkbox
                              id={`${athlete.id}-${event.id}`}
                              checked={selectedEvents.has(event.id)}
                              onCheckedChange={() =>
                                handleToggleEvent(athlete.id, event.id, event.eventType)
                              }
                            />
                            <Label
                              htmlFor={`${athlete.id}-${event.id}`}
                              className="text-xs cursor-pointer flex-1"
                            >
                              {event.name}
                              {time && (
                                <span className="text-slate-500 block text-[10px]">
                                  {time}
                                </span>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
