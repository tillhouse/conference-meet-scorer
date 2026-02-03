import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { RelayCreator } from "@/components/meets/relay-creator";
import { RelayNavigation } from "@/components/meets/relay-navigation";

// Standard relay events with their leg distances
const RELAY_EVENTS = [
  { name: "200 Free Relay", label: "200 Free Relay", legs: ["FR", "FR", "FR", "FR"], distances: ["50", "50", "50", "50"] },
  { name: "400 Free Relay", label: "400 Free Relay", legs: ["FR", "FR", "FR", "FR"], distances: ["100", "100", "100", "100"] },
  { name: "800 Free Relay", label: "800 Free Relay", legs: ["FR", "FR", "FR", "FR"], distances: ["200", "200", "200", "200"] },
  { name: "200 Medley Relay", label: "200 Medley Relay", legs: ["BK", "BR", "FL", "FR"], distances: ["50", "50", "50", "50"] },
  { name: "400 Medley Relay", label: "400 Medley Relay", legs: ["BK", "BR", "FL", "FR"], distances: ["100", "100", "100", "100"] },
];

export default async function MeetRelaysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      meetTeams: {
        include: {
          team: {
            include: {
              athletes: {
                where: {
                  isEnabled: true,
                },
                include: {
                  eventTimes: {
                    include: {
                      event: true,
                    },
                  },
                },
                orderBy: [
                  { lastName: "asc" },
                  { firstName: "asc" },
                ],
              },
            },
          },
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  // Filter athletes to only show those selected in the roster
  if (meet) {
    meet.meetTeams = meet.meetTeams.map((meetTeam) => {
      const selectedAthleteIds = meetTeam.selectedAthletes
        ? (JSON.parse(meetTeam.selectedAthletes) as string[])
        : [];
      
      return {
        ...meetTeam,
        team: {
          ...meetTeam.team,
          athletes: meetTeam.team.athletes
            .filter((athlete) => selectedAthleteIds.includes(athlete.id))
            .filter((athlete) => !athlete.isDiver), // Only swimmers for relays
        },
      };
    });
  }

  // Get relay events from selected events
  const selectedEvents = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const events = await prisma.event.findMany({
    where: {
      id: { in: selectedEvents },
      eventType: "relay",
    },
    orderBy: {
      name: "asc",
    },
  });

  // If no relay events in database, use the standard ones
  const relayEvents = events.length > 0 
    ? events.map((e) => {
        // Determine legs and distances based on event name
        let legs = ["FR", "FR", "FR", "FR"];
        let distances = ["100", "100", "100", "100"];
        const lowerName = e.name.toLowerCase();
        
        if (lowerName.includes("200 free relay")) {
          legs = ["FR", "FR", "FR", "FR"];
          distances = ["50", "50", "50", "50"];
        } else if (lowerName.includes("400 free relay")) {
          legs = ["FR", "FR", "FR", "FR"];
          distances = ["100", "100", "100", "100"];
        } else if (lowerName.includes("800 free relay")) {
          legs = ["FR", "FR", "FR", "FR"];
          distances = ["200", "200", "200", "200"];
        } else if (lowerName.includes("200 medley relay")) {
          legs = ["BK", "BR", "FL", "FR"];
          distances = ["50", "50", "50", "50"];
        } else if (lowerName.includes("400 medley relay")) {
          legs = ["BK", "BR", "FL", "FR"];
          distances = ["100", "100", "100", "100"];
        }
        
        return { ...e, legs, distances };
      })
    : RELAY_EVENTS.map((re) => ({
        id: re.name,
        name: re.name,
        fullName: re.label,
        legs: re.legs,
        distances: re.distances,
      }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/meets/${id}/lineups`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create Relays</h1>
          <p className="text-slate-600 mt-1">
            Set relay lineups for each team in {meet.name}
          </p>
        </div>
      </div>

      {/* Constraints Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Relay Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>Max Relays per Swimmer:</strong> {meet.maxRelays}
          </div>
          <div>
            <strong>First Leg:</strong> Uses flat-start individual event times (50 BK, 100 BK, 50 FR, 100 FR, 200 FR)
          </div>
          <div>
            <strong>Other Legs:</strong> Use relay splits OR flat-start time minus correction factor (default: 0.5s)
          </div>
        </CardContent>
      </Card>

      {/* Relay Creators for Each Team */}
      <div className="space-y-6">
        {meet.meetTeams.map((meetTeam) => (
          <RelayCreator
            key={meetTeam.id}
            meetId={id}
            meetTeam={meetTeam}
            team={meetTeam.team}
            relayEvents={relayEvents}
            maxRelays={meet.maxRelays}
          />
        ))}
      </div>

      {/* Navigation */}
      <RelayNavigation
        meetId={id}
        teamIds={meet.meetTeams.map((mt) => mt.teamId)}
        backUrl={`/meets/${id}/lineups`}
        nextUrl={`/meets/${id}`}
      />
    </div>
  );
}
