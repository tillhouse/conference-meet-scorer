import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListChecks } from "lucide-react";
import Link from "next/link";
import { LineupSelector } from "@/components/meets/lineup-selector";
import { LineupNavigation } from "@/components/meets/lineup-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";

export default async function MeetLineupsPage({
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
            select: {
              id: true,
              name: true,
              schoolName: true,
              athletes: {
                where: {
                  isEnabled: true,
                },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  year: true,
                  isDiver: true,
                  eventTimes: {
                    where: {
                      isRelaySplit: false,
                    },
                    select: {
                      id: true,
                      time: true,
                      event: {
                        select: {
                          id: true,
                          name: true,
                          eventType: true,
                        },
                      },
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
          athletes: meetTeam.team.athletes.filter((athlete) =>
            selectedAthleteIds.includes(athlete.id)
          ),
        },
      };
    });
  }

  if (!meet) {
    notFound();
  }

  const selectedEvents = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const events = await prisma.event.findMany({
    where: {
      id: { in: selectedEvents },
    },
    orderBy: {
      name: "asc",
    },
  });

  const swimmingEvents = events.filter((e) => e.eventType === "individual");
  const divingEvents = events.filter((e) => e.eventType === "diving");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Set Event Lineups</h1>
            <p className="text-slate-600 mt-1">
              Select which events each athlete will compete in for {meet.name}
            </p>
          </div>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Constraints Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Event Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>Swimmers:</strong> Max {meet.maxIndivEvents} individual events, Max {meet.maxRelays} relay events
          </div>
          <div>
            <strong>Divers:</strong> Max {meet.maxDivingEvents} diving events
          </div>
        </CardContent>
      </Card>

      {/* Team Lineups */}
      <div className="space-y-6">
        {meet.meetTeams.map((meetTeam) => (
          <LineupSelector
            key={meetTeam.id}
            meetId={id}
            meetTeam={meetTeam}
            team={meetTeam.team}
            swimmingEvents={swimmingEvents}
            divingEvents={divingEvents}
            maxIndivEvents={meet.maxIndivEvents}
            maxRelays={meet.maxRelays}
            maxDivingEvents={meet.maxDivingEvents}
          />
        ))}
      </div>

      {/* Navigation */}
      <LineupNavigation
        meetId={id}
        teamIds={meet.meetTeams.map((mt) => mt.teamId)}
        backUrl={`/meets/${id}/roster`}
        nextUrl={`/meets/${id}/relays`}
      />
    </div>
  );
}
