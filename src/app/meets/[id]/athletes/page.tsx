import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetAthleteSummaryTable } from "@/components/meets/meet-athlete-summary-table";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";
import { sortEventsByOrder } from "@/lib/event-utils";
import { getComputedMeetView } from "@/lib/meet-simulate-compute";

export default async function MeetAthletesPage({
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
          team: { select: { id: true, name: true, schoolName: true, primaryColor: true } },
        },
      },
      meetLineups: {
        include: {
          athlete: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  schoolName: true,
                  primaryColor: true,
                },
              },
            },
          },
          event: true,
        },
      },
      relayEntries: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              primaryColor: true,
            },
          },
          event: true,
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  const realResultsEventIds = meet.realResultsEventIds
    ? (JSON.parse(meet.realResultsEventIds) as string[])
    : [];
  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};
  const scoringMode = (meet.scoringMode ?? "simulated") as "simulated" | "real" | "hybrid";
  const meetForCompute = { ...meet, individualScoring, relayScoring };

  const { meetLineups, relayEntries, meetTeams } = getComputedMeetView(
    meetForCompute,
    scoringMode,
    realResultsEventIds
  );

  const lineupAthleteIds = new Set(meetLineups.map((l) => l.athleteId));

  // Collect athlete IDs that appear in any relay's members
  const relayMemberIds = new Set<string>();
  relayEntries.forEach((entry) => {
    if (!entry.members) return;
    try {
      const ids = JSON.parse(entry.members) as (string | null)[];
      ids.forEach((id) => {
        if (id && typeof id === "string") relayMemberIds.add(id);
      });
    } catch (_) {}
  });
  const relayOnlyIds = [...relayMemberIds].filter((aid) => !lineupAthleteIds.has(aid));

  const relayOnlyAthletes =
    relayOnlyIds.length > 0
      ? await prisma.athlete.findMany({
          where: { id: { in: relayOnlyIds } },
          include: {
            team: {
              select: { id: true, name: true, schoolName: true, primaryColor: true },
            },
          },
        })
      : [];

  const selectedEventIds = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;
  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: selectedEventIds } },
  });
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  const testSpotAthleteIds: string[] = [];
  meet.meetTeams?.forEach((mt) => {
    if (mt.testSpotAthleteIds) {
      try {
        const ids = JSON.parse(mt.testSpotAthleteIds) as string[];
        testSpotAthleteIds.push(...ids);
      } catch (_) {}
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Athlete Summary</h1>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} scoringMode={meet.scoringMode} />

      {/* Athlete Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Athlete Summary</CardTitle>
          <CardDescription>
            Overview of all athletes competing in this meet, including events and projected points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeetAthleteSummaryTable
            meetLineups={meetLineups}
            relayEntries={relayEntries}
            relayOnlyAthletes={relayOnlyAthletes}
        events={events}
        individualScoring={individualScoring}
        relayScoring={relayScoring}
        scoringPlaces={meet.scoringPlaces}
        testSpotAthleteIds={testSpotAthleteIds}
        meetId={id}
        meetTeams={meetTeams.map((mt) => ({
              teamId: mt.teamId,
              sensitivityVariantAthleteId: (mt as { sensitivityVariantAthleteId?: string | null }).sensitivityVariantAthleteId,
              sensitivityVariant: (mt as { sensitivityVariant?: string | null }).sensitivityVariant,
              sensitivityPercent: (mt as { sensitivityPercent?: number | null }).sensitivityPercent,
              team: mt.team,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
