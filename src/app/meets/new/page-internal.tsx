"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { generateScoringTable } from "@/lib/scoring";
import { UnifiedEventManager } from "@/components/meets/unified-event-manager";
import { getDefaultEventOrder } from "@/lib/default-event-order";

const formSchema = z.object({
  name: z.string().min(1, "Meet name is required"),
  date: z.string().optional(),
  location: z.string().optional(),
  meetType: z.enum(["championship", "dual"]),
  
  // Roster configuration
  maxAthletes: z.number().min(1).default(18),
  diverRatio: z.number().min(0).max(1).default(0.333),
  divingIncluded: z.boolean().default(true),
  
  // Event limits
  maxIndivEvents: z.number().min(1).default(3),
  maxRelays: z.number().min(1).default(4),
  maxDivingEvents: z.number().min(1).default(2),
  
  // Scoring configuration
  scoringPlaces: z.enum(["16", "24"]).default("24"),
  scoringStartPoints: z.number().min(1).default(32),
  relayMultiplier: z.number().min(1).default(2.0),
  
  // Teams and events
  teamIds: z.array(z.string()).min(1, "At least one team is required"),
  eventIds: z.array(z.string()).min(1, "At least one event is required"),
});

type FormData = z.infer<typeof formSchema>;

interface Team {
  id: string;
  name: string;
}

interface Event {
  id: string;
  name: string;
  eventType: string;
}

// Standard swimming events that should always be available
const STANDARD_SWIMMING_EVENTS = [
  "50 Free",
  "100 Free",
  "200 Free",
  "500 Free",
  "1000 Free",
  "1650 Free",
  "50 Back",
  "100 Back",
  "200 Back",
  "50 Breast",
  "100 Breast",
  "200 Breast",
  "50 Fly",
  "100 Fly",
  "200 Fly",
  "200 IM",
  "400 IM",
];

// Standard diving events
const STANDARD_DIVING_EVENTS = [
  "1M Diving",
  "3M Diving",
  "Platform Diving",
];

// Standard relay events
const STANDARD_RELAY_EVENTS = [
  "200 Free Relay",
  "400 Free Relay",
  "800 Free Relay",
  "200 Medley Relay",
  "400 Medley Relay",
];

