"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
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

// Standard swimming and diving events with realistic placeholders
const SWIMMING_EVENTS = [
  { name: "50 FR", label: "50 Free", placeholder: "e.g., 19.85" },
  { name: "100 FR", label: "100 Free", placeholder: "e.g., 43.50" },
  { name: "200 FR", label: "200 Free", placeholder: "e.g., 1:35.20" },
  { name: "500 FR", label: "500 Free", placeholder: "e.g., 4:15.32" },
  { name: "1000 FR", label: "1000 Free", placeholder: "e.g., 9:05.00" },
  { name: "1650 FR", label: "1650 Free", placeholder: "e.g., 14:45.61" },
  { name: "100 BK", label: "100 Back", placeholder: "e.g., 46.84" },
  { name: "200 BK", label: "200 Back", placeholder: "e.g., 1:41.35" },
  { name: "100 BR", label: "100 Breast", placeholder: "e.g., 53.50" },
  { name: "200 BR", label: "200 Breast", placeholder: "e.g., 1:57.65" },
  { name: "100 FL", label: "100 Fly", placeholder: "e.g., 46.12" },
  { name: "200 FL", label: "200 Fly", placeholder: "e.g., 1:42.95" },
  { name: "200 IM", label: "200 IM", placeholder: "e.g., 1:45.44" },
  { name: "400 IM", label: "400 IM", placeholder: "e.g., 3:46.08" },
];

const DIVING_EVENTS = [
  { name: "1M", label: "1 Meter", placeholder: "e.g., 325.50" },
  { name: "3M", label: "3 Meter", placeholder: "e.g., 350.25" },
];

const RELAY_SPLIT_EVENTS = [
  { name: "50 FR", label: "50 Free Split", placeholder: "e.g., 19.25" },
  { name: "100 FR", label: "100 Free Split", placeholder: "e.g., 42.50" },
  { name: "200 FR", label: "200 Free Split", placeholder: "e.g., 1:33.20" },
  { name: "50 BK", label: "50 Back Split", placeholder: "e.g., 21.50" },
  { name: "100 BK", label: "100 Back Split", placeholder: "e.g., 45.80" },
  { name: "50 BR", label: "50 Breast Split", placeholder: "e.g., 24.50" },
  { name: "100 BR", label: "100 Breast Split", placeholder: "e.g., 52.30" },
  { name: "50 FL", label: "50 Fly Split", placeholder: "e.g., 21.20" },
  { name: "100 FL", label: "100 Fly Split", placeholder: "e.g., 45.60" },
];

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  year: z.string().optional(),
  isDiver: z.boolean().default(false),
  events: z.record(z.string().optional()),
});

type FormData = z.infer<typeof formSchema>;

interface AthleteData {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  eventTimes: {
    id: string;
    time: string;
    isRelaySplit: boolean;
    event: {
      id: string;
      name: string;
    };
  }[];
}

