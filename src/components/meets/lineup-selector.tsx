"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { formatName, normalizeTimeFormat, normalizeEventName, findEventByName } from "@/lib/utils";
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
      eventType: string;
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
        const eventArray = Array.from(eventIds);
        // Only include athletes with at least one event
        if (eventArray.length > 0) {
          lineups[athleteId] = eventArray;
        }
      });

      console.log("Saving lineups:", { lineups, athleteCount: Object.keys(lineups).length });
      console.log("Lineups structure check:", {
        isObject: typeof lineups === 'object',
        keys: Object.keys(lineups),
        firstValue: Object.values(lineups)[0],
        firstValueIsArray: Array.isArray(Object.values(lineups)[0]),
      });
      
      const payload = { lineups };
      console.log("Payload to send:", JSON.stringify(payload, null, 2));

      const response = await fetch(`/api/meets/${meetId}/lineups/${meetTeam.teamId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let error;
        const responseText = await response.text();
        console.error("Response status:", response.status);
        console.error("Response text:", responseText);
        
        try {
          error = JSON.parse(responseText);
        } catch (e) {
          // Response might not be JSON
          console.error("Failed to parse response as JSON:", e);
          error = { 
            error: responseText || `HTTP ${response.status}: ${response.statusText}`,
            rawResponse: responseText,
          };
        }
        console.error("Lineup save error object:", error);
        const errorMessage = error.details 
          ? `Validation error: ${JSON.stringify(error.details)}`
          : error.message || error.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.skipped && result.skipped > 0) {
        console.warn("Some lineups were skipped:", result.skippedDetails);
        toast.warning(`${team.name} lineups saved, but ${result.skipped} entries were skipped. Check console for details.`);
      } else {
        toast.success(`${team.name} lineups saved successfully (${result.count} entries)`);
      }
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
              // Count all selected individual events (not just ones in meet's selectedEvents)
              const selectedCount = Array.from(selectedEvents).filter((eid) => {
                // Check if it's an individual event (either in swimmingEvents or in athlete's eventTimes)
                const inMeetEvents = swimmingEvents.some((e) => e.id === eid);
                if (inMeetEvents) return true;
                // Check if athlete has this event as an individual event
                const athleteEvent = athlete.eventTimes.find((et) => et.event.id === eid);
                return athleteEvent?.event.eventType === "individual";
              }).length;
              const isValid = selectedCount <= maxIndivEvents;

              // Get athlete's available events (ones they have times for)
              // Start with all individual swimming events the athlete has times for
              const athleteSwimmingEvents = athlete.eventTimes
                .filter((et) => et.event.eventType === "individual")
                .map((et) => et.event);
              
              // Create maps for quick lookup by ID and normalized name
              const meetEventMapById = new Map(swimmingEvents.map((e) => [e.id, e]));
              const meetEventMapByName = new Map(swimmingEvents.map((e) => [normalizeEventName(e.name), e]));
              
              // Get unique events (by ID) - prefer meet events if available (they have full data)
              const availableEventsMap = new Map<string, Event>();
              
              athleteSwimmingEvents.forEach((athleteEvent) => {
                // First try to match by ID
                let meetEvent = meetEventMapById.get(athleteEvent.id);
                
                // If not found by ID, try to match by normalized name
                if (!meetEvent) {
                  const normalizedName = normalizeEventName(athleteEvent.name);
                  meetEvent = meetEventMapByName.get(normalizedName);
                  
                  // Also try finding by name using the helper function
                  if (!meetEvent) {
                    const foundEvent = findEventByName(swimmingEvents, athleteEvent.name);
                    if (foundEvent) {
                      meetEvent = foundEvent;
                    }
                  }
                }
                
                if (meetEvent) {
                  // Use the meet event (has proper eventType and is in the meet)
                  availableEventsMap.set(meetEvent.id, meetEvent);
                } else {
                  // Otherwise, use the athlete's event (it has eventType from the database)
                  availableEventsMap.set(athleteEvent.id, {
                    id: athleteEvent.id,
                    name: athleteEvent.name,
                    eventType: athleteEvent.eventType,
                  });
                }
              });
              
              const availableEvents = Array.from(availableEventsMap.values());

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
                      // Find time by matching event ID first
                      let athleteEventTime = athlete.eventTimes.find(
                        (et) => et.event.id === event.id
                      );
                      
                      // If not found by ID, try matching by normalized name
                      if (!athleteEventTime) {
                        const normalizedEventName = normalizeEventName(event.name);
                        athleteEventTime = athlete.eventTimes.find((et) => {
                          const normalizedAthleteEventName = normalizeEventName(et.event.name);
                          return normalizedAthleteEventName === normalizedEventName ||
                                 normalizedAthleteEventName.toLowerCase() === normalizedEventName.toLowerCase();
                        });
                      }
                      
                      // Also try using findEventByName helper
                      if (!athleteEventTime) {
                        const foundAthleteEvent = findEventByName(
                          athlete.eventTimes.map(et => et.event),
                          event.name
                        );
                        if (foundAthleteEvent) {
                          athleteEventTime = athlete.eventTimes.find(
                            (et) => et.event.id === foundAthleteEvent.id
                          );
                        }
                      }
                      
                      const hasTime = !!athleteEventTime;
                      const time = athleteEventTime?.time;

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
                                {normalizeTimeFormat(time)}
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
                                  {normalizeTimeFormat(time)}
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
