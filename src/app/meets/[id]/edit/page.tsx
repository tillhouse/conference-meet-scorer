"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { EventSelectorWithOrder } from "@/components/meets/event-selector-with-order";

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

interface MeetTeam {
  id: string;
  teamId: string;
  team: Team;
}

interface Meet {
  id: string;
  name: string;
  date: string | null;
  location: string | null;
  meetType: string;
  maxAthletes: number;
  diverRatio: number;
  divingIncluded: boolean;
  maxIndivEvents: number;
  maxRelays: number;
  maxDivingEvents: number;
  scoringPlaces: number;
  scoringStartPoints: number;
  relayMultiplier: number;
  selectedEvents: string | null;
  meetTeams: MeetTeam[];
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
  "100 Individual Medley",
  "200 Individual Medley",
  "400 Individual Medley",
];

// Standard diving events
const STANDARD_DIVING_EVENTS = [
  "1M Diving",
  "3M Diving",
  "Platform Diving",
];

// Standard relay events
const STANDARD_RELAY_EVENTS = [
  "200 Medley Relay",
  "200 Free Relay",
  "400 Medley Relay",
  "400 Free Relay",
  "800 Free Relay",
];

export default function EditMeetPage() {
  const router = useRouter();
  const params = useParams();
  const meetId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [loadingMeet, setLoadingMeet] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [meet, setMeet] = useState<Meet | null>(null);
  const [eventOrder, setEventOrder] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
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

  // Load meet data, teams, and events
  useEffect(() => {
    const loadData = async () => {
      try {
        const [meetResponse, teamsResponse, eventsResponse] = await Promise.all([
          fetch(`/api/meets/${meetId}`),
          fetch("/api/teams"),
          fetch("/api/events"),
        ]);

        if (!meetResponse.ok) {
          throw new Error("Failed to load meet");
        }

        const meetData = await meetResponse.json();
        const teamsData = await teamsResponse.json();
        const eventsData = await eventsResponse.json();

        setMeet(meetData);
        setTeams(teamsData);
        setEvents(eventsData);

        // Parse selected events
        const selectedEventIds = meetData.selectedEvents
          ? (JSON.parse(meetData.selectedEvents) as string[])
          : [];

        // Parse event order (if exists)
        const existingEventOrder = meetData.eventOrder
          ? (JSON.parse(meetData.eventOrder) as string[])
          : null;
        
        // Set event order (use existing or default to selected events order)
        if (existingEventOrder && existingEventOrder.length > 0) {
          setEventOrder(existingEventOrder);
        } else {
          setEventOrder(selectedEventIds);
        }

        // Format date for input (YYYY-MM-DD)
        const dateValue = meetData.date
          ? new Date(meetData.date).toISOString().split("T")[0]
          : "";

        // Reset form with meet data
        reset({
          name: meetData.name,
          date: dateValue,
          location: meetData.location || "",
          meetType: meetData.meetType as "championship" | "dual",
          maxAthletes: meetData.maxAthletes,
          diverRatio: meetData.diverRatio,
          divingIncluded: meetData.divingIncluded,
          maxIndivEvents: meetData.maxIndivEvents,
          maxRelays: meetData.maxRelays,
          maxDivingEvents: meetData.maxDivingEvents,
          scoringPlaces: meetData.scoringPlaces.toString() as "16" | "24",
          scoringStartPoints: meetData.scoringStartPoints,
          relayMultiplier: meetData.relayMultiplier,
          teamIds: meetData.meetTeams.map((mt: MeetTeam) => mt.teamId),
          eventIds: selectedEventIds,
        });

        setLoadingMeet(false);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load meet data");
        setLoadingMeet(false);
      }
    };

    if (meetId) {
      loadData();
    }
  }, [meetId, reset]);

  const selectedTeamIds = watch("teamIds");
  const selectedEventIds = watch("eventIds");
  const divingIncluded = watch("divingIncluded");
  const scoringPlaces = watch("scoringPlaces");
  const scoringStartPoints = watch("scoringStartPoints");
  const relayMultiplier = watch("relayMultiplier");

  // Memoize callbacks to prevent infinite loops
  const handleSelectionChange = useCallback((newEventIds: string[]) => {
    setValue("eventIds", newEventIds);
    // Update order to maintain current order for still-selected events
    setEventOrder((prevOrder) => {
      const stillSelected = prevOrder.filter((id) => newEventIds.includes(id));
      const newlyAdded = newEventIds.filter((id) => !prevOrder.includes(id));
      return [...stillSelected, ...newlyAdded];
    });
  }, [setValue]);

  const handleOrderChange = useCallback((newOrder: string[]) => {
    setEventOrder(newOrder);
  }, []);

  const handleDivingIncludedChange = useCallback((included: boolean) => {
    setValue("divingIncluded", included);
    // If disabling diving, remove diving events from selection
    if (!included) {
      // Get diving event IDs from the events array directly
      const divingEventIds = events
        .filter((e) => e.eventType === "diving")
        .map((e) => e.id);
      setValue("eventIds", (currentIds: string[]) => 
        currentIds.filter((id) => !divingEventIds.includes(id))
      );
      setEventOrder((prev) => prev.filter((id) => !divingEventIds.includes(id)));
    }
  }, [setValue, events]);

  // Create event options from standard lists, matching with existing events if they exist
  const swimmingEventOptions = STANDARD_SWIMMING_EVENTS.map((eventName) => {
    const existingEvent = events.find((e) => e.name === eventName && e.eventType === "individual");
    return {
      id: existingEvent?.id || eventName,
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
      id: existingEvent?.id || eventName,
      name: eventName,
      eventType: "diving" as const,
    };
  }).filter((e): e is Event => e !== null);

  const relayEventOptions = STANDARD_RELAY_EVENTS.map((eventName) => {
    const existingEvent = events.find((e) => e.name === eventName && e.eventType === "relay");
    return {
      id: existingEvent?.id || eventName,
      name: eventName,
      eventType: "relay" as const,
    };
  }).filter((e): e is Event => e !== null);

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      // Generate scoring tables
      const scoring = generateScoringTable(
        parseInt(data.scoringPlaces),
        data.scoringStartPoints,
        data.relayMultiplier
      );

      const response = await fetch(`/api/meets/${meetId}`, {
        method: "PUT",
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
          eventIds: data.eventIds,
          eventOrder: eventOrder.length > 0 ? JSON.stringify(eventOrder) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorDetails = error.details ? `: ${JSON.stringify(error.details)}` : error.details ? `: ${error.details}` : "";
        throw new Error((error.error || "Failed to update meet") + errorDetails);
      }

      toast.success("Meet updated successfully!");
      router.push(`/meets/${meetId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update meet");
    } finally {
      setLoading(false);
    }
  };

  if (loadingMeet) {
    return <div>Loading...</div>;
  }

  if (!meet) {
    return <div>Meet not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/meets/${meetId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Edit Meet</h1>
          <p className="text-slate-600 mt-1">
            Update meet configuration and settings
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
        <EventSelectorWithOrder
          swimmingEvents={swimmingEventOptions}
          relayEvents={relayEventOptions}
          divingEvents={divingEventOptions}
          selectedEventIds={selectedEventIds}
          onSelectionChange={handleSelectionChange}
          onOrderChange={handleOrderChange}
          divingIncluded={divingIncluded}
          onDivingIncludedChange={handleDivingIncludedChange}
        />
        {errors.eventIds && (
          <p className="text-sm text-red-600">{errors.eventIds.message}</p>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Updating..." : "Update Meet"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/meets/${meetId}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
