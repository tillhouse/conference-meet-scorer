"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const SWIMMING_EVENTS = [
  { name: "50 Free", label: "50 Free", placeholder: "e.g., 19.85" },
  { name: "100 Free", label: "100 Free", placeholder: "e.g., 43.50" },
  { name: "200 Free", label: "200 Free", placeholder: "e.g., 1:35.20" },
  { name: "500 Free", label: "500 Free", placeholder: "e.g., 4:15.32" },
  { name: "1000 Free", label: "1000 Free", placeholder: "e.g., 9:05.00" },
  { name: "1650 Free", label: "1650 Free", placeholder: "e.g., 14:45.61" },
  { name: "50 Back", label: "50 Back", placeholder: "e.g., 22.50" },
  { name: "100 Back", label: "100 Back", placeholder: "e.g., 46.84" },
  { name: "200 Back", label: "200 Back", placeholder: "e.g., 1:41.35" },
  { name: "50 Breast", label: "50 Breast", placeholder: "e.g., 25.20" },
  { name: "100 Breast", label: "100 Breast", placeholder: "e.g., 53.50" },
  { name: "200 Breast", label: "200 Breast", placeholder: "e.g., 1:57.65" },
  { name: "50 Fly", label: "50 Fly", placeholder: "e.g., 21.20" },
  { name: "100 Fly", label: "100 Fly", placeholder: "e.g., 46.12" },
  { name: "200 Fly", label: "200 Fly", placeholder: "e.g., 1:42.95" },
  { name: "200 IM", label: "200 IM", placeholder: "e.g., 1:45.44" },
  { name: "400 IM", label: "400 IM", placeholder: "e.g., 3:46.08" },
];

const DIVING_EVENTS = [
  { name: "1M Diving (dual)", label: "1M Diving", placeholder: "e.g., 325.50" },
  { name: "1M Diving (champ)", label: "1M Diving", placeholder: "e.g., 325.50" },
  { name: "3M Diving (dual)", label: "3M Diving", placeholder: "e.g., 350.25" },
  { name: "3M Diving (champ)", label: "3M Diving", placeholder: "e.g., 350.25" },
  { name: "Platform Diving (champ)", label: "Platform Diving", placeholder: "e.g., 380.00" },
];

const RELAY_SPLIT_EVENTS = [
  { name: "50 Free (split)", label: "50 Free (split)", placeholder: "e.g., 19.25" },
  { name: "100 Free (split)", label: "100 Free (split)", placeholder: "e.g., 42.50" },
  { name: "200 Free (split)", label: "200 Free (split)", placeholder: "e.g., 1:33.20" },
  { name: "50 Breast (split)", label: "50 Breast (split)", placeholder: "e.g., 24.50" },
  { name: "100 Breast (split)", label: "100 Breast (split)", placeholder: "e.g., 52.30" },
  { name: "50 Fly (split)", label: "50 Fly (split)", placeholder: "e.g., 21.20" },
  { name: "100 Fly (split)", label: "100 Fly (split)", placeholder: "e.g., 45.60" },
];

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  year: z.string().optional(),
  isDiver: z.boolean().default(false),
  events: z.record(z.string().optional()),
});

type FormData = z.infer<typeof formSchema>;

interface AddAthleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
}

export function AddAthleteDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
}: AddAthleteDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
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

  const isDiver = watch("isDiver");
  const events = watch("events");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    if (!teamId) {
      toast.error("Team ID is missing");
      return;
    }

    setLoading(true);

    try {
      // Create athlete
      const athleteResponse = await fetch("/api/athletes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          year: data.year,
          isDiver: data.isDiver,
          teamId,
        }),
      });

      if (!athleteResponse.ok) {
        const error = await athleteResponse.json();
        throw new Error(error.error || "Failed to create athlete");
      }

      const athlete = await athleteResponse.json();

      // Add event times (both individual and relay splits)
      const eventPromises = Object.entries(data.events)
        .filter(([_, time]) => time && time.trim().length > 0)
        .map(async ([eventKey, time]) => {
          // Check if this is a relay split (starts with "relay-")
          const isRelaySplit = eventKey.startsWith("relay-");
          const eventName = isRelaySplit ? eventKey.replace("relay-", "") : eventKey;

          const response = await fetch("/api/athletes/events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              athleteId: athlete.id,
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

      toast.success("Athlete created successfully");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create athlete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Athlete</DialogTitle>
          <DialogDescription>
            Add a new athlete to {teamName}. You can add event times now or edit them later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" {...register("firstName")} placeholder="John" />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" {...register("lastName")} placeholder="Doe" />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Select
                onValueChange={(value) => setValue("year", value === "none" ? undefined : value)}
              >
                <SelectTrigger id="year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
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
                <SelectTrigger id="isDiver">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="swimmer">Swimmer</SelectItem>
                  <SelectItem value="diver">Diver</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Event Times */}
          <Tabs defaultValue="individual" className="w-full">
            <TabsList>
              <TabsTrigger value="individual">Individual Events</TabsTrigger>
              <TabsTrigger value="relay-splits">Relay Splits</TabsTrigger>
            </TabsList>

            <TabsContent value="individual" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(isDiver ? DIVING_EVENTS : SWIMMING_EVENTS).map((event) => (
                  <div key={event.name} className="space-y-2">
                    <Label htmlFor={`event-${event.name}`}>{event.label}</Label>
                    <Input
                      id={`event-${event.name}`}
                      placeholder={event.placeholder}
                      value={events[event.name] || ""}
                      onChange={(e) =>
                        setValue(`events.${event.name}`, e.target.value || undefined)
                      }
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="relay-splits" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {RELAY_SPLIT_EVENTS.map((event) => (
                  <div key={event.name} className="space-y-2">
                    <Label htmlFor={`relay-${event.name}`}>{event.label}</Label>
                    <Input
                      id={`relay-${event.name}`}
                      placeholder={event.placeholder}
                      value={events[`relay-${event.name}`] || ""}
                      onChange={(e) =>
                        setValue(`events.relay-${event.name}`, e.target.value || undefined)
                      }
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Add Athlete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