export default function NewMeetPageInternal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamAccountId = searchParams.get("teamAccountId");
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [eventOrder, setEventOrder] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date: "",
      location: "",
      meetType: "championship",
      maxAthletes: 18,
      diverRatio: 0.333,
      divingIncluded: true,
      maxIndivEvents: 3,
      maxRelays: 4,
      maxDivingEvents: 2,
      scoringPlaces: "24",
      scoringStartPoints: 32,
      relayMultiplier: 2.0,
      teamIds: [],
      eventIds: [],
    },
  });

  // Load teams and events
  useEffect(() => {
    const loadData = async () => {
      try {
        // If teamAccountId is provided, load teams from master database
        let teamsData: Team[];
        if (teamAccountId) {
          // Get primary team + competitor teams from master database
          const [primaryTeamRes, competitorsRes, eventsRes] = await Promise.all([
            fetch(`/api/teams/${teamAccountId}`).then((res) => res.json()),
            fetch(`/api/teams/${teamAccountId}/competitors`).then((res) => res.json()),
            fetch("/api/events").then((res) => res.json()),
          ]);

          const primaryTeam = primaryTeamRes;
          const competitors = competitorsRes.map((c: any) => c.competitorTeam);
          teamsData = [primaryTeam, ...competitors];
          setEvents(eventsRes);
        } else {
          // Load all teams (for backward compatibility)
          const [teamsRes, eventsRes] = await Promise.all([
            fetch("/api/teams").then((res) => res.json()),
            fetch("/api/events").then((res) => res.json()),
          ]);
          teamsData = teamsRes;
          setEvents(eventsRes);
        }

        setTeams(teamsData);
        setLoadingData(false);

        // Pre-select all teams if coming from team account
        if (teamAccountId && teamsData.length > 0) {
          const teamIds = teamsData.map((t) => t.id);
          setValue("teamIds", teamIds);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load teams and events");
        setLoadingData(false);
      }
    };

    loadData();
  }, [teamAccountId, setValue]);

  const selectedTeamIds = watch("teamIds");
  const selectedEventIds = watch("eventIds");
  const meetType = watch("meetType");
  const divingIncluded = watch("divingIncluded");
  const scoringPlaces = watch("scoringPlaces");
  const scoringStartPoints = watch("scoringStartPoints");
  const relayMultiplier = watch("relayMultiplier");

  // Create event options from standard lists, matching with existing events if they exist
  const swimmingEventOptions = STANDARD_SWIMMING_EVENTS.map((eventName) => {
    const existingEvent = events.find((e) => e.name === eventName && e.eventType === "individual");
    return {
      id: existingEvent?.id || eventName, // Use event name as ID if not in DB yet
      name: eventName,
      eventType: "individual" as const,
    };
  }).filter((e): e is Event => e !== null);

  const divingEventOptions = STANDARD_DIVING_EVENTS.map((eventName) => {
    // Match by checking if the event name contains the key part (e.g., "1M", "3M", "Platform")
    const keyPart = eventName.replace(" Diving", "").toLowerCase();
    const existingEvent = events.find(
      (e) => e.eventType === "diving" && e.name.toLowerCase().includes(keyPart)
    );
    return {
      id: existingEvent?.id || eventName, // Use event name as ID if not in DB yet
      name: eventName,
      eventType: "diving" as const,
    };
  }).filter((e): e is Event => e !== null);

  const relayEventOptions = STANDARD_RELAY_EVENTS.map((eventName) => {
    const existingEvent = events.find((e) => e.name === eventName && e.eventType === "relay");
    return {
      id: existingEvent?.id || eventName, // Use event name as ID if not in DB yet
      name: eventName,
      eventType: "relay" as const,
    };
  }).filter((e): e is Event => e !== null);

  // Combine all standard events
  const allStandardEvents = useMemo(() => {
    return [...swimmingEventOptions, ...relayEventOptions, ...divingEventOptions];
  }, [swimmingEventOptions, relayEventOptions, divingEventOptions]);

  // Initialize default championship event order when meet type is championship and events are loaded
  useEffect(() => {
    if (meetType === "championship" && !loadingData && allStandardEvents.length > 0) {
      const defaultOrder = getDefaultEventOrder("championship");
      
      // Map event names to event IDs
      const eventNameToId = new Map(allStandardEvents.map((e) => [e.name, e.id]));
      const defaultEventIds = defaultOrder
        .map((name) => eventNameToId.get(name))
        .filter((id): id is string => id !== undefined);
      
      // Only set if no events are currently selected (to avoid overwriting user selections)
      if (defaultEventIds.length > 0 && selectedEventIds.length === 0) {
        setValue("eventIds", defaultEventIds);
        setEventOrder(defaultEventIds);
      }
      // If events are selected but order is not set, set the order based on default
      else if (defaultEventIds.length > 0 && eventOrder.length === 0 && selectedEventIds.length > 0) {
        // Filter default order to only include selected events, maintaining default order
        const orderedSelectedIds = defaultEventIds.filter((id) => selectedEventIds.includes(id));
        // Add any selected events not in default order at the end
        const remainingIds = selectedEventIds.filter((id) => !defaultEventIds.includes(id));
        setEventOrder([...orderedSelectedIds, ...remainingIds]);
      }
    }
  }, [meetType, loadingData, allStandardEvents, selectedEventIds.length, eventOrder.length, setValue]);

  // Get configured events from selected IDs
  const configuredEvents = useMemo(() => {
    const eventMap = new Map(allStandardEvents.map((e) => [e.id, e]));
    return selectedEventIds
      .map((id) => {
        // Check if it's a standard event
        const standardEvent = eventMap.get(id);
        if (standardEvent) return standardEvent;
        
        // Check if it's in the events array (from DB)
        const dbEvent = events.find((e) => e.id === id);
        if (dbEvent) {
          return {
            id: dbEvent.id,
            name: dbEvent.name,
            eventType: dbEvent.eventType as "individual" | "relay" | "diving",
          };
        }
        
        return null;
      })
      .filter((e): e is Event => e !== null);
  }, [selectedEventIds, allStandardEvents, events]);

  const handleEventsChange = useCallback((newEvents: Event[]) => {
    const newEventIds = newEvents.map((e) => e.id);
    setValue("eventIds", newEventIds);
    // Update order to match new events order
    setEventOrder(newEventIds);
  }, [setValue]);

  const handleOrderChange = useCallback((newOrder: string[]) => {
    setEventOrder(newOrder);
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      // Generate scoring tables
      const scoring = generateScoringTable(
        parseInt(data.scoringPlaces),
        data.scoringStartPoints,
        data.relayMultiplier
      );

      // Convert custom event IDs to names for saving
      const eventIdsToSave = data.eventIds.map((id) => {
        if (id.startsWith("custom-")) {
          // Find the event by ID and use its name
          const event = configuredEvents.find((e) => e.id === id);
          return event ? event.name : id;
        }
        return id;
      });

      // Convert event order IDs to names for saving
      // Create a map of event ID to event name
      const eventIdToName = new Map(allStandardEvents.map((e) => [e.id, e.name]));
      const eventOrderToSave = eventOrder.length > 0
        ? eventOrder.map((id) => {
            // If it's a custom event, get the name from configuredEvents
            if (id.startsWith("custom-")) {
              const event = configuredEvents.find((e) => e.id === id);
              return event ? event.name : id;
            }
            // Otherwise, look it up in the standard events map
            return eventIdToName.get(id) || id;
          })
        : null;

      const response = await fetch("/api/meets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          date: data.date ? new Date(data.date).toISOString() : null,
          location: data.location || null,
          meetType: data.meetType,
          maxAthletes: data.maxAthletes,
          diverRatio: data.diverRatio,
          divingIncluded: data.divingIncluded,
          maxIndivEvents: data.maxIndivEvents,
          maxRelays: data.maxRelays,
          maxDivingEvents: data.maxDivingEvents,
          scoringPlaces: parseInt(data.scoringPlaces),
          scoringStartPoints: data.scoringStartPoints,
          relayMultiplier: data.relayMultiplier,
          individualScoring: JSON.stringify(scoring.individual),
          relayScoring: JSON.stringify(scoring.relay),
          teamIds: data.teamIds,
          eventIds: eventIdsToSave,
          eventOrder: eventOrderToSave ? JSON.stringify(eventOrderToSave) : null,
          teamAccountId: teamAccountId || null, // Link meet to team account
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorDetails = error.details ? `: ${JSON.stringify(error.details)}` : error.details ? `: ${error.details}` : "";
        throw new Error((error.error || "Failed to create meet") + errorDetails);
      }

      const meet = await response.json();
      toast.success("Meet created successfully!");
      router.push(`/meets/${meet.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create meet");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/meets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create New Meet</h1>
          <p className="text-slate-600 mt-1">
            Configure a new championship or dual meet
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the meet name, date, and location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Meet Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="2025 Ivy League Championships"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  {...register("location")}
                  placeholder="Blodgett Pool, Cambridge, MA"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetType">Meet Type</Label>
              <Select
                value={watch("meetType")}
                onValueChange={(value) => setValue("meetType", value as "championship" | "dual")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="championship">Championship</SelectItem>
                  <SelectItem value="dual">Dual Meet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Roster Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Roster Configuration</CardTitle>
            <CardDescription>
              Set athlete limits and diving rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxAthletes">Max Athletes per Team</Label>
                <Input
                  id="maxAthletes"
                  type="number"
                  min="1"
                  {...register("maxAthletes", { valueAsNumber: true })}
                />
                {errors.maxAthletes && (
                  <p className="text-sm text-red-600">{errors.maxAthletes.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="diverRatio">Diver Ratio</Label>
                <Input
                  id="diverRatio"
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  {...register("diverRatio", { valueAsNumber: true })}
                />
                <p className="text-xs text-slate-500">Divers count as this fraction of a swimmer (default: 0.333)</p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                <div className="space-y-0.5">
                  <Label htmlFor="divingIncluded">Diving Included</Label>
                  <p className="text-sm text-slate-600">
                    Include diving events in this meet
                  </p>
                </div>
                <Switch
                  id="divingIncluded"
                  checked={divingIncluded}
                  onCheckedChange={(checked) => setValue("divingIncluded", checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Event Limits</CardTitle>
            <CardDescription>
              Maximum number of events per athlete
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxIndivEvents">Max Individual Events</Label>
                <Input
                  id="maxIndivEvents"
                  type="number"
                  min="1"
                  {...register("maxIndivEvents", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRelays">Max Relay Events</Label>
                <Input
                  id="maxRelays"
                  type="number"
                  min="1"
                  {...register("maxRelays", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDivingEvents">Max Diving Events</Label>
                <Input
                  id="maxDivingEvents"
                  type="number"
                  min="1"
                  {...register("maxDivingEvents", { valueAsNumber: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Scoring Configuration</CardTitle>
            <CardDescription>
              Configure how points are awarded
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scoringPlaces">Scoring Places</Label>
                <Select
                  value={scoringPlaces}
                  onValueChange={(value) => setValue("scoringPlaces", value as "16" | "24")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 Places (A, B, C Finals)</SelectItem>
                    <SelectItem value="16">16 Places (A, B Finals)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scoringStartPoints">Points for 1st Place</Label>
                <Input
                  id="scoringStartPoints"
                  type="number"
                  min="1"
                  {...register("scoringStartPoints", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relayMultiplier">Relay Multiplier</Label>
                <Input
                  id="relayMultiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  {...register("relayMultiplier", { valueAsNumber: true })}
                />
                <p className="text-xs text-slate-500">Relay points = Individual × Multiplier</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teams Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Teams</CardTitle>
            <CardDescription>
              Choose which teams will participate in this meet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setValue("teamIds", [...selectedTeamIds, team.id]);
                      } else {
                        setValue(
                          "teamIds",
                          selectedTeamIds.filter((id) => id !== team.id)
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={`team-${team.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {team.name}
                  </Label>
                </div>
              ))}
            </div>
            {errors.teamIds && (
              <p className="text-sm text-red-600 mt-2">{errors.teamIds.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Events Selection & Ordering */}
        <UnifiedEventManager
          allStandardEvents={allStandardEvents}
          configuredEvents={configuredEvents}
          onEventsChange={handleEventsChange}
          onOrderChange={handleOrderChange}
          divingIncluded={divingIncluded}
          onDivingIncludedChange={(included) => setValue("divingIncluded", included)}
        />
        {errors.eventIds && (
          <p className="text-sm text-red-600">{errors.eventIds.message}</p>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Creating..." : "Create Meet"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/meets">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