export default function EditAthletePage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params?.id as string;
  const athleteId = params?.athleteId as string;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [athlete, setAthlete] = useState<AthleteData | null>(null);
  const [loadingAthlete, setLoadingAthlete] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      year: undefined,
      isDiver: false,
      events: {},
    },
  });

  // Load athlete data
  useEffect(() => {
    if (!athleteId) return;

    fetch(`/api/athletes/${athleteId}`)
      .then((res) => res.json())
      .then((data) => {
        setAthlete(data);
        setValue("firstName", data.firstName);
        setValue("lastName", data.lastName);
        setValue("year", data.year || undefined);
        setValue("isDiver", data.isDiver);

        // Load existing event times
        const events: Record<string, string> = {};
        data.eventTimes?.forEach((et: any) => {
          const key = et.isRelaySplit ? `relay-${et.event.name}` : et.event.name;
          events[key] = et.time;
        });
        setValue("events", events);
        setLoadingAthlete(false);
      })
      .catch((error) => {
        console.error("Error loading athlete:", error);
        toast.error("Failed to load athlete data");
        setLoadingAthlete(false);
      });
  }, [athleteId, setValue]);

  const isDiver = watch("isDiver");
  const events = watch("events");

  const onSubmit = async (data: FormData) => {
    if (!teamId || !athleteId) {
      toast.error("Missing required IDs");
      return;
    }

    setLoading(true);

    try {
      // Update athlete
      const athleteResponse = await fetch(`/api/athletes/${athleteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          year: data.year,
          isDiver: data.isDiver,
        }),
      });

      if (!athleteResponse.ok) {
        const error = await athleteResponse.json();
        throw new Error(error.error || "Failed to update athlete");
      }

      // Update/add event times
      const eventPromises = Object.entries(data.events)
        .filter(([_, time]) => time && time.trim().length > 0)
        .map(async ([eventKey, time]) => {
          const isRelaySplit = eventKey.startsWith("relay-");
          const eventName = isRelaySplit ? eventKey.replace("relay-", "") : eventKey;

          const response = await fetch("/api/athletes/events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              athleteId,
              eventName,
              time: time!.trim(),
              isRelaySplit,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to add ${eventName}: ${error.error || "Unknown error"}`);
          }
        });

      await Promise.all(eventPromises);

      toast.success("Athlete updated successfully!");
      router.push(`/teams/${teamId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update athlete");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!athleteId || !teamId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete athlete");
      }

      toast.success("Athlete deleted successfully!");
      router.push(`/teams/${teamId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete athlete");
      setDeleting(false);
    }
  };

  if (loadingAthlete) {
    return <div>Loading...</div>;
  }

  if (!athlete) {
    return <div>Athlete not found</div>;
  }

  if (!teamId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/teams/${teamId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">Edit Athlete</h1>
          <p className="text-slate-600 mt-1">
            Update athlete information and event times
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {athlete.firstName} {athlete.lastName} and all their event times.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the athlete's name and classification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Class Year</Label>
                <Select
                  value={watch("year") || ""}
                  onValueChange={(value) => setValue("year", value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FR">Freshman (FR)</SelectItem>
                    <SelectItem value="SO">Sophomore (SO)</SelectItem>
                    <SelectItem value="JR">Junior (JR)</SelectItem>
                    <SelectItem value="SR">Senior (SR)</SelectItem>
                    <SelectItem value="GR">Graduate (GR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isDiver">Type</Label>
                <Select
                  value={isDiver ? "diver" : "swimmer"}
                  onValueChange={(value) => setValue("isDiver", value === "diver")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swimmer">Swimmer</SelectItem>
                    <SelectItem value="diver">Diver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Times */}
        <Card>
          <CardHeader>
            <CardTitle>Event Times / Scores</CardTitle>
            <CardDescription>
              Enter times for swimming events or scores for diving events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="swimming" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="swimming">Swimming Events</TabsTrigger>
                <TabsTrigger value="diving">Diving Events</TabsTrigger>
                <TabsTrigger value="relay">Relay Splits</TabsTrigger>
              </TabsList>

              <TabsContent value="swimming" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {SWIMMING_EVENTS.map((event) => (
                    <div key={event.name} className="space-y-2">
                      <Label htmlFor={`event-${event.name}`}>{event.label}</Label>
                      <Input
                        id={`event-${event.name}`}
                        placeholder={event.placeholder}
                        value={events[event.name] || ""}
                        onChange={(e) => {
                          setValue(`events.${event.name}`, e.target.value);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="diving" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  {DIVING_EVENTS.map((event) => (
                    <div key={event.name} className="space-y-2">
                      <Label htmlFor={`event-${event.name}`}>{event.label}</Label>
                      <Input
                        id={`event-${event.name}`}
                        placeholder={event.placeholder}
                        value={events[event.name] || ""}
                        onChange={(e) => {
                          setValue(`events.${event.name}`, e.target.value);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="relay" className="space-y-4 mt-4">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Relay Splits:</strong> Enter flying-start split times (from relay exchanges). 
                    These are typically faster than flat-start individual event times and are used for accurate relay time calculations.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {RELAY_SPLIT_EVENTS.map((event) => (
                    <div key={`relay-${event.name}`} className="space-y-2">
                      <Label htmlFor={`relay-${event.name}`}>{event.label}</Label>
                      <Input
                        id={`relay-${event.name}`}
                        placeholder={event.placeholder}
                        value={events[`relay-${event.name}`] || ""}
                        onChange={(e) => {
                          setValue(`events.relay-${event.name}`, e.target.value);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/teams/${teamId}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
